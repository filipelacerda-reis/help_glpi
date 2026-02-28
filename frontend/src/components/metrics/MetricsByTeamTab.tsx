import { MetricsResponse } from '../../types/metrics.types';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface MetricsByTeamTabProps {
  metrics: MetricsResponse;
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  backgroundColor: 'rgba(255,255,255,0.95)',
};

export const MetricsByTeamTab: React.FC<MetricsByTeamTabProps> = ({ metrics }) => {
  const navigate = useNavigate();
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

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours === 0 ? `${mins}min` : `${hours}h ${mins}min`;
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Métricas por Time</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Performance de criação, resolução e saúde operacional por equipe
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-3 pr-4">Time</th>
                <th className="py-3 pr-4">Criados</th>
                <th className="py-3 pr-4">Resolvidos</th>
                <th className="py-3 pr-4">Backlog</th>
                <th className="py-3 pr-4">MTTA</th>
                <th className="py-3 pr-4">MTTR</th>
                <th className="py-3 pr-4">% SLA</th>
                <th className="py-3 pr-0">% Reabertura</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byTeam.items.map((item) => (
                <tr
                  key={item.teamId}
                  onClick={() => navigate(`/tickets?teamId=${item.teamId}`)}
                  className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/30"
                >
                  <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                    {item.teamName}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.created}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.resolved}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.backlog}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{formatMinutes(item.mtta)}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{formatMinutes(item.mttr)}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.slaCompliancePercent.toFixed(1)}%</td>
                  <td className="py-3 pr-0 text-slate-600 dark:text-slate-300">{item.reopenRatePercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Volume por Time</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Comparativo de tickets criados e resolvidos</p>
        {metrics.byTeam.items.length > 0 ? (
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.byTeam.items} layout="vertical" margin={{ left: 12, right: 12 }}>
                <defs>
                  <linearGradient id="teamCreatedGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.55} />
                  </linearGradient>
                  <linearGradient id="teamResolvedGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.4} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis dataKey="teamName" type="category" width={140} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipThemeStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={tooltipCursor}
                />
                <Bar dataKey="created" fill="url(#teamCreatedGradient)" name="Criados" radius={[0, 4, 4, 0]} />
                <Bar dataKey="resolved" fill="url(#teamResolvedGradient)" name="Resolvidos" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum dado disponível</div>
        )}
      </section>
    </div>
  );
};
