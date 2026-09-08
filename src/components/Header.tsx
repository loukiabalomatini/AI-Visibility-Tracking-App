import { Activity, Play, Settings, Table, BarChart3, Sparkles, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { ProviderStatusInfo, AIProviderId } from '../types';

interface HeaderProps {
  activeTab: 'results' | 'prompts' | 'run' | 'setup';
  setActiveTab: (tab: 'results' | 'prompts' | 'run' | 'setup') => void;
  targetBrand: string;
  competitorsCount: number;
  promptsCount: number;
  isRunning: boolean;
  apiKeyConfigured?: boolean;
  providersStatus?: Record<AIProviderId, ProviderStatusInfo>;
  onQuickRun: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  targetBrand,
  competitorsCount,
  promptsCount,
  isRunning,
  providersStatus,
  onQuickRun,
}: HeaderProps) {
  const geminiReady = providersStatus?.gemini?.configured ?? false;
  const claudeReady = providersStatus?.claude?.configured ?? false;
  const openaiReady = providersStatus?.openai?.configured ?? false;
  const configuredCount = [geminiReady, claudeReady, openaiReady].filter(Boolean).length;

  return (
    <header id="app-header" className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Meta */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight">AI Visibility Tracker</h1>
                  <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Multi-Engine
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  Tracking <span className="font-semibold text-slate-700">{targetBrand || 'Brand'}</span> vs. {competitorsCount} competitors ({promptsCount} prompts)
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              id="tab-results-btn"
              onClick={() => setActiveTab('results')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'results'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Results Dashboard</span>
            </button>

            <button
              id="tab-prompts-btn"
              onClick={() => setActiveTab('prompts')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'prompts'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-emerald-600" />
              <span>Prompt Results</span>
            </button>

            <button
              id="tab-run-btn"
              onClick={() => setActiveTab('run')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'run'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Play className={`w-3.5 h-3.5 text-amber-600 ${isRunning ? 'animate-spin' : ''}`} />
              <span>Run Analysis</span>
              {isRunning && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            <button
              id="tab-setup-btn"
              onClick={() => setActiveTab('setup')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'setup'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-slate-600" />
              <span>Setup</span>
            </button>
          </nav>

          {/* Quick CTA & Provider Status Badges */}
          <div className="flex items-center space-x-2.5">
            {/* Multi-Provider Status Badges */}
            <div className="hidden md:flex items-center space-x-1.5">
              {[
                { id: 'gemini' as const, name: 'Gemini' },
                { id: 'claude' as const, name: 'Claude' },
                { id: 'openai' as const, name: 'OpenAI' },
              ].map(p => {
                const info = providersStatus?.[p.id];
                const status = info?.connectionStatus || (info?.configured ? 'connected' : 'not_configured');
                const isConnected = status === 'connected';
                const isFailed = status === 'failed';

                let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
                let dotClass = 'bg-slate-400';
                let tooltip = `${p.name}: Not Configured (${info?.apiKeyName || 'API Key'})`;

                if (isConnected) {
                  badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  dotClass = 'bg-emerald-500';
                  tooltip = `${p.name}: Connected`;
                } else if (isFailed) {
                  badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                  dotClass = 'bg-rose-500';
                  tooltip = `${p.name}: Connection Failed - ${info?.lastError || 'Check key'}`;
                }

                return (
                  <span
                    key={p.id}
                    title={tooltip}
                    onClick={() => setActiveTab('setup')}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity ${badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                    <span>{p.name}</span>
                  </span>
                );
              })}
            </div>

            <button
              id="header-quick-run-btn"
              onClick={onQuickRun}
              disabled={isRunning}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all ${
                isRunning
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
              }`}
            >
              {isRunning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
