import { AnalysisRun } from '../types';
import { Layers, ArrowUpRight } from 'lucide-react';

interface CategoryBreakdownProps {
  run: AnalysisRun | null;
  targetBrand: string;
  competitors: string[];
  brandMetricsOverride?: Record<string, any>;
  onSelectCategory?: (category: string) => void;
}

export function CategoryBreakdown({
  run,
  targetBrand,
  competitors,
  brandMetricsOverride,
  onSelectCategory,
}: CategoryBreakdownProps) {
  if (!run) {
    return null;
  }

  const activeMetrics = brandMetricsOverride || run.brandMetrics || {};
  const targetMetrics = activeMetrics[targetBrand];
  const categoryScores = targetMetrics?.categoryScores || {};
  const categories = Object.keys(categoryScores);

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">Visibility by Prompt Category</h3>
        <p className="text-xs text-slate-500 mt-1">No categorized results available for this selection.</p>
      </div>
    );
  }

  // Calculate top competitor per category
  const categoryStats = categories.map(cat => {
    const targetScore = categoryScores[cat] || 0;
    let topCompetitorName = '';
    let topCompetitorScore = -1;

    competitors.forEach(c => {
      const cScore = activeMetrics[c]?.categoryScores?.[cat] || 0;
      if (cScore > topCompetitorScore) {
        topCompetitorScore = cScore;
        topCompetitorName = c;
      }
    });

    const promptCount = run.promptResults.filter(p => p.category === cat).length;

    return {
      category: cat,
      targetScore,
      topCompetitorName,
      topCompetitorScore: Math.max(0, topCompetitorScore),
      promptCount,
    };
  });

  return (
    <div id="category-breakdown-card" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Visibility by Prompt Category</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare how {targetBrand} performs across distinct query intents
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {categoryStats.map(stat => {
          const isTargetWinning = stat.targetScore >= stat.topCompetitorScore;
          return (
            <div
              key={stat.category}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-slate-50/70 px-2 -mx-2 rounded-xl transition-colors"
            >
              <div className="min-w-[140px]">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900">{stat.category}</span>
                  <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.2 rounded bg-slate-100">
                    {stat.promptCount} {stat.promptCount === 1 ? 'prompt' : 'prompts'}
                  </span>
                </div>
                {stat.topCompetitorName && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Top rival: <span className="font-medium text-slate-700">{stat.topCompetitorName}</span> ({stat.topCompetitorScore})
                  </p>
                )}
              </div>

              {/* Visual Score Bars */}
              <div className="flex-1 max-w-sm flex items-center gap-3">
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, stat.targetScore)}%` }}
                    title={`${targetBrand}: ${stat.targetScore}`}
                  />
                </div>
                <div className="w-12 text-right">
                  <span className="text-xs font-bold text-slate-900">{stat.targetScore}</span>
                  <span className="text-[10px] text-slate-400">/100</span>
                </div>
              </div>

              {/* Status pill & Drilldown */}
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                    isTargetWinning
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {isTargetWinning ? 'Leader' : 'Opportunity'}
                </span>

                {onSelectCategory && (
                  <button
                    onClick={() => onSelectCategory(stat.category)}
                    className="text-slate-400 hover:text-indigo-600 p-1 rounded-md transition-colors"
                    title={`Filter prompt results for ${stat.category}`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
