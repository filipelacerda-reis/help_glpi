import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, CheckCircle2, Clock3, ShieldCheck, Ticket, Zap } from 'lucide-react';
import type { MetricsFilters, MetricsResponse } from '../../types/metrics.types';
import StatCard from '../StatCard';

interface MetricsOverviewTabProps {
  metrics: MetricsResponse;
  filters: MetricsFilters;
}

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b'];

const formatMinutes = (minutes: number | null) => {
  if (minutes === null) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hours === 0) return `${mins}min`;
  return `${hours}h ${mins}min`;
};

const formatWorklogDuration = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

const getTrend = (current: number, previousValue: number | null | undefined, lowerIsBetter = false) => {
  if (previousValue === null || previousValue === undefined || previousValue === 0) {
    return { text: 'Sem comparação no período', direction: 'neutral' as const };
  }

  const variation = ((current - previousValue) / previousValue) * 100;
  const absVariation = Math.abs(variation).toFixed(1);
  const better = lowerIsBetter ? variation <= 0 : variation >= 0;

  return {
    text: `${variation >= 0 ? '↑' : '↓'} ${absVariation}% vs período anterior`,
    direction: better ? ('up' as const) : ('down' as const),
  };
};

export const MetricsOverviewTab = ({ metrics, filters }: MetricsOverviewTabProps) => {
  const navigate = useNavigate();
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const comparison = metrics.comparison;
  const previous = comparison?.overview;

  const tooltipStyle = {
    borderRadius: 12,
    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
    backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
  };

  const labelStyle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const itemStyle = { color: isDark ? '#f8fafc' : '#0f172a' };
  const tooltipCursor = {
    fill: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
    stroke: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(99,102,241,0.2)',
    strokeWidth: 1,
  };

  const mttaTrend = getTrend(metrics.overview.mtta || 0, previous?.mtta, true);
  const mttrTrend = getTrend(metrics.overview.mttr || 0, previous?.mttr, true);
  const createdTrend = getTrend(metrics.overview.createdCount, previous?.createdCount);
  const resolvedTrend = getTrend(metrics.overview.resolvedCount, previous?.resolvedCount);
  const slaTrend = getTrend(metrics.overview.slaCompliancePercent, previous?.slaCompliancePercent);

  const fcrDirection: 'up' | 'down' = metrics.overview.fcrPercent >= 70 ? 'up' : 'down';

  const handlePriorityClick = (priority: string) => {
    navigate(`/tickets?priority=${priority}&startDate=${filters.startDate || ''}&endDate=${filters.endDate || ''}`);
  };

  const handleTeamClick = (teamId: string) => {
    navigate(
      `/tickets?teamSolicitanteId=${teamId}&startDate=${filters.startDate || ''}&endDate=${filters.endDate || ''}`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          title="Tickets Criados"
          value={metrics.overview.createdCount}
          icon={Ticket}
          trendText={createdTrend.text}
          trendDirection={createdTrend.direction}
          progress={Math.min(100, Math.max(0, metrics.overview.createdCount))}
        />
        <StatCard
          title="Tickets Resolvidos"
          value={metrics.overview.resolvedCount}
          icon={CheckCircle2}
          trendText={resolvedTrend.text}
          trendDirection={resolvedTrend.direction}
          progress={
            metrics.overview.createdCount > 0
              ? Math.min(100, (metrics.overview.resolvedCount / metrics.overview.createdCount) * 100)
              : 0
          }
        />
        <StatCard
          title="MTTA"
          value={formatMinutes(metrics.overview.mtta)}
          icon={Clock3}
          trendText={mttaTrend.text}
          trendDirection={mttaTrend.direction}
          progress={Math.min(100, Math.max(0, 100 - (metrics.overview.mtta || 0) / 3))}
        />
        <StatCard
          title="MTTR"
          value={formatMinutes(metrics.overview.mttr)}
          icon={Activity}
          trendText={mttrTrend.text}
          trendDirection={mttrTrend.direction}
          progress={Math.min(100, Math.max(0, 100 - (metrics.overview.mttr || 0) / 12))}
        />
        <StatCard
          title="Conformidade SLA"
          value={`${metrics.overview.slaCompliancePercent.toFixed(1)}%`}
          icon={ShieldCheck}
          trendText={slaTrend.text}
          trendDirection={slaTrend.direction}
          progress={metrics.overview.slaCompliancePercent}
        />
        <StatCard
          title="FCR"
          value={`${metrics.overview.fcrPercent.toFixed(1)}%`}
          icon={Zap}
          trendText={
            fcrDirection === 'up'
              ? 'Bom índice de resolução no primeiro contato'
              : 'Abaixo da meta recomendada (70%)'
          }
          trendDirection={fcrDirection}
          progress={metrics.overview.fcrPercent}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Tendência: Criados vs Resolvidos</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Evolução temporal dos tickets no período selecionado.</p>

        {metrics.overview.trendCreatedVsResolved.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={metrics.overview.trendCreatedVsResolved}>
              <defs>
                <linearGradient id="createdLine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="resolvedLine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.4} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} cursor={tooltipCursor} />
              <Legend />
              <Line type="monotone" dataKey="created" stroke="url(#createdLine)" strokeWidth={3} dot={false} name="Criados" />
              <Line
                type="monotone"
                dataKey="resolved"
                stroke="url(#resolvedLine)"
                strokeWidth={3}
                dot={false}
                name="Resolvidos"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400">Nenhum dado disponível</div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Distribuição por Prioridade</h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Clique em uma fatia para abrir tickets filtrados.</p>

          {metrics.overview.priorityDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={metrics.overview.priorityDistribution}
                  dataKey="count"
                  nameKey="priority"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  onClick={(data) => handlePriorityClick(data.priority)}
                  style={{ cursor: 'pointer' }}
                >
                  {metrics.overview.priorityDistribution.map((_, index) => (
                    <Cell key={`priority-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400">Nenhum dado disponível</div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Tickets por Time Solicitante</h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Top 10 times com maior volume de tickets.</p>

          {metrics.overview.ticketsByRequesterTeam.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={metrics.overview.ticketsByRequesterTeam.slice(0, 10)} layout="vertical">
                <defs>
                  <linearGradient id="teamBars" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.4} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis
                  dataKey="teamName"
                  type="category"
                  width={150}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} cursor={tooltipCursor} />
                <Bar
                  dataKey="count"
                  fill="url(#teamBars)"
                  radius={[0, 4, 4, 0]}
                  onClick={(data) => handleTeamClick(data.teamId)}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400">Nenhum dado disponível</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Distribuição de Esforço (Worklog)</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Tempo total investido por categoria no período filtrado.</p>

        {metrics.overview.worklogByCategory.length > 0 ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={metrics.overview.worklogByCategory.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 10 }}>
              <defs>
                <linearGradient id="worklogBars" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.95} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.4} />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(value) => formatWorklogDuration(Number(value))}
              />
              <YAxis
                dataKey="categoryName"
                type="category"
                width={170}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={labelStyle}
                itemStyle={itemStyle}
                cursor={tooltipCursor}
                formatter={(value: number | string) => formatWorklogDuration(Number(value))}
                labelFormatter={(label) => `Categoria: ${label}`}
              />
              <Bar dataKey="totalMinutes" name="Esforço" fill="url(#worklogBars)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400">Nenhum esforço registrado no período selecionado</div>
        )}
      </div>

      {comparison && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Comparação com Período Anterior</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Período anterior: <strong className="text-slate-900 dark:text-slate-100">{comparison.overview.createdCount}</strong> criados,{' '}
            <strong className="text-slate-900 dark:text-slate-100">{comparison.overview.resolvedCount}</strong> resolvidos e{' '}
            <strong className="text-slate-900 dark:text-slate-100">{comparison.overview.slaCompliancePercent.toFixed(1)}%</strong> de conformidade SLA.
          </p>
        </div>
      )}
    </div>
  );
};
