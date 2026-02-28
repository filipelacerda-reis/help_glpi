import { MetricsResponse } from '../../types/metrics.types';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface MetricsByTechnicianTabProps {
  metrics: MetricsResponse;
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  backgroundColor: 'rgba(255,255,255,0.95)',
};

export const MetricsByTechnicianTab: React.FC<MetricsByTechnicianTabProps> = ({ metrics }) => {
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

  const topTechnicians = [...metrics.byTechnician.items]
    .sort((a, b) => b.resolved - a.resolved)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Métricas por Técnico</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Produtividade e eficiência por analista</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-3 pr-4">Técnico</th>
                <th className="py-3 pr-4">Time</th>
                <th className="py-3 pr-4">Atribuídos</th>
                <th className="py-3 pr-4">Resolvidos</th>
                <th className="py-3 pr-4">Backlog</th>
                <th className="py-3 pr-4">MTTA</th>
                <th className="py-3 pr-4">MTTR</th>
                <th className="py-3 pr-0">% SLA</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byTechnician.items.map((item) => (
                <tr
                  key={item.technicianId}
                  onClick={() => navigate(`/tickets?assignedTechnicianId=${item.technicianId}`)}
                  className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/30"
                >
                  <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">{item.technicianName}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.teamName || '-'}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.assigned}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.resolved}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.backlog}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{formatMinutes(item.mtta)}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{formatMinutes(item.mttr)}</td>
                  <td className="py-3 pr-0 text-slate-600 dark:text-slate-300">{item.slaCompliancePercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Top 10 por Resolução</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Técnicos com maior volume de chamados resolvidos</p>
        {topTechnicians.length > 0 ? (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTechnicians} layout="vertical" margin={{ left: 24, right: 12 }}>
                <defs>
                  <linearGradient id="techResolvedGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.4} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis dataKey="technicianName" type="category" width={150} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipThemeStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={tooltipCursor}
                />
                <Bar dataKey="resolved" fill="url(#techResolvedGradient)" name="Resolvidos" radius={[0, 4, 4, 0]} />
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
