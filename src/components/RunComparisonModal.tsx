import { useState } from 'react';
import { AnalysisRun, AIProviderId } from '../types';
import { X, ArrowRight, TrendingUp, TrendingDown, Minus, Cpu } from 'lucide-react';

interface RunComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  runs: AnalysisRun[];
  targetBrand: string;
  competitors: string[];
}

export function RunComparisonModal({
  isOpen,
  onClose,
  runs,
  targetBrand,
  competitors,
}: RunComparisonModalProps) {
  if (!isOpen || runs.length < 2) return null;

  const sorted = [...runs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const [runAId, setRunAId] = useState<string>(sorted[0].id);
  const [runBId, setRunBId] = useState<string>(sorted[sorted.length - 1].id);
  const [engineFilter, setEngineFilter] = useState<AIProviderId | 'all'>('all');

  const runA = runs.find(r => r.id === runAId) || sorted[0];
  const runB = runs.find(r => r.id === runBId) || sorted[sorted.length - 1];

  const allBrands = [targetBrand, ...competitors];

  const getMetricsMap = (run: AnalysisRun) => {
    if (engineFilter === 'all') return run.brandMetrics || {};
    return run.providerMetrics?.[engineFilter] || run.brandMetrics || {};
  };

  const metricsA = getMetricsMap(runA);
  const metricsB = getMetricsMap(runB);

  const getDeltaBadge = (valA: number, valB: number, suffix = '') => {
    const diff = Math.round((valB - valA) * 10) / 10;
    if (diff > 0) {
      return (
        <span className="inline-flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-semibold">
          <TrendingUp className="w-3 h-3 mr-1" />
          +{diff}
          {suffix}
        </span>
      );
    }
    if (diff < 0) {
      return (
        <span className="inline-flex items-center text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-xs font-semibold">
          <TrendingDown className="w-3 h-3 mr-1" />
          {diff}
          {suffix}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-semibold">
        <Minus className="w-3 h-3 mr-1" />
        0{suffix}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900">Run vs. Run Comparison</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Analyze changes in AI visibility, mention frequency, and rankings across engine audits
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine Switcher */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-semibold text-slate-700">Compare Engine:</span>
          </div>
          <div className="flex items-center space-x-1">
            {(['all', 'gemini', 'claude', 'openai'] as const).map(ef => (
              <button
                key={ef}
                onClick={() => setEngineFilter(ef)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  engineFilter === ef
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ef === 'all' ? 'All Combined' : ef === 'gemini' ? 'Gemini' : ef === 'claude' ? 'Claude' : 'OpenAI'}
              </button>
            ))}
          </div>
        </div>

        {/* Run Selector Controls */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Run A (Baseline)
            </label>
            <select
              value={runAId}
              onChange={e => setRunAId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {runs.map(r => (
                <option key={`a-${r.id}`} value={r.id}>
                  {r.name || r.id} ({new Date(r.timestamp).toLocaleDateString()}) - {r.totalPrompts} prompts
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Run B (Comparison)
            </label>
            <select
              value={runBId}
              onChange={e => setRunBId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {runs.map(r => (
                <option key={`b-${r.id}`} value={r.id}>
                  {r.name || r.id} ({new Date(r.timestamp).toLocaleDateString()}) - {r.totalPrompts} prompts
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Target Brand Key Metrics Comparison */}
          <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100">
            <h4 className="text-xs font-bold tracking-wide uppercase text-indigo-900 mb-3">
              {targetBrand} (Target Brand) Metric Deltas ({engineFilter.toUpperCase()})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-indigo-200/60 shadow-sm">
                <span className="text-xs text-slate-500">AI Visibility Score</span>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-lg">
                    <span>{metricsA[targetBrand]?.visibilityScore ?? 0}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-indigo-600 text-xl font-extrabold">
                      {metricsB[targetBrand]?.visibilityScore ?? 0}
                    </span>
                  </div>
                  {getDeltaBadge(
                    metricsA[targetBrand]?.visibilityScore ?? 0,
                    metricsB[targetBrand]?.visibilityScore ?? 0
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-indigo-200/60 shadow-sm">
                <span className="text-xs text-slate-500">Mention Rate</span>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-lg">
                    <span>{metricsA[targetBrand]?.mentionRate ?? 0}%</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-indigo-600 text-xl font-extrabold">
                      {metricsB[targetBrand]?.mentionRate ?? 0}%
                    </span>
                  </div>
                  {getDeltaBadge(
                    metricsA[targetBrand]?.mentionRate ?? 0,
                    metricsB[targetBrand]?.mentionRate ?? 0,
                    '%'
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-indigo-200/60 shadow-sm">
                <span className="text-xs text-slate-500">Recommendation Rate</span>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-lg">
                    <span>{metricsA[targetBrand]?.recommendationRate ?? 0}%</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-indigo-600 text-xl font-extrabold">
                      {metricsB[targetBrand]?.recommendationRate ?? 0}%
                    </span>
                  </div>
                  {getDeltaBadge(
                    metricsA[targetBrand]?.recommendationRate ?? 0,
                    metricsB[targetBrand]?.recommendationRate ?? 0,
                    '%'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Competitor Shift Table */}
          <div>
            <h4 className="text-xs font-bold tracking-wide uppercase text-slate-600 mb-2">
              Full Brand Visibility Comparison
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-600 text-left">
                  <tr>
                    <th className="py-2.5 px-4">Brand</th>
                    <th className="py-2.5 px-4 text-center">Run A Visibility</th>
                    <th className="py-2.5 px-4 text-center">Run B Visibility</th>
                    <th className="py-2.5 px-4 text-center">Score Delta</th>
                    <th className="py-2.5 px-4 text-center">Mention Rate (A → B)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {allBrands.map(brand => {
                    const isTarget = brand.toLowerCase() === targetBrand.toLowerCase();
                    const scoreA = metricsA[brand]?.visibilityScore ?? 0;
                    const scoreB = metricsB[brand]?.visibilityScore ?? 0;
                    const mentionA = metricsA[brand]?.mentionRate ?? 0;
                    const mentionB = metricsB[brand]?.mentionRate ?? 0;

                    return (
                      <tr key={brand} className={isTarget ? 'bg-indigo-50/40 font-semibold' : ''}>
                        <td className="py-3 px-4 flex items-center space-x-2">
                          <span className="text-slate-900">{brand}</span>
                          {isTarget && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold">
                              Target
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-700">{scoreA}</td>
                        <td className="py-3 px-4 text-center text-slate-900 font-bold">{scoreB}</td>
                        <td className="py-3 px-4 text-center">{getDeltaBadge(scoreA, scoreB)}</td>
                        <td className="py-3 px-4 text-center text-slate-600">
                          {mentionA}% → {mentionB}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
