import { useState } from 'react';
import { AnalysisRun, PromptItem, PromptResult, AIProviderId, ProviderStatusInfo } from '../types';
import { Play, Sparkles, AlertCircle, CheckCircle2, RefreshCw, Square, ArrowRight, Check, Key } from 'lucide-react';

interface RunAnalysisSectionProps {
  prompts: PromptItem[];
  targetBrand: string;
  competitors: string[];
  isRunning: boolean;
  currentRun: AnalysisRun | null;
  activePromptIndex: number;
  activeProvider?: AIProviderId;
  apiKeyConfigured?: boolean;
  providersStatus?: Record<AIProviderId, ProviderStatusInfo>;
  runError?: string | null;
  onStartRun: (runName: string, selectedProviders: AIProviderId[]) => Promise<void>;
  onCancelRun: () => void;
  onRetryFailed: () => Promise<void>;
  onRetrySinglePrompt?: (promptId: string, provider?: AIProviderId) => Promise<void>;
  onSelectPrompt?: (promptResult: PromptResult) => void;
  onViewResults: () => void;
  onViewPrompts: () => void;
  onViewSetup?: () => void;
}

const PROVIDER_METAS: { id: AIProviderId; label: string; company: string; defaultModel: string; color: string }[] = [
  { id: 'gemini', label: 'Google Gemini', company: 'Google', defaultModel: 'gemini-flash-latest', color: 'indigo' },
  { id: 'claude', label: 'Anthropic Claude', company: 'Anthropic', defaultModel: 'claude-3-5-sonnet-20241022', color: 'amber' },
  { id: 'openai', label: 'OpenAI ChatGPT', company: 'OpenAI', defaultModel: 'gpt-4o', color: 'emerald' },
];

