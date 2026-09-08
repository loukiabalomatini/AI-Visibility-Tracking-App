import { AnalysisRun, AIProviderId } from '../types';
import { Sparkles, Trophy, CheckCircle2, Percent, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';

interface EngineComparisonSectionProps {
  run: AnalysisRun;
  targetBrand: string;
  competitors: string[];
  onSelectEngineFilter?: (engine: AIProviderId | 'all') => void;
  onNavigateToPrompts?: (category?: string, provider?: AIProviderId) => void;
}

interface EngineMeta {
  id: AIProviderId;
  name: string;
  providerCompany: string;
  badgeColor: string;
}

const ENGINES: EngineMeta[] = [
  { id: 'gemini', name: 'Google Gemini', providerCompany: 'Google', badgeColor: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  { id: 'claude', name: 'Anthropic Claude', providerCompany: 'Anthropic', badgeColor: 'border-amber-200 bg-amber-50 text-amber-700' },
  { id: 'openai', name: 'OpenAI ChatGPT', providerCompany: 'OpenAI', badgeColor: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
];

export function EngineComparisonSection({
  run,
  targetBrand,
  competitors,
  onSelectEngineFilter,
  onNavigateToPrompts,
}: EngineComparisonSectionProps) {
  const allBrands = [targetBrand, ...competitors];
  const providerMetrics = run.providerMetrics || {};

  // For each engine, get target brand metrics and total completed queries
  const engineStats = ENGINES.map(eng => {
    const metricsMap = providerMetrics[eng.id] || {};
    const targetM = metricsMap[targetBrand] || {
      visibilityScore: 0,
      mentionRate: 0,
      recommendationRate: 0,
      averagePosition: null,
      totalMentions: 0,
      totalRecommended: 0,
    };

    const completedInEngine = run.promptResults?.filter(
      p => (p.provider || 'gemini').toLowerCase() === eng.id && p.status === 'completed'
    ).length || 0;

    const failedInEngine = run.promptResults?.filter(
      p => (p.provider || 'gemini').toLowerCase() === eng.id && p.status === 'failed'
    ).length || 0;

    // Leaderboard in this engine
    const leaderboard = allBrands
      .map(b => ({
        name: b,
        isTarget: b.toLowerCase() === targetBrand.toLowerCase(),
        score: metricsMap[b]?.visibilityScore || 0,
        mentionRate: metricsMap[b]?.mentionRate || 0,
        recommendationRate: metricsMap[b]?.recommendationRate || 0,
        averagePosition: metricsMap[b]?.averagePosition || null,
      }))
      .sort((a, b) => b.score - a.score);

    const targetRank = leaderboard.findIndex(b => b.isTarget) + 1;

    return {
      ...eng,
      metrics: targetM,
      completed: completedInEngine,
      failed: failedInEngine,
      leaderboard,
      targetRank: targetRank > 0 ? targetRank : '-',
      model: run.providerModels?.[eng.id] || (eng.id === 'gemini' ? 'gemini-flash-latest' : eng.id === 'claude' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o'),
    };
  });

  // Calculate comparative insights
  const enginesWithCompleted = engineStats.filter(e => e.completed > 0);
  const highestVisibilityEngine = [...enginesWithCompleted].sort(
    (a, b) => b.metrics.visibilityScore - a.metrics.visibilityScore
  )[0];

  const highestMentionEngine = [...enginesWithCompleted].sort(
    (a, b) => b.metrics.mentionRate - a.metrics.mentionRate
  )[0];

  const highestRecommendEngine = [...enginesWithCompleted].sort(
    (a, b) => b.metrics.recommendationRate - a.metrics.recommendationRate
  )[0];

  // Find divergence / discrepancy prompts (e.g. mentioned in one engine, but missed in another)
  const promptDiscrepancies: { promptText: string; geminiStatus: string; claudeStatus: string; openaiStatus: string }[] = [];
  
  if (run.promptResults && run.promptResults.length > 0) {
    const promptMap = new Map<string, { promptText: string; results: Record<string, any> }>();
    for (const pr of run.promptResults) {
      if (!promptMap.has(pr.promptId)) {
        promptMap.set(pr.promptId, { promptText: pr.promptText, results: {} });
      }
      promptMap.get(pr.promptId)!.results[(pr.provider || 'gemini').toLowerCase()] = pr;
    }

    for (const [, item] of promptMap.entries()) {
      const g = item.results.gemini?.brands?.find((b: any) => b.name.toLowerCase() === targetBrand.toLowerCase());
      const c = item.results.claude?.brands?.find((b: any) => b.name.toLowerCase() === targetBrand.toLowerCase());
      const o = item.results.openai?.brands?.find((b: any) => b.name.toLowerCase() === targetBrand.toLowerCase());

      const gMentioned = Boolean(g?.mentioned);
      const cMentioned = Boolean(c?.mentioned);
      const oMentioned = Boolean(o?.mentioned);

      // If there's divergence (not all true and not all false)
      const count = [gMentioned, cMentioned, oMentioned].filter(Boolean).length;
      if (count > 0 && count < 3 && (item.results.gemini?.status === 'completed' || item.results.claude?.status === 'completed' || item.results.openai?.status === 'completed')) {
        promptDiscrepancies.push({
          promptText: item.promptText,
          geminiStatus: gMentioned ? (g?.explicit_position ? `#${g.explicit_position}` : 'Mentioned') : 'Not mentioned',
          claudeStatus: cMentioned ? (c?.explicit_position ? `#${c.explicit_position}` : 'Mentioned') : 'Not mentioned',
          openaiStatus: oMentioned ? (o?.explicit_position ? `#${o.explicit_position}` : 'Mentioned') : 'Not mentioned',
        });
      }
    }
  }

  const overallScore = run.brandMetrics?.[targetBrand]?.visibilityScore ?? 0;

  return (
    <div id="engine-comparison-section" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              AI Visibility by Engine: Gemini vs Claude vs OpenAI
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-engine comparison showing where <strong>{targetBrand}</strong> is cited, recommended, and ranked.
          </p>
        </div>

        {onSelectEngineFilter && (
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-500 font-medium mr-1">Filter View:</span>
            <button
              onClick={() => onSelectEngineFilter('all')}
              className="px-2.5 py-1 rounded-lg font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
            >
              All
            </button>
            {ENGINES.map(e => (
              <button
                key={e.id}
                onClick={() => onSelectEngineFilter(e.id)}
                className="px-2.5 py-1 rounded-lg font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
              >
                {e.name.split(' ')[1] || e.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Side-by-Side Engine Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Benchmark */}
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">Overall AI Score</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                Weighted
              </span>
            </div>
            <div className="mt-3 flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold text-indigo-900">{overallScore}</span>
              <span className="text-xs text-indigo-600 font-medium">/ 100</span>
            </div>
            <p className="text-[11px] text-indigo-800/80 mt-1">
              Combined visibility across all {run.completedPrompts} evaluated responses.
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-indigo-100 text-[11px] text-indigo-900 flex justify-between">
            <span>Target Rank:</span>
            <strong>#{run.brandMetrics?.[targetBrand]?.isTarget ? '1' : 'Tracked'}</strong>
          </div>
        </div>

        {/* Engine 1: Gemini */}
        {engineStats.map(eng => {
          return (
            <div
              key={eng.id}
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{eng.name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${eng.badgeColor}`}>
                    Rank #{eng.targetRank}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline space-x-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {eng.metrics.visibilityScore}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ 100</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>Mention Rate:</span>
                    <strong className="text-slate-900">{eng.metrics.mentionRate}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Recommend Rate:</span>
                    <strong className="text-slate-900">{eng.metrics.recommendationRate}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Explicit Pos:</span>
                    <strong className="text-slate-900">
                      {eng.metrics.averagePosition ? `#${eng.metrics.averagePosition}` : 'None'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                <span>{eng.completed} completed</span>
                <span className="truncate max-w-[100px]" title={eng.model}>{eng.model}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comprehensive Engine Comparison Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Engine Metric Breakdown for {targetBrand}
          </h4>
          <span className="text-[11px] text-slate-500">
            Real model responses analyzed per prompt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">AI Engine</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3 text-center">Visibility Score</th>
                <th className="py-2.5 px-3 text-center">Rank</th>
                <th className="py-2.5 px-3 text-center">Mention Rate</th>
                <th className="py-2.5 px-3 text-center">Recommend Rate</th>
                <th className="py-2.5 px-3 text-center">Avg Position</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {engineStats.map(eng => {
                return (
                  <tr key={eng.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${eng.id === 'gemini' ? 'bg-indigo-500' : eng.id === 'claude' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <span>{eng.name}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      {eng.model}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-extrabold text-sm text-slate-900">{eng.metrics.visibilityScore}</span>
                      <span className="text-[10px] text-slate-400">/100</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-slate-800">#{eng.targetRank}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-semibold text-slate-700">{eng.metrics.mentionRate}%</span>
                      <span className="text-[10px] text-slate-400 block">({eng.metrics.totalMentions} hits)</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-semibold text-slate-700">{eng.metrics.recommendationRate}%</span>
                      <span className="text-[10px] text-slate-400 block">({eng.metrics.totalRecommended} recs)</span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-700">
                      {eng.metrics.averagePosition ? `#${eng.metrics.averagePosition}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {eng.completed > 0 ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{eng.completed} done</span>
                        </span>
                      ) : eng.failed > 0 ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-medium border border-rose-200">
                          <span>{eng.failed} failed</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Competitor Leaderboards by Engine */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
          Competitor Rankings Across Engines
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {engineStats.map(eng => {
            return (
              <div key={eng.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                  <span className="font-bold text-xs text-slate-900">{eng.name}</span>
                  <span className="text-[10px] text-slate-400">{eng.completed} prompts</span>
                </div>

                <div className="space-y-2">
                  {eng.leaderboard.map((item, rIdx) => {
                    return (
                      <div
                        key={item.name}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                          item.isTarget
                            ? 'bg-indigo-100/70 text-indigo-950 font-bold'
                            : 'bg-white text-slate-700 border border-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 w-4">#{rIdx + 1}</span>
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 shrink-0">
                          {item.score}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Engine Discrepancy & Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Key Visibility Observations */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span>Cross-Engine Visibility Takeaways</span>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
              <span className="font-bold text-slate-900">Highest Visibility Engine: </span>
              {highestVisibilityEngine ? (
                <span>
                  <strong>{highestVisibilityEngine.name}</strong> with a score of{' '}
                  <strong className="text-indigo-600">{highestVisibilityEngine.metrics.visibilityScore}</strong> (Rank #{highestVisibilityEngine.targetRank}).
                </span>
              ) : (
                'Pending data'
              )}
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
              <span className="font-bold text-slate-900">Most Frequent Mentions: </span>
              {highestMentionEngine ? (
                <span>
                  <strong>{highestMentionEngine.name}</strong> mentions {targetBrand} in{' '}
                  <strong className="text-indigo-600">{highestMentionEngine.metrics.mentionRate}%</strong> of responses.
                </span>
              ) : (
                'Pending data'
              )}
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
              <span className="font-bold text-slate-900">Strongest Recommendations: </span>
              {highestRecommendEngine ? (
                <span>
                  <strong>{highestRecommendEngine.name}</strong> recommends {targetBrand} in{' '}
                  <strong className="text-indigo-600">{highestRecommendEngine.metrics.recommendationRate}%</strong> of answers.
                </span>
              ) : (
                'Pending data'
              )}
            </div>
          </div>
        </div>

        {/* Engine Discrepancy / Gap Analysis */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Engine Divergence & Content Gaps</span>
          </div>

          {promptDiscrepancies.length > 0 ? (
            <div className="space-y-2 text-xs">
              <p className="text-[11px] text-slate-500">
                Prompts where {targetBrand} appears in some AI engines but is missing in others:
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {promptDiscrepancies.slice(0, 4).map((d, i) => (
                  <div key={i} className="p-2 bg-white rounded-lg border border-slate-200 text-[11px]">
                    <div className="font-medium text-slate-900 truncate mb-1">"{d.promptText}"</div>
                    <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                      <span>Gemini: <strong className={d.geminiStatus !== 'Not mentioned' ? 'text-indigo-600' : 'text-slate-400'}>{d.geminiStatus}</strong></span>
                      <span>•</span>
                      <span>Claude: <strong className={d.claudeStatus !== 'Not mentioned' ? 'text-amber-600' : 'text-slate-400'}>{d.claudeStatus}</strong></span>
                      <span>•</span>
                      <span>OpenAI: <strong className={d.openaiStatus !== 'Not mentioned' ? 'text-emerald-600' : 'text-slate-400'}>{d.openaiStatus}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
              No significant divergence found across completed engines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
