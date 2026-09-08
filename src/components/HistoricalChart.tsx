import { useState } from 'react';
import { AnalysisRun, AIProviderId } from '../types';
import { TrendingUp, GitCompare } from 'lucide-react';

interface HistoricalChartProps {
  runs: AnalysisRun[];
  targetBrand: string;
  competitors: string[];
  activeRunId: string | null;
  onSelectRun: (runId: string) => void;
  onOpenCompare: () => void;
  engineFilter?: AIProviderId | 'all';
  onEngineFilterChange?: (engine: AIProviderId | 'all') => void;
}

export function HistoricalChart({
  runs,
  targetBrand,
  competitors,
  activeRunId,
  onSelectRun,
  onOpenCompare,
  engineFilter = 'all',
  onEngineFilterChange,
}: HistoricalChartProps) {
  const [showAllBrands, setShowAllBrands] = useState<boolean>(false);
  const [internalEngineFilter, setInternalEngineFilter] = useState<AIProviderId | 'all'>(engineFilter);

  const activeFilter = onEngineFilterChange ? engineFilter : internalEngineFilter;
  const setFilter = onEngineFilterChange || setInternalEngineFilter;

  const [hoveredPoint, setHoveredPoint] = useState<{
    runId: string;
    score: number;
    date: string;
    brand: string;
    x: number;
    y: number;
  } | null>(null);

  // Sort chronological
  const sortedRuns = [...runs]
    .filter(r => r.status === 'completed' || r.completedPrompts > 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (sortedRuns.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <TrendingUp className="w-8 h-8 mx-auto text-slate-400 mb-2" />
        <h4 className="text-sm font-semibold text-slate-700">No historical runs yet</h4>
        <p className="text-xs text-slate-500 mt-1">
          Execute your first prompt analysis to start tracking visibility trends over time.
        </p>
      </div>
    );
  }

  const allTrackedBrands = [targetBrand, ...competitors];
  const chartHeight = 180;
  const chartWidth = 560;
  const paddingX = 40;
  const paddingY = 25;

  const getPointsForBrand = (brandName: string) => {
    return sortedRuns.map((run, idx) => {
      let score = 0;
      if (activeFilter === 'all') {
        score = run.brandMetrics?.[brandName]?.visibilityScore ?? 0;
      } else {
        score = run.providerMetrics?.[activeFilter]?.[brandName]?.visibilityScore ?? 0;
      }

      const x =
        sortedRuns.length === 1
          ? chartWidth / 2
          : paddingX + (idx / (sortedRuns.length - 1)) * (chartWidth - paddingX * 2);
      const y = chartHeight - paddingY - (score / 100) * (chartHeight - paddingY * 2);
      return { x, y, score, run, brandName };
    });
  };

  const brandColors: Record<string, string> = {
    [targetBrand]: '#4f46e5', // indigo
    CallRail: '#0284c7', // sky
    WhatConverts: '#059669', // emerald
    CallTrackingMetrics: '#d97706', // amber
    Invoca: '#dc2626', // rose
  };

  const getBrandColor = (b: string) => {
    return brandColors[b] || '#64748b';
  };

  return (
    <div id="historical-chart-card" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">AI Visibility Trend Over Time</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
              {sortedRuns.length} {sortedRuns.length === 1 ? 'Run' : 'Runs'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Historical visibility score ({activeFilter === 'all' ? 'All Engines Combined' : activeFilter}) across audit dates
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Engine Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            {(['all', 'gemini', 'claude', 'openai'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  activeFilter === f
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f === 'all' ? 'All' : f === 'gemini' ? 'Gemini' : f === 'claude' ? 'Claude' : 'OpenAI'}
              </button>
            ))}
          </div>

          {/* Toggle show all brands */}
          <button
            id="toggle-all-competitors-btn"
            onClick={() => setShowAllBrands(!showAllBrands)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
              showAllBrands
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showAllBrands ? 'Target Only' : 'Competitors'}
          </button>

          <button
            id="open-run-compare-btn"
            onClick={onOpenCompare}
            disabled={sortedRuns.length < 2}
            className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <GitCompare className="w-3.5 h-3.5 text-slate-600" />
            <span>Compare</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-48 select-none overflow-visible"
        >
          {/* Background Grid Lines */}
          {[0, 25, 50, 75, 100].map(val => {
            const y = chartHeight - paddingY - (val / 100) * (chartHeight - paddingY * 2);
            return (
              <g key={val}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="500"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Lines for brands */}
          {(showAllBrands ? allTrackedBrands : [targetBrand]).map(bName => {
            const points = getPointsForBrand(bName);
            const isTarget = bName.toLowerCase() === targetBrand.toLowerCase();
            const color = getBrandColor(bName);

            if (points.length === 0) return null;

            const pathD = points.reduce((acc, pt, idx) => {
              return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
            }, '');

            return (
              <g key={bName}>
                {/* Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth={isTarget ? '3' : '1.5'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isTarget ? 1 : 0.65}
                />

                {/* Points */}
                {points.map((pt, idx) => {
                  const isActive = pt.run.id === activeRunId;
                  return (
                    <circle
                      key={`${bName}-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={isActive ? (isTarget ? 6 : 4) : isTarget ? 4.5 : 3}
                      fill={isActive ? '#ffffff' : color}
                      stroke={color}
                      strokeWidth={isActive ? 3 : 2}
                      className="cursor-pointer transition-all hover:scale-125"
                      onMouseEnter={() =>
                        setHoveredPoint({
                          runId: pt.run.id,
                          score: pt.score,
                          date: new Date(pt.run.timestamp).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          }),
                          brand: bName,
                          x: pt.x,
                          y: pt.y,
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() => onSelectRun(pt.run.id)}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X Axis Run Labels */}
          {sortedRuns.map((run, idx) => {
            const x =
              sortedRuns.length === 1
                ? chartWidth / 2
                : paddingX + (idx / (sortedRuns.length - 1)) * (chartWidth - paddingX * 2);
            const dateStr = new Date(run.timestamp).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            const isActive = run.id === activeRunId;

            return (
              <g key={run.id} className="cursor-pointer" onClick={() => onSelectRun(run.id)}>
                <text
                  x={x}
                  y={chartHeight - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isActive ? '700' : '500'}
                  fill={isActive ? '#4f46e5' : '#64748b'}
                >
                  {dateStr}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-10 pointer-events-none px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg shadow-lg"
            style={{
              left: `${(hoveredPoint.x / chartWidth) * 100}%`,
              top: `${hoveredPoint.y - 40}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold text-slate-100">{hoveredPoint.brand}</div>
            <div className="text-[11px] text-slate-300">
              Score: <span className="font-bold text-white">{hoveredPoint.score}</span> / 100 ({hoveredPoint.date})
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
            <span className="font-bold text-slate-800">{targetBrand} (Target)</span>
          </div>
          {showAllBrands &&
            competitors.map(c => (
              <div key={c} className="flex items-center space-x-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: getBrandColor(c) }}
                />
                <span className="text-slate-600">{c}</span>
              </div>
            ))}
        </div>

        <span className="text-[11px] text-slate-400">Click any date node to load that run</span>
      </div>
    </div>
  );
}
