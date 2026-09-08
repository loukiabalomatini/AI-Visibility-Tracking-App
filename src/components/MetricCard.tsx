import React from 'react';

interface MetricCardProps {
  id?: string;
  title: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  delta?: {
    value: number;
    label: string;
    isPositiveGood?: boolean;
  };
  highlight?: boolean;
  tooltip?: string;
}

export function MetricCard({
  id,
  title,
  value,
  sublabel,
  icon,
  delta,
  highlight = false,
  tooltip,
}: MetricCardProps) {
  return (
    <div
      id={id}
      className={`relative p-5 rounded-2xl border transition-all ${
        highlight
          ? 'bg-gradient-to-b from-indigo-50/50 to-white border-indigo-200/80 shadow-sm'
          : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5" title={tooltip}>
          {title}
        </span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </div>

        {delta && delta.value !== 0 && (
          <div
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              delta.value > 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {delta.value > 0 ? `+${delta.value}` : delta.value}%
          </div>
        )}
      </div>

      {sublabel && (
        <p className="mt-1.5 text-xs text-slate-500 line-clamp-1">
          {sublabel}
        </p>
      )}
    </div>
  );
}