export function RunAnalysisSection({
  prompts,
  targetBrand,
  competitors,
  isRunning,
  currentRun,
  activePromptIndex,
  activeProvider,
  providersStatus,
  runError,
  onStartRun,
  onCancelRun,
  onRetryFailed,
  onRetrySinglePrompt,
  onSelectPrompt,
  onViewResults,
  onViewPrompts,
  onViewSetup,
}: RunAnalysisSectionProps) {
  const [runName, setRunName] = useState(
    `Audit ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  );
  const [selectedProviders, setSelectedProviders] = useState<AIProviderId[]>(['gemini', 'claude', 'openai']);

  const enabledPrompts = prompts.filter(p => p.enabled !== false);
  const totalObservations = currentRun
    ? currentRun.totalPrompts
    : enabledPrompts.length * selectedProviders.length;

  const completedObservations = currentRun ? currentRun.completedPrompts : 0;
  const failedObservations = currentRun ? currentRun.failedPrompts : 0;
  const percentComplete =
    totalObservations > 0 ? Math.round((completedObservations / totalObservations) * 100) : 0;

  const toggleProvider = (pId: AIProviderId) => {
    if (selectedProviders.includes(pId)) {
      if (selectedProviders.length > 1) {
        setSelectedProviders(selectedProviders.filter(id => id !== pId));
      }
    } else {
      setSelectedProviders([...selectedProviders, pId]);
    }
  };

  const handleStart = () => {
    if (selectedProviders.length === 0) return;
    onStartRun(runName.trim() || `Run ${Date.now()}`, selectedProviders);
  };

  // Group current run results by promptId for clear organized display
  const promptGroups = currentRun
    ? enabledPrompts.map(p => {
        const results = currentRun.promptResults.filter(pr => pr.promptId === p.id);
        return {
          prompt: p,
          results,
        };
      })
    : [];

  return (
    <div id="run-analysis-section" className="space-y-6 max-w-4xl mx-auto">
      {/* Main Execution Setup & Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Multi-Engine AI Visibility Analysis
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Benchmark <strong>{targetBrand}</strong> across {enabledPrompts.length} prompts simultaneously on Gemini, Claude, and OpenAI.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {enabledPrompts.length} Prompts × {selectedProviders.length} Engines = <strong>{enabledPrompts.length * selectedProviders.length} Queries</strong>
            </span>
          </div>
        </div>

        {/* Missing API Keys Notification Banner */}
        {providersStatus && (!providersStatus.gemini?.configured || !providersStatus.claude?.configured || !providersStatus.openai?.configured) && (
          <div className="mt-5 p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-xs">
            <div className="flex items-start space-x-3">
              <Key className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-amber-900">Provider API Key Status</h4>
                  {onViewSetup && (
                    <button
                      onClick={onViewSetup}
                      className="text-amber-900 hover:text-amber-700 underline font-semibold text-[11px]"
                    >
                      Configure Keys in Setup &rarr;
                    </button>
                  )}
                </div>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  Each AI provider requires its respective API key in server secrets or Setup. Unconfigured providers will produce clear setup error logs during the run without stopping other engines:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {PROVIDER_METAS.map(m => {
                    const status = providersStatus[m.id];
                    const connStatus = status?.connectionStatus || (status?.configured ? 'connected' : 'not_configured');
                    const isConnected = connStatus === 'connected';
                    const isFailed = connStatus === 'failed';

                    return (
                      <div
                        key={m.id}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between ${
                          isConnected
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : isFailed
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-white border-amber-300 text-amber-900'
                        }`}
                      >
                        <span className="font-semibold">{m.label}:</span>
                        <span className="font-medium text-[10px]">
                          {isConnected
                            ? '✓ Connected'
                            : isFailed
                            ? '⚠ Connection Failed'
                            : status?.apiKeyName || 'Not Configured'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Run Error Alert */}
        {runError && (
          <div className="mt-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-rose-900">Analysis Run Error</h4>
              <p className="text-xs text-rose-800 mt-1 leading-relaxed">{runError}</p>
            </div>
          </div>
        )}

        {/* Configuration inputs prior to launch */}
        {!isRunning && (!currentRun || currentRun.status === 'completed' || currentRun.status === 'partial') && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Run Label / Name
                </label>
                <input
                  id="run-name-input"
                  type="text"
                  value={runName}
                  onChange={e => setRunName(e.target.value)}
                  placeholder="e.g. Multi-Engine Benchmark"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tracked Entities
                </label>
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 truncate">
                  <span className="font-bold text-indigo-700">{targetBrand}</span> vs. {competitors.join(', ')}
                </div>
              </div>
            </div>

            {/* Provider Selection Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Active AI Engines for This Run
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PROVIDER_METAS.map(p => {
                  const isSelected = selectedProviders.includes(p.id);
                  const isConfigured = providersStatus ? providersStatus[p.id]?.configured : true;
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleProvider(p.id)}
                      className={`cursor-pointer p-3 rounded-xl border transition-all flex items-start space-x-3 ${
                        isSelected
                          ? 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200 shadow-xs'
                          : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                          isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div className="min-w-0 flex-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{p.label}</span>
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                              isConfigured
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isConfigured ? 'Ready' : 'Needs Key'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">Model: {p.defaultModel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Ready to execute <strong>{enabledPrompts.length} prompts</strong> across{' '}
                <strong>{selectedProviders.length} providers</strong> ({enabledPrompts.length * selectedProviders.length} total AI responses) with max 5 concurrent requests.
              </div>

              <button
                id="start-analysis-btn"
                onClick={handleStart}
                disabled={enabledPrompts.length === 0 || selectedProviders.length === 0}
                className="flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Multi-Engine Run</span>
              </button>
            </div>
          </div>
        )}

        {/* Running State & Progress Bar */}
        {isRunning && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                <span className="font-bold text-slate-900">
                  Running {completedObservations + failedObservations + 1} of {totalObservations} AI responses
                </span>
                {activeProvider && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase">
                    {activeProvider}
                  </span>
                )}
              </div>
              <span className="font-semibold text-indigo-600">{percentComplete}% Complete</span>
            </div>

            {/* Progress Track */}
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className="bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${percentComplete}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
              <span>
                Completed: <strong className="text-emerald-700">{completedObservations}</strong> | Failed:{' '}
                <strong className="text-rose-700">{failedObservations}</strong> | Remaining:{' '}
                <strong>{Math.max(0, totalObservations - completedObservations - failedObservations)}</strong>
              </span>

              <button
                onClick={onCancelRun}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
              >
                <Square className="w-3.5 h-3.5 fill-rose-600" />
                <span>Stop Analysis</span>
              </button>
            </div>
          </div>
        )}

        {/* Completed or Partial State Banner */}
        {!isRunning && currentRun && (currentRun.status === 'completed' || currentRun.status === 'partial') && (
          <div className="mt-5 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-emerald-950">
                  Analysis Complete: {currentRun.name}
                </span>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  Processed {completedObservations} of {totalObservations} AI responses across engines
                  {failedObservations > 0 ? ` (${failedObservations} failed/unconfigured)` : ''}.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {failedObservations > 0 && (
                <button
                  onClick={onRetryFailed}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry {failedObservations} Failed</span>
                </button>
              )}

              <button
                onClick={onViewResults}
                className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs"
              >
                <span>View Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Prompts Execution Log Grouped by Prompt and Provider */}
      {currentRun && currentRun.promptResults && currentRun.promptResults.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold tracking-wide uppercase text-slate-700">
                Multi-Engine Pipeline Execution Log ({currentRun.promptResults.length} Responses)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every prompt is evaluated independently across all registered AI engines.
              </p>
            </div>
            <span className="text-[11px] text-slate-400">
              Run ID: <code className="font-mono text-slate-600">{currentRun.id}</code>
            </span>
          </div>

          <div className="mt-4 space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {promptGroups.map(({ prompt, results }, pIdx) => {
              return (
                <div
                  key={prompt.id}
                  className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="font-mono text-[11px] text-slate-400 font-bold">#{pIdx + 1}</span>
                      <h4 className="text-xs font-semibold text-slate-900 truncate">
                        "{prompt.text}"
                      </h4>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded bg-white border border-slate-200">
                      {prompt.category}
                    </span>
                  </div>

                  {/* Engine Results Sub-List */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {(['gemini', 'claude', 'openai'] as AIProviderId[]).map(provId => {
                      const pr = results.find(r => (r.provider || 'gemini').toLowerCase() === provId);
                      if (!pr) return null;

                      const isCurrent = isRunning && pr.status === 'processing';
                      const isDone = pr.status === 'completed';
                      const isFailed = pr.status === 'failed';
                      const isPending = pr.status === 'pending';

                      const targetBrandAnalysis = pr.brands?.find(
                        b => b.name.toLowerCase() === targetBrand.toLowerCase()
                      );

                      const provName =
                        provId === 'gemini' ? 'Gemini' : provId === 'claude' ? 'Claude' : 'OpenAI';

                      return (
                        <div
                          key={provId}
                          onClick={() => {
                            if ((isDone || isFailed) && onSelectPrompt) {
                              onSelectPrompt(pr);
                            }
                          }}
                          className={`p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300 shadow-xs'
                              : isDone
                              ? 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xs'
                              : isFailed
                              ? 'bg-rose-50/60 border-rose-200'
                              : 'bg-white/60 border-slate-100 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-[11px] text-slate-800">{provName}</span>
                            {isCurrent && (
                              <span className="flex items-center space-x-1 text-[10px] font-semibold text-indigo-700">
                                <div className="w-2.5 h-2.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                <span>Processing</span>
                              </span>
                            )}
                            {isDone && (
                              <span className="flex items-center space-x-1 text-[10px] font-medium text-emerald-700">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Completed</span>
                              </span>
                            )}
                            {isFailed && (
                              <span
                                className="flex items-center space-x-1 text-[10px] font-semibold text-rose-700"
                                title={pr.error}
                              >
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>Failed</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="text-[10px] text-slate-400 font-medium">Pending</span>
                            )}
                          </div>

                          {/* Visibility Result for Target Brand */}
                          {isDone && (
                            <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-slate-100">
                              <span className="text-slate-500">{targetBrand}:</span>
                              {targetBrandAnalysis?.mentioned ? (
                                <span className="font-bold text-indigo-700">
                                  {targetBrandAnalysis.explicit_position
                                    ? `#${targetBrandAnalysis.explicit_position} Rank`
                                    : targetBrandAnalysis.recommended
                                    ? '★ Recommended'
                                    : 'Mentioned'}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Not mentioned</span>
                              )}
                            </div>
                          )}

                          {isFailed && (
                            <div className="text-[10px] text-rose-600 truncate mt-1 pt-1 border-t border-rose-100">
                              {pr.error || 'Failed'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
