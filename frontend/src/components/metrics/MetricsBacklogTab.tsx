import { MetricsResponse } from '../../types/metrics.types';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';

interface MetricsBacklogTabProps {
  metrics: MetricsResponse;
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  backgroundColor: 'rgba(255,255,255,0.95)',
};

export const MetricsBacklogTab: React.FC<MetricsBacklogTabProps> = ({ metrics }) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const tooltipThemeStyle = {
    ...tooltipStyle,
    border: isDark ? '1px solid #334155' : tooltipStyle.border,
    backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : tooltipStyle.backgroundColor,
  };
  const tooltipLabelStyle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const tooltipItemStyle = { color: isDark ? '#f8fafc' : '#0f172a' };
  const tooltipCursor = {
    fill: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
    stroke: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(99,102,241,0.2)',
    strokeWidth: 1,
  };

  const formatAge = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    return days === 0 ? `${hours}h` : `${days}d ${hours}h`;
  };

  const ageBucketLabels: Record<string, string> = {
    '0_8H': '0-8h',
    '8H_24H': '8-24h',
    '1_3D': '1-3 dias',
    '3_7D': '3-7 dias',
    GT_7D: '>7 dias',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Backlog Total</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.backlog.totalOpen}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Idade Média do Backlog</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatAge(metrics.backlog.avgAgeMinutes)}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Tendência de Backlog</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Evolução diária de criados vs resolvidos</p>
        {metrics.overview.trendCreatedVsResolved.length > 0 ? (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.overview.trendCreatedVsResolved}>
                <defs>
                  <linearGradient id="backlogCreatedArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.06} />
                  </linearGradient>
                  <linearGradient id="backlogResolvedArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.4} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipThemeStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={tooltipCursor}
                />
                <Area type="monotone" dataKey="created" stroke="#4f46e5" fill="url(#backlogCreatedArea)" strokeWidth={2} name="Criados" />
                <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="url(#backlogResolvedArea)" strokeWidth={2} name="Resolvidos" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum dado disponível</div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Backlog por Idade</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Distribuição dos tickets por faixa temporal</p>
        {metrics.backlog.ageBuckets.length > 0 ? (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.backlog.ageBuckets}>
                <defs>
                  <linearGradient id="backlogAgeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.4} />
                <XAxis dataKey="bucket" tickFormatter={(value) => ageBucketLabels[value] || value} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipThemeStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={tooltipCursor}
                />
                <Bar dataKey="count" fill="url(#backlogAgeGradient)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum dado disponível</div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Tickets Mais Antigos</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Backlog crítico por idade de permanência</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-3 pr-4">ID</th>
                <th className="py-3 pr-4">Título</th>
                <th className="py-3 pr-4">Time</th>
                <th className="py-3 pr-4">Prioridade</th>
                <th className="py-3 pr-0">Idade</th>
              </tr>
            </thead>
            <tbody>
              {metrics.backlog.oldestTickets.map((ticket) => (
                <tr
                  key={ticket.ticketId}
                  className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/30"
                >
                  <td className="py-3 pr-4">
                    <Link to={`/tickets/${ticket.ticketId}`} className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                      {ticket.ticketId.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-slate-900 dark:text-slate-100">{ticket.title}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{ticket.teamName || '-'}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{ticket.priority || '-'}</td>
                  <td className="py-3 pr-0 text-slate-600 dark:text-slate-300">{formatAge(ticket.ageMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
