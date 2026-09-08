import { useState } from 'react';
import { AnalysisRun, AIProviderId } from '../types';
import { MetricCard } from './MetricCard';
import { HistoricalChart } from './HistoricalChart';
import { CategoryBreakdown } from './CategoryBreakdown';
import { RunComparisonModal } from './RunComparisonModal';
import { EngineComparisonSection } from './EngineComparisonSection';
import {
  Sparkles,
  Trophy,
  Percent,
  CheckCircle2,
  ListOrdered,
  Calendar,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Cpu,
} from 'lucide-react';

interface ResultsDashboardProps {
  runs: AnalysisRun[];
  activeRunId: string | null;
  targetBrand: string;
  competitors: string[];
  onSelectRun: (runId: string) => void;
  onNavigateToPrompts: (categoryFilter?: string, providerFilter?: AIProviderId) => void;
  onNavigateToRun: () => void;
}

export function ResultsDashboard({
  runs,
  activeRunId,
  targetBrand,
  competitors,
  onSelectRun,
  onNavigateToPrompts,
  onNavigateToRun,
}: ResultsDashboardProps) {
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<AIProviderId | 'all'>('all');

  // Active run selection
  const activeRun = runs.find(r => r.id === activeRunId) || runs[0];

  if (!activeRun) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <Sparkles className="w-10 h-10 mx-auto text-indigo-500 mb-3" />
        <h3 className="text-base font-bold text-slate-900">No Analysis Runs Found</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Configure your brands and prompts in Setup, then run your first multi-engine visibility analysis to view the dashboard metrics.
        </p>
        <button
          onClick={onNavigateToRun}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-sm"
        >
          Run Analysis Now
        </button>
      </div>
    );
  }

  // Determine active metrics map based on engine filter
  const activeMetricsMap =
    selectedEngine === 'all'
      ? activeRun.brandMetrics || {}
      : activeRun.providerMetrics?.[selectedEngine] || activeRun.brandMetrics || {};

  const targetMetrics = activeMetricsMap[targetBrand];
  const allBrands = [targetBrand, ...competitors];

  // Total completed queries relevant to current filter
  const completedInSelection =
    selectedEngine === 'all'
      ? activeRun.completedPrompts
      : activeRun.promptResults?.filter(
          p => (p.provider || 'gemini').toLowerCase() === selectedEngine && p.status === 'completed'
        ).length || 0;

  // Sorted leaderboard by Visibility Score in this selection
  const brandLeaderboard = [...allBrands]
    .map(b => ({
      name: b,
      isTarget: b.toLowerCase() === targetBrand.toLowerCase(),
      metrics: activeMetricsMap[b] || {
        visibilityScore: 0,
        mentionRate: 0,
        recommendationRate: 0,
        averagePosition: null,
      },
    }))
    .sort((a, b) => b.metrics.visibilityScore - a.metrics.visibilityScore);

  const targetRankIndex = brandLeaderboard.findIndex(b => b.isTarget);
  const targetRank = targetRankIndex >= 0 ? targetRankIndex + 1 : '-';

  const engineNameLabel =
    selectedEngine === 'all'
      ? 'All AI Engines (Combined)'
      : selectedEngine === 'gemini'
      ? 'Google Gemini'
      : selectedEngine === 'claude'
      ? 'Anthropic Claude'
      : 'OpenAI ChatGPT';

  return (
    <div id="results-dashboard-section" className="space-y-6">
      {/* Top Header & Run Selector Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                AI Visibility: <span className="text-indigo-600">{targetBrand}</span>
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Rank #{targetRank} of {allBrands.length}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {new Date(activeRun.timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span>•</span>
              <span>
                Scope: <strong className="text-slate-700 font-medium">{engineNameLabel}</strong>
              </span>
              <span>•</span>
              <span>
                <strong>{completedInSelection}</strong> analyzed answers
              </span>
            </div>
          </div>
        </div>

        {/* Run Selector Dropdown & Actions */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <label htmlFor="run-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Active Run:
            </label>
            <select
              id="run-select"
              value={activeRun.id}
              onChange={e => onSelectRun(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {runs.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name || r.id} ({new Date(r.timestamp).toLocaleDateString()}) - {r.completedPrompts}/{r.totalPrompts} responses
                </option>
              ))}
            </select>
          </div>

          <button
            id="run-new-analysis-quick-btn"
            onClick={onNavigateToRun}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Run</span>
          </button>
        </div>
      </div>

      {/* Engine Selection Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
          <Cpu className="w-4 h-4 text-indigo-600" />
          <span>Select Engine View:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setSelectedEngine('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedEngine === 'all'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Engines (Overall)
          </button>
          <button
            onClick={() => setSelectedEngine('gemini')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedEngine === 'gemini'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Google Gemini
          </button>
          <button
            onClick={() => setSelectedEngine('claude')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedEngine === 'claude'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Anthropic Claude
          </button>
          <button
            onClick={() => setSelectedEngine('openai')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedEngine === 'openai'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            OpenAI ChatGPT
          </button>
        </div>
      </div>

      {/* Directional Metric Notice */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 flex items-start space-x-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Directional Metric Notice:</span> The AI Visibility Score is a weighted heuristic
          reflecting brand mentions, explicit ranked positions, and recommendations in AI answers. It serves as a directional
          trend indicator, not an official search engine ranking.
        </div>
      </div>

      {/* Summary Metric Cards for Selected Scope */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          id="metric-visibility-score"
          title={`Visibility Score (${selectedEngine === 'all' ? 'Overall' : selectedEngine.toUpperCase()})`}
          value={targetMetrics?.visibilityScore ?? 0}
          sublabel={`Score on ${engineNameLabel}`}
          icon={<Sparkles className="w-4 h-4 text-indigo-500" />}
          highlight={true}
          tooltip="Calculated from explicit positions (#1=1.0, #2=0.8, etc.) or unranked mentions (0.3), averaged across responses."
        />

        <MetricCard
          id="metric-mention-rate"
          title="Mention Rate"
          value={`${targetMetrics?.mentionRate ?? 0}%`}
          sublabel={`Appeared in ${targetMetrics?.totalMentions ?? 0} of ${completedInSelection} answers`}
          icon={<Percent className="w-4 h-4 text-blue-500" />}
          tooltip="Percentage of prompts where the brand was explicitly mentioned."
        />

        <MetricCard
          id="metric-recommendation-rate"
          title="Recommendation Rate"
          value={`${targetMetrics?.recommendationRate ?? 0}%`}
          sublabel={`Recommended in ${targetMetrics?.totalRecommended ?? 0} answers`}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          tooltip="Percentage of responses where the brand was highlighted as a top pick or explicitly endorsed."
        />

        <MetricCard
          id="metric-average-position"
          title="Average Position"
          value={targetMetrics?.averagePosition !== null && targetMetrics?.averagePosition !== undefined ? `#${targetMetrics.averagePosition}` : 'N/A'}
          sublabel={
            targetMetrics?.explicitPositionCount
              ? `From ${targetMetrics.explicitPositionCount} explicitly ranked lists`
              : 'No explicit numbered rankings'
          }
          icon={<ListOrdered className="w-4 h-4 text-purple-500" />}
          tooltip="Average numerical rank when an engine provided an explicit ordered list (#1, #2, etc.)."
        />
      </div>

      {/* Dedicated Engine Comparison Section */}
      <EngineComparisonSection
        run={activeRun}
        targetBrand={targetBrand}
        competitors={competitors}
        onSelectEngineFilter={engine => setSelectedEngine(engine)}
        onNavigateToPrompts={(cat, prov) => onNavigateToPrompts(cat, prov)}
      />

      {/* Competitor Comparison Section */}
      <div id="competitor-comparison-card" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Competitor Visibility Leaderboard ({engineNameLabel})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rankings across {completedInSelection} evaluated prompts in this selection
            </p>
          </div>
          <button
            onClick={() => onNavigateToPrompts(undefined, selectedEngine === 'all' ? undefined : selectedEngine)}
            className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <span>View Prompt-by-Prompt Breakdown</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Competitor Visual Comparison Bars & Table */}
        <div className="mt-5 space-y-4">
          {brandLeaderboard.map((item, idx) => {
            const isTarget = item.isTarget;
            const score = item.metrics.visibilityScore;
            return (
              <div
                key={item.name}
                className={`p-3.5 rounded-xl border transition-all ${
                  isTarget
                    ? 'bg-indigo-50/60 border-indigo-200 shadow-xs'
                    : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Brand & Rank */}
                  <div className="flex items-center space-x-3 min-w-[180px]">
                    <span className="w-6 text-center text-xs font-bold text-slate-400">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-slate-900">{item.name}</span>
                        {isTarget && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                            Your Brand
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {item.metrics.mentionRate}% mention • {item.metrics.recommendationRate}% rec.
                        {item.metrics.averagePosition ? ` • Avg Pos #${item.metrics.averagePosition}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="flex-1 max-w-md hidden sm:block">
                    <div className="bg-slate-200/70 h-2.5 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isTarget ? 'bg-indigo-600' : 'bg-slate-600'
                        }`}
                        style={{ width: `${Math.min(100, score)}%` }}
                      />
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right min-w-[60px]">
                    <span className="text-base font-extrabold text-slate-900">{score}</span>
                    <span className="text-xs text-slate-400 font-medium"> / 100</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Historical Chart & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HistoricalChart
          runs={runs}
          targetBrand={targetBrand}
          competitors={competitors}
          activeRunId={activeRun.id}
          onSelectRun={onSelectRun}
          onOpenCompare={() => setIsCompareOpen(true)}
          engineFilter={selectedEngine}
          onEngineFilterChange={f => setSelectedEngine(f)}
        />

        <CategoryBreakdown
          run={activeRun}
          targetBrand={targetBrand}
          competitors={competitors}
          brandMetricsOverride={activeMetricsMap}
          onSelectCategory={cat => onNavigateToPrompts(cat, selectedEngine === 'all' ? undefined : selectedEngine)}
        />
      </div>

      {/* Run Comparison Modal */}
      <RunComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        runs={runs}
        targetBrand={targetBrand}
        competitors={competitors}
      />
    </div>
  );
}
