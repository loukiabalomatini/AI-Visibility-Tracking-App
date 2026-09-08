import { useState, useEffect, useRef } from 'react';
import { TrackerData, AnalysisRun, PromptResult, AIProviderId } from './types';
import {
  fetchTrackerData,
  updateSetup,
  createAnalysisRun,
  executePrompt,
  cancelRun,
} from './api';
import { Header } from './components/Header';
import { ResultsDashboard } from './components/ResultsDashboard';
import { PromptResultsTable } from './components/PromptResultsTable';
import { RunAnalysisSection } from './components/RunAnalysisSection';
import { SetupSection } from './components/SetupSection';
import { PromptDetailModal } from './components/PromptDetailModal';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  const [trackerData, setTrackerData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'results' | 'prompts' | 'run' | 'setup'>('results');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<AIProviderId | 'all'>('all');

  // Live execution state
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<AnalysisRun | null>(null);
  const [activePromptIndex, setActivePromptIndex] = useState<number>(0);
  const [activeProvider, setActiveProvider] = useState<AIProviderId | undefined>('gemini');
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [retryingPromptId, setRetryingPromptId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedValidationPrompt, setSelectedValidationPrompt] = useState<PromptResult | null>(null);

  const abortRunRef = useRef(false);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTrackerData();
      setTrackerData(data);
      if (data.runs && data.runs.length > 0) {
        setActiveRunId(data.runs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load tracker data:', err);
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRun = async (runName: string, selectedProviders: AIProviderId[] = ['gemini', 'claude', 'openai']) => {
    if (!trackerData) return;
    const config = trackerData.config;
    const enabledPrompts = config.prompts.filter(p => p.enabled !== false);

    if (enabledPrompts.length === 0) {
      setRunError('Please enable at least one prompt in Setup before running analysis.');
      setActiveTab('run');
      return;
    }

    if (selectedProviders.length === 0) {
      setRunError('Please select at least one AI provider.');
      setActiveTab('run');
      return;
    }

    try {
      setIsRunning(true);
      setRunError(null);
      abortRunRef.current = false;
      setActivePromptIndex(0);

      // Create new multi-engine Run on backend
      const res = await createAnalysisRun({
        name: runName,
        targetBrand: config.targetBrand,
        competitors: config.competitors,
        prompts: enabledPrompts,
        providers: selectedProviders,
      });

      const newRun = res.run;
      setCurrentRun(newRun);
      setActiveRunId(newRun.id);

      // Build task list: each prompt × each selected provider
      const tasks: { prompt: typeof enabledPrompts[0]; provider: AIProviderId }[] = [];
      for (const prompt of enabledPrompts) {
        for (const provider of selectedProviders) {
          tasks.push({ prompt, provider });
        }
      }

      // Run prompts concurrently in controlled batches (concurrency: 3)
      const CONCURRENCY_LIMIT = 3;
      let taskIndex = 0;

      const runWorker = async () => {
        while (taskIndex < tasks.length && !abortRunRef.current) {
          const currentIdx = taskIndex++;
          const { prompt, provider } = tasks[currentIdx];
          setActivePromptIndex(currentIdx);
          setActiveProvider(provider);

          // Mark as processing in UI
          setCurrentRun(prev => {
            if (!prev) return null;
            const updatedPromptResults = [...prev.promptResults];
            const idx = updatedPromptResults.findIndex(
              p => p.promptId === prompt.id && (p.provider || 'gemini').toLowerCase() === provider.toLowerCase()
            );
            if (idx !== -1) {
              updatedPromptResults[idx] = {
                ...updatedPromptResults[idx],
                status: 'processing',
              };
            }
            return {
              ...prev,
              promptResults: updatedPromptResults,
            };
          });

          try {
            const stepRes = await executePrompt(newRun.id, prompt.id, provider);

            // Update current run state in UI
            setCurrentRun(prev => {
              if (!prev) return null;
              const updatedPromptResults = [...prev.promptResults];
              const idx = updatedPromptResults.findIndex(
                p => p.promptId === prompt.id && (p.provider || 'gemini').toLowerCase() === provider.toLowerCase()
              );
              if (idx !== -1) {
                updatedPromptResults[idx] = stepRes.promptResult;
              } else {
                updatedPromptResults.push(stepRes.promptResult);
              }
              return {
                ...prev,
                completedPrompts: stepRes.runProgress.completedPrompts,
                failedPrompts: stepRes.runProgress.failedPrompts,
                status: stepRes.runProgress.status,
                brandMetrics: stepRes.runProgress.brandMetrics || prev.brandMetrics,
                providerMetrics: stepRes.runProgress.providerMetrics || prev.providerMetrics,
                promptResults: updatedPromptResults,
              };
            });
          } catch (stepErr: any) {
            console.error(`Error executing prompt "${prompt.text}" on ${provider}:`, stepErr);
            // Mark as failed in UI so user can inspect and retry
            setCurrentRun(prev => {
              if (!prev) return null;
              const updatedPromptResults = [...prev.promptResults];
              const idx = updatedPromptResults.findIndex(
                p => p.promptId === prompt.id && (p.provider || 'gemini').toLowerCase() === provider.toLowerCase()
              );
              if (idx !== -1) {
                updatedPromptResults[idx] = {
                  ...updatedPromptResults[idx],
                  status: 'failed',
                  error: stepErr.message || 'Execution error',
                };
              }
              return {
                ...prev,
                failedPrompts: (prev.failedPrompts || 0) + 1,
                promptResults: updatedPromptResults,
              };
            });
          }
        }
      };

      // Launch concurrent workers
      const workerCount = Math.min(CONCURRENCY_LIMIT, tasks.length);
      const workers = Array.from({ length: workerCount }, () => runWorker());
      await Promise.all(workers);

      if (abortRunRef.current) {
        await cancelRun(newRun.id);
      }

      // Refresh data store after run is complete
      const refreshed = await fetchTrackerData();
      setTrackerData(refreshed);
      if (refreshed.runs.length > 0) {
        const finishedRun = refreshed.runs.find(r => r.id === newRun.id) || refreshed.runs[0];
        setActiveRunId(finishedRun.id);
        setCurrentRun(finishedRun);
      }
    } catch (err: any) {
      console.error('Error starting analysis run:', err);
      setRunError(err.message || 'Failed to start analysis run. Ensure your provider API keys are configured.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCancelRun = async () => {
    abortRunRef.current = true;
    if (currentRun) {
      await cancelRun(currentRun.id);
      setIsRunning(false);
      const refreshed = await fetchTrackerData();
      setTrackerData(refreshed);
    }
  };

  const handleRetryPrompt = async (promptId: string, provider?: AIProviderId) => {
    if (!activeRunId) return;
    try {
      setRetryingPromptId(promptId);
      const res = await executePrompt(activeRunId, promptId, provider);

      // Refresh data
      const refreshed = await fetchTrackerData();
      setTrackerData(refreshed);
      if (currentRun && currentRun.id === activeRunId) {
        setCurrentRun(res.runProgress);
      }
    } catch (err: any) {
      console.error('Failed to retry prompt:', err);
      alert(`Failed to retry prompt: ${err.message}`);
    } finally {
      setRetryingPromptId(null);
    }
  };

  const handleRetryFailedInCurrentRun = async () => {
    if (!currentRun) return;
    const failed = currentRun.promptResults.filter(p => p.status === 'failed');
    if (failed.length === 0) return;

    for (const p of failed) {
      await handleRetryPrompt(p.promptId, p.provider);
    }
  };

  const handleSaveSetup = async (updated: {
    targetBrand: string;
    competitors: string[];
    prompts: any[];
    providerModels?: Record<string, string>;
    enabledProviders?: AIProviderId[];
  }) => {
    try {
      setIsSavingSetup(true);
      const res = await updateSetup(updated);
      setTrackerData(prev => (prev ? { ...prev, config: res.config } : null));
    } catch (err: any) {
      console.error('Failed to save setup:', err);
      alert(`Failed to save setup: ${err.message}`);
    } finally {
      setIsSavingSetup(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">Initializing AI Visibility Tracker...</h3>
          <p className="text-xs text-slate-500">Loading stored runs, prompts, and provider configurations</p>
        </div>
      </div>
    );
  }

  if (error || !trackerData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-rose-200 max-w-md w-full text-center space-y-3 shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Application Error</h3>
          <p className="text-xs text-slate-600">{error || 'Unable to connect to backend server'}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { config, runs } = trackerData;
  const activeRun = runs.find(r => r.id === activeRunId) || runs[0] || null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* App Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        targetBrand={config.targetBrand}
        competitorsCount={config.competitors.length}
        promptsCount={config.prompts.length}
        isRunning={isRunning}
        apiKeyConfigured={trackerData.apiKeyConfigured}
        providersStatus={trackerData.providersStatus}
        onQuickRun={() => {
          setActiveTab('run');
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab 1: Results Dashboard */}
        {activeTab === 'results' && (
          <ResultsDashboard
            runs={runs}
            activeRunId={activeRunId}
            targetBrand={config.targetBrand}
            competitors={config.competitors}
            onSelectRun={runId => setActiveRunId(runId)}
            onNavigateToPrompts={(categoryFilter, providerFilter) => {
              if (categoryFilter) {
                setSelectedCategoryFilter(categoryFilter);
              }
              if (providerFilter) {
                setSelectedProviderFilter(providerFilter);
              }
              setActiveTab('prompts');
            }}
            onNavigateToRun={() => setActiveTab('run')}
          />
        )}

        {/* Tab 2: Prompt Results */}
        {activeTab === 'prompts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Prompt-by-Prompt Results Table
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect rankings, recommendations, and quotes extracted from Gemini, Claude, and OpenAI
                </p>
              </div>

              {activeRun && (
                <div className="text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
                  Viewing Run:{' '}
                  <strong className="text-slate-900">
                    {activeRun.name || activeRun.id}
                  </strong>{' '}
                  ({new Date(activeRun.timestamp).toLocaleDateString()})
                </div>
              )}
            </div>

            <PromptResultsTable
              run={activeRun}
              targetBrand={config.targetBrand}
              competitors={config.competitors}
              initialCategoryFilter={selectedCategoryFilter}
              initialProviderFilter={selectedProviderFilter}
              onRetryPrompt={handleRetryPrompt}
              isRetryingPromptId={retryingPromptId}
            />
          </div>
        )}

        {/* Tab 3: Run Analysis */}
        {activeTab === 'run' && (
          <RunAnalysisSection
            prompts={config.prompts}
            targetBrand={config.targetBrand}
            competitors={config.competitors}
            isRunning={isRunning}
            currentRun={currentRun || activeRun}
            activePromptIndex={activePromptIndex}
            activeProvider={activeProvider}
            apiKeyConfigured={trackerData.apiKeyConfigured}
            providersStatus={trackerData.providersStatus}
            runError={runError}
            onStartRun={handleStartRun}
            onCancelRun={handleCancelRun}
            onRetryFailed={handleRetryFailedInCurrentRun}
            onRetrySinglePrompt={handleRetryPrompt}
            onSelectPrompt={pr => setSelectedValidationPrompt(pr)}
            onViewResults={() => setActiveTab('results')}
            onViewPrompts={() => setActiveTab('prompts')}
            onViewSetup={() => setActiveTab('setup')}
          />
        )}

        {/* Tab 4: Setup */}
        {activeTab === 'setup' && (
          <SetupSection
            targetBrand={config.targetBrand}
            competitors={config.competitors}
            prompts={config.prompts}
            providersStatus={trackerData.providersStatus}
            onSaveSetup={handleSaveSetup}
            onRefreshProviders={loadData}
            isSaving={isSavingSetup}
          />
        )}
      </main>

      {/* Validation / Debug Detail Modal */}
      {selectedValidationPrompt && (
        <PromptDetailModal
          promptResult={selectedValidationPrompt}
          allRunResults={(currentRun || activeRun)?.promptResults || []}
          targetBrand={config.targetBrand}
          onClose={() => setSelectedValidationPrompt(null)}
          onRetryPrompt={handleRetryPrompt}
          isRetrying={retryingPromptId === selectedValidationPrompt.promptId}
        />
      )}
    </div>
  );
}
