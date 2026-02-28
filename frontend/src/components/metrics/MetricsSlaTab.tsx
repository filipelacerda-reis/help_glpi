import { MetricsResponse } from '../../types/metrics.types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle, XCircle } from 'lucide-react';

interface MetricsSlaTabProps {
  metrics: MetricsResponse;
}

const DONUT_COLORS = ['#10b981', '#f43f5e'];

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  backgroundColor: 'rgba(255,255,255,0.95)',
};

export const MetricsSlaTab: React.FC<MetricsSlaTabProps> = ({ metrics }) => {
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

  const targetCompliance = metrics.sla.targetCompliance || 98.5;
  const isSloMet = (metrics.sla.sloStatus || 'NOT_MET') === 'MET';

  const slaData = [
    { name: 'Dentro do SLA', value: metrics.sla.globalCompliancePercent },
    { name: 'Fora do SLA', value: Math.max(0, 100 - metrics.sla.globalCompliancePercent) },
  ];

  const bucketLabel: Record<string, string> = {
    UP_TO_1H: 'Até 1h',
    BETWEEN_1H_4H: '1h - 4h',
    MORE_THAN_4H: 'Mais de 4h',
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Compliance Global de SLA</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Acompanhamento do cumprimento geral dos acordos</p>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              isSloMet
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
            }`}
          >
            {isSloMet ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            SLO {isSloMet ? 'Atingido' : 'Não Atingido'}
          </div>
        </div>

        <div className="mb-4 text-center">
          <p className={`text-5xl font-bold ${isSloMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {metrics.sla.globalCompliancePercent.toFixed(1)}%
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Meta SLO: {targetCompliance.toFixed(1)}%</p>
        </div>

        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slaData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {slaData.map((_, index) => (
                  <Cell key={`sla-donut-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipThemeStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">SLA por Prioridade</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Comparativo de compliance contra a meta</p>
        {metrics.sla.byPriority.length > 0 ? (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.sla.byPriority}>
                <defs>
                  <linearGradient id="slaPriorityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.4} />
                <XAxis dataKey="priority" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipThemeStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={tooltipCursor}
                />
                <ReferenceLine y={targetCompliance} stroke="#f43f5e" strokeDasharray="6 4" />
                <Bar dataKey="compliancePercent" fill="url(#slaPriorityGradient)" radius={[6, 6, 0, 0]} name="% Compliance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum dado disponível</div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">SLA por Time</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Situação de conformidade por equipe</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-3 pr-4">Time</th>
                <th className="py-3 pr-4">% SLA</th>
                <th className="py-3 pr-4">Total</th>
                <th className="py-3 pr-0">Fora de SLA</th>
              </tr>
            </thead>
            <tbody>
              {metrics.sla.byTeam.map((item) => (
                <tr
                  key={item.teamId}
                  className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/30"
                >
                  <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">{item.teamName}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.compliancePercent.toFixed(1)}%</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.total}</td>
                  <td className="py-3 pr-0 text-rose-600 dark:text-rose-300">{item.outOfSla}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Violações por Tempo</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Faixas de atraso mais recorrentes</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {metrics.sla.violationBuckets.map((bucket) => (
            <div
              key={bucket.bucket}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-center dark:border-slate-700 dark:bg-slate-900/30"
            >
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{bucket.count}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{bucketLabel[bucket.bucket] || bucket.bucket}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
