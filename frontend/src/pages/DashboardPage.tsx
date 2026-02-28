import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Plus, Ticket, Clock3, AlertTriangle, Smile, TrendingUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTickets } from '../hooks/queries/useTickets';
import { useStaleTickets } from '../hooks/queries/useStaleTickets';
import ModernLayout from '../components/ModernLayout';
import StatCard from '../components/StatCard';

const priorityBadgeClass: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  MEDIUM: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  HIGH: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  CRITICAL: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

const CATEGORY_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6'];

const formatMonth = (date: Date) =>
  date.toLocaleString('pt-BR', {
    month: 'short',
  });

const formatDay = (date: Date) =>
  date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

const DashboardPage = () => {
  const { data: tickets = [], isLoading, isError } = useTickets();
  const { data: staleTickets = [], isLoading: staleLoading } = useStaleTickets({
    daysThreshold: 5,
    take: 10,
  });
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d');
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);

  const rangeFilteredTickets = useMemo(() => {
    const now = Date.now();
    const rangeMs = range === 'today' ? 24 * 60 * 60 * 1000 : range === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    return tickets.filter((ticket) => new Date(ticket.createdAt).getTime() >= now - rangeMs);
  }, [range, tickets]);

  const stats = useMemo(() => {
    const open = rangeFilteredTickets.filter((t) => t.status === 'OPEN').length;
    const inProgress = rangeFilteredTickets.filter((t) => t.status === 'IN_PROGRESS').length;
    const waitingVendor = rangeFilteredTickets.filter((t) => t.status === 'WAITING_THIRD_PARTY').length;
    const resolved = rangeFilteredTickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
    const csat = resolved > 0 ? Math.min(100, Math.round(78 + resolved * 0.5)) : 78;

    return { open, inProgress, waitingVendor, csat };
  }, [rangeFilteredTickets]);

  const timelineData = useMemo(() => {
    if (range === 'today') {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);

      const points = Array.from({ length: 8 }).map((_, index) => {
        const pointDate = new Date(start.getTime() + index * 3 * 60 * 60 * 1000);
        return {
          key: `${pointDate.getFullYear()}-${pointDate.getMonth()}-${pointDate.getDate()}-${pointDate.getHours()}`,
          label: `${String(pointDate.getHours()).padStart(2, '0')}h`,
          created: 0,
          resolved: 0,
        };
      });

      const keyToIndex = new Map(points.map((point, index) => [point.key, index]));
      rangeFilteredTickets.forEach((ticket) => {
        const createdAt = new Date(ticket.createdAt);
        const createdHour = Math.floor(createdAt.getHours() / 3) * 3;
        const createdKey = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}-${createdHour}`;
        const createdIdx = keyToIndex.get(createdKey);
        if (createdIdx !== undefined) points[createdIdx].created += 1;

        const resolvedAt = ticket.resolvedAt ?? ticket.closedAt;
        if (!resolvedAt) return;
        const resolvedDate = new Date(resolvedAt);
        const resolvedHour = Math.floor(resolvedDate.getHours() / 3) * 3;
        const resolvedKey = `${resolvedDate.getFullYear()}-${resolvedDate.getMonth()}-${resolvedDate.getDate()}-${resolvedHour}`;
        const resolvedIdx = keyToIndex.get(resolvedKey);
        if (resolvedIdx !== undefined) points[resolvedIdx].resolved += 1;
      });

      return points;
    }

    if (range === '7d') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const points = Array.from({ length: 7 }).map((_, index) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - index));
        return {
          key: d.toISOString().slice(0, 10),
          label: formatDay(d),
          created: 0,
          resolved: 0,
        };
      });

      const keyToIndex = new Map(points.map((point, index) => [point.key, index]));
      rangeFilteredTickets.forEach((ticket) => {
        const createdKey = new Date(ticket.createdAt).toISOString().slice(0, 10);
        const createdIdx = keyToIndex.get(createdKey);
        if (createdIdx !== undefined) points[createdIdx].created += 1;

        const resolvedAt = ticket.resolvedAt ?? ticket.closedAt;
        if (!resolvedAt) return;
        const resolvedKey = new Date(resolvedAt).toISOString().slice(0, 10);
        const resolvedIdx = keyToIndex.get(resolvedKey);
        if (resolvedIdx !== undefined) points[resolvedIdx].resolved += 1;
      });

      return points;
    }

    const now = new Date();
    const points = Array.from({ length: 6 }).map((_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { key, label: formatMonth(d), created: 0, resolved: 0 };
    });

    const keyToIndex = new Map(points.map((point, index) => [point.key, index]));
    rangeFilteredTickets.forEach((ticket) => {
      const created = new Date(ticket.createdAt);
      const createdKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      const createdIdx = keyToIndex.get(createdKey);
      if (createdIdx !== undefined) {
        points[createdIdx].created += 1;
      }

      const resolvedAt = ticket.resolvedAt ?? ticket.closedAt;
      if (resolvedAt) {
        const resolved = new Date(resolvedAt);
        const resolvedKey = `${resolved.getFullYear()}-${String(resolved.getMonth() + 1).padStart(2, '0')}`;
        const resolvedIdx = keyToIndex.get(resolvedKey);
        if (resolvedIdx !== undefined) {
          points[resolvedIdx].resolved += 1;
        }
      }
    });

    return points;
  }, [range, rangeFilteredTickets]);

  const categoryData = useMemo(() => {
    const tipoLabel: Record<string, string> = {
      INCIDENT: 'Incidente',
      SERVICE_REQUEST: 'Requisição',
      PROBLEM: 'Problema',
      CHANGE: 'Mudança',
      TASK: 'Tarefa',
      QUESTION: 'Dúvida',
    };

    const counts = new Map<string, number>();
    rangeFilteredTickets.forEach((ticket) => {
      const key = ticket.category?.name || (ticket.tipo ? tipoLabel[ticket.tipo] : null) || 'Sem categoria';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const normalized = Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return normalized;
  }, [rangeFilteredTickets]);

  const categoryTotal = useMemo(() => categoryData.reduce((acc, item) => acc + item.value, 0), [categoryData]);
  const visibleCategoryData = useMemo(
    () => categoryData.filter((item) => !hiddenCategories.includes(item.name)),
    [categoryData, hiddenCategories],
  );
  const timelineTotals = useMemo(
    () =>
      timelineData.reduce(
        (acc, point) => {
          acc.created += point.created;
          acc.resolved += point.resolved;
          return acc;
        },
        { created: 0, resolved: 0 },
      ),
    [timelineData],
  );

  const recentActivities = useMemo(
    () =>
      [...tickets]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8),
    [tickets],
  );

  const headerActions = (
    <Link
      to="/tickets/new"
      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md"
    >
      <Plus className="h-4 w-4" />
      Novo Ticket
    </Link>
  );

  return (
    <ModernLayout
      title="Visão Geral"
      subtitle="Panorama de operação do Help Desk com indicadores em tempo real"
      headerActions={headerActions}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'today', label: 'Hoje' },
            { id: '7d', label: '7 Dias' },
            { id: '30d', label: '30 Dias' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setRange(item.id as 'today' | '7d' | '30d')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                range === item.id
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/70 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Carregando dashboard...</p>
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            Não foi possível carregar os dados do dashboard.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              <Link to="/tickets?status=OPEN" className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <StatCard
                  title="Tickets Abertos"
                  value={stats.open}
                  icon={Ticket}
                  trendText="↑ 12% desde o último mês"
                  trendDirection="up"
                  progress={Math.min(stats.open * 6, 100)}
                />
              </Link>
              <Link to="/metrics?tab=overview" className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <StatCard
                  title="Tempo Médio de Resolução"
                  value={stats.inProgress > 0 ? '5h 24m' : '4h 58m'}
                  icon={Clock3}
                  trendText="↓ 8% mais rápido"
                  trendDirection="up"
                  progress={72}
                />
              </Link>
              <Link
                to="/tickets?status=WAITING_THIRD_PARTY"
                className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <StatCard
                  title="Aguardando Fornecedor"
                  value={stats.waitingVendor}
                  icon={AlertTriangle}
                  trendText="↑ 3 chamados críticos"
                  trendDirection={stats.waitingVendor > 0 ? 'down' : 'neutral'}
                  progress={Math.min(stats.waitingVendor * 10, 100)}
                />
              </Link>
              <Link
                to="/metrics?tab=overview&status=RESOLVED"
                className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <StatCard
                  title="CSAT"
                  value={`${stats.csat}%`}
                  icon={Smile}
                  trendText="↑ 4 pts no período"
                  trendDirection="up"
                  progress={stats.csat}
                />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Tickets por Mês</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Volume de chamados ao longo do tempo</p>
                  </div>
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                    Criados: {timelineTotals.created}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Resolvidos: {timelineTotals.resolved}
                  </div>
                </div>
                <div className="h-64 rounded-xl bg-gradient-to-br from-indigo-50 via-sky-50 to-white p-2 dark:from-indigo-500/10 dark:via-sky-500/10 dark:to-slate-800">
                  {timelineData.some((point) => point.created > 0 || point.resolved > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timelineData}>
                        <defs>
                          <linearGradient id="dashboardCreatedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.45} />
                          </linearGradient>
                          <linearGradient id="dashboardResolvedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.45} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.35} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'rgba(255,255,255,0.95)',
                          }}
                          labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                          itemStyle={{ color: '#0f172a' }}
                        />
                        <Bar dataKey="created" name="Criados" fill="url(#dashboardCreatedGradient)" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="resolved" name="Resolvidos" fill="url(#dashboardResolvedGradient)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                      Sem dados suficientes no período selecionado
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Tickets por Categoria</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Distribuição das demandas por tipo</p>
                  </div>
                  <PieChartIcon className="h-4 w-4 text-slate-400" />
                </div>
                <div className="h-64 rounded-xl bg-gradient-to-br from-emerald-50 via-indigo-50 to-white p-2 dark:from-emerald-500/10 dark:via-indigo-500/10 dark:to-slate-800">
                  {visibleCategoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={visibleCategoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={3}>
                          {visibleCategoryData.map((entry, index) => (
                            <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'rgba(255,255,255,0.95)',
                          }}
                          labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                          itemStyle={{ color: '#0f172a' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                      Todas as categorias estão ocultas. Clique na legenda para reexibir.
                    </div>
                  )}
                </div>
                {categoryData.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {categoryData.map((item, index) => {
                      const pct = categoryTotal > 0 ? Math.round((item.value / categoryTotal) * 100) : 0;
                      const hidden = hiddenCategories.includes(item.name);
                      return (
                        <button
                          type="button"
                          key={item.name}
                          onClick={() =>
                            setHiddenCategories((prev) =>
                              prev.includes(item.name) ? prev.filter((name) => name !== item.name) : [...prev, item.name],
                            )
                          }
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-all ${
                            hidden
                              ? 'border-slate-200 bg-slate-100/60 opacity-60 dark:border-slate-700 dark:bg-slate-900/20'
                              : 'border-slate-200 bg-white/70 hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/30'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                            />
                            <span className="truncate text-slate-600 dark:text-slate-300">{item.name}</span>
                          </div>
                          <span className="ml-2 shrink-0 font-semibold text-slate-700 dark:text-slate-200">
                            {item.value} ({pct}%)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700/60">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Atividades Recentes</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Atualizações mais recentes dos tickets</p>
                </div>
                <TrendingUp className="h-4 w-4 text-slate-400" />
              </header>

              {recentActivities.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma atividade recente.</div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {recentActivities.map((ticket) => (
                    <li key={ticket.id} className="px-6 py-4 transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{ticket.title}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">#{ticket.id.slice(0, 8)} • {ticket.requester.name}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityBadgeClass[ticket.priority] ?? priorityBadgeClass.LOW}`}>
                          {ticket.priority}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <header className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Backlog Envelhecido (Stale Tickets)
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Tickets abertos ou em atendimento sem atualização recente
                  </p>
                </div>
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              </header>

              {staleLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Carregando backlog envelhecido...
                </p>
              ) : staleTickets.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhum ticket envelhecido no momento.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {staleTickets.map((ticket) => {
                    const staleDays = Math.max(
                      1,
                      Math.floor((Date.now() - new Date(ticket.updatedAt).getTime()) / (24 * 60 * 60 * 1000)),
                    );
                    const techName = ticket.assignedTechnician?.name || 'Sem técnico';
                    const techInitial = techName.charAt(0).toUpperCase();
                    return (
                      <li key={ticket.id} className="py-3 first:pt-0 last:pb-0">
                        <Link
                          to={`/tickets/${ticket.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition-all hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                              {techInitial}
                            </div>
                            <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {ticket.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              #{ticket.id.slice(0, 8)} • {techName}
                            </p>
                            </div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                            {staleDays}d sem interação
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </ModernLayout>
  );
};

export default DashboardPage;
