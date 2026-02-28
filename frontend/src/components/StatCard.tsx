import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trendText: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  progress?: number;
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  trendText,
  trendDirection = 'neutral',
  progress = 0,
}: StatCardProps) => {
  const trendColor =
    trendDirection === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trendDirection === 'down'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-500 dark:text-slate-400';

  const progressColor =
    trendDirection === 'up'
      ? 'bg-emerald-500'
      : trendDirection === 'down'
      ? 'bg-rose-500'
      : 'bg-indigo-500';

  return (
    <article
      className="
        rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]
        transition-all duration-200 hover:-translate-y-1 hover:shadow-lg
        dark:border-slate-700 dark:bg-slate-800
      "
    >
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
        </div>

        <div className="rounded-full bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          <Icon className="h-5 w-5" />
        </div>
      </header>

      <div className="mb-3 flex items-center gap-1.5">
        {trendDirection === 'up' ? (
          <ArrowUpRight className={`h-4 w-4 ${trendColor}`} />
        ) : trendDirection === 'down' ? (
          <ArrowDownRight className={`h-4 w-4 ${trendColor}`} />
        ) : null}
        <span className={`text-sm font-semibold ${trendColor}`}>{trendText}</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-full rounded-full ${progressColor} transition-all duration-300`}
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </article>
  );
};

export default StatCard;
