import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, EllipsisVertical, Clock3, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { categoryService, Category } from '../services/category.service';
import { teamService, Team } from '../services/team.service';
import { useTickets } from '../hooks/queries/useTickets';
import ModernLayout from '../components/ModernLayout';

const statusBadgeClass: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  WAITING_REQUESTER: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  WAITING_THIRD_PARTY: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  RESOLVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  CLOSED: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

const priorityBadgeClass: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  MEDIUM: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  HIGH: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  CRITICAL: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

const statusLabel: Record<string, string> = {
  OPEN: 'Novo',
  IN_PROGRESS: 'Em Atendimento',
  WAITING_REQUESTER: 'Aguardando Usuário',
  WAITING_THIRD_PARTY: 'Aguardando Fornecedor',
  RESOLVED: 'Solucionado',
  CLOSED: 'Fechado',
};

const readInitialFilters = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get('q') ?? '',
    onlyMine: params.get('onlyMine') === 'true',
    onlySlaRisk: params.get('onlySlaRisk') === 'true',
    status: params.get('status') ?? '',
    priority: params.get('priority') ?? '',
    categoryId: params.get('categoryId') ?? '',
    teamId: params.get('teamId') ?? '',
  };
};

const TicketsPage = () => {
  const { user } = useAuth();
  const initial = readInitialFilters();
  const [categories, setCategories] = useState<Category[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState(initial.search);
  const [onlyMine, setOnlyMine] = useState(initial.onlyMine);
  const [onlySlaRisk, setOnlySlaRisk] = useState(initial.onlySlaRisk);
  const [filters, setFilters] = useState({
    status: initial.status,
    priority: initial.priority,
    categoryId: initial.categoryId,
    teamId: initial.teamId,
  });

  const queryFilters = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.teamId ? { teamId: filters.teamId } : {}),
    ...(onlyMine && user?.id ? { assignedTechnicianId: user.id } : {}),
  };

  const { data: tickets = [], isLoading, isError, error } = useTickets(queryFilters);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (onlyMine) params.set('onlyMine', 'true');
    if (onlySlaRisk) params.set('onlySlaRisk', 'true');
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.teamId) params.set('teamId', filters.teamId);
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [search, onlyMine, onlySlaRisk, filters]);

  const isSlaRiskTicket = (ticket: (typeof tickets)[number]) =>
    ticket.tags?.some((ticketTag) => ticketTag.tag?.name?.toLowerCase() === 'risco de sla') ??
    false;

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [categoriesData, teamsData] = await Promise.all([
          categoryService.getAllCategories(),
          user?.role === 'ADMIN' || user?.role === 'TRIAGER' || user?.role === 'TECHNICIAN'
            ? teamService.getAllTeams()
            : Promise.resolve([]),
        ]);
        setCategories(categoriesData);
        setTeams(teamsData);
      } catch (err) {
        console.error('Erro ao carregar metadados de tickets:', err);
      }
    };

    loadMetadata();
  }, [user]);

  const filteredTickets = useMemo(() => {
    if (!search.trim()) {
      return onlySlaRisk ? tickets.filter(isSlaRiskTicket) : tickets;
    }
    const term = search.toLowerCase();

    const searched = tickets.filter((ticket) => {
      return (
        ticket.title.toLowerCase().includes(term) ||
        ticket.id.toLowerCase().includes(term) ||
        ticket.requester.name.toLowerCase().includes(term)
      );
    });
    return onlySlaRisk ? searched.filter(isSlaRiskTicket) : searched;
  }, [tickets, search, onlySlaRisk]);

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
    <ModernLayout title="Tickets" subtitle="Lista de chamados com filtros inteligentes" headerActions={headerActions}>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por título, ID ou solicitante"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
              />
            </div>

            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
            >
              <option value="">Status</option>
              <option value="OPEN">Novo</option>
              <option value="IN_PROGRESS">Em Atendimento</option>
              <option value="WAITING_REQUESTER">Aguardando Usuário</option>
              <option value="WAITING_THIRD_PARTY">Aguardando Fornecedor</option>
              <option value="RESOLVED">Solucionado</option>
              <option value="CLOSED">Fechado</option>
            </select>

            <select
              value={filters.priority}
              onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
            >
              <option value="">Prioridade</option>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </select>

            <select
              value={filters.categoryId}
              onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
            >
              <option value="">Categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              {(user?.role === 'ADMIN' || user?.role === 'TRIAGER' || user?.role === 'TECHNICIAN') && (
                <select
                  value={filters.teamId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, teamId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
                >
                  <option value="">Time</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOnlyMine((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all duration-200 ${
                    onlyMine
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Atribuído a mim
                </button>
                <button
                  onClick={() => setOnlySlaRisk((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all duration-200 ${
                    onlySlaRisk
                      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-900/60'
                  }`}
                >
                  🚨 Risco de Quebra
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700/60">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tickets ({filteredTickets.length})</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Lista moderna e escaneável</p>
          </header>

          {isLoading ? (
            <div className="p-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Carregando tickets...</p>
            </div>
          ) : isError ? (
            <div className="p-10 text-center text-sm text-rose-600 dark:text-rose-300">
              {error instanceof Error ? error.message : 'Erro ao carregar tickets'}
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum ticket encontrado.</div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredTickets.map((ticket) => {
                const isSlaRisk = isSlaRiskTicket(ticket);
                return (
                <li key={ticket.id}>
                  <Link
                    to={`/tickets/${ticket.id}`}
                    className={`flex items-center gap-4 px-6 py-4 transition-all duration-200 ${
                      isSlaRisk
                        ? 'bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-900/10 dark:hover:bg-rose-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{ticket.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">#{ticket.id.slice(0, 8)}</p>
                    </div>

                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass[ticket.status] ?? statusBadgeClass.CLOSED}`}>
                      {statusLabel[ticket.status] ?? ticket.status}
                    </span>

                    {isSlaRisk && (
                      <span className="animate-pulse inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                        <AlertTriangle className="h-3 w-3" /> Risco de SLA
                      </span>
                    )}

                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityBadgeClass[ticket.priority] ?? priorityBadgeClass.LOW}`}>
                      {ticket.priority}
                    </span>

                    <div className="hidden min-w-[160px] items-center gap-2 md:flex">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                        {ticket.requester.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate text-sm text-slate-600 dark:text-slate-300">{ticket.requester.name}</span>
                    </div>

                    <div className="hidden min-w-[90px] items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 lg:flex">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(ticket.updatedAt).toLocaleDateString('pt-BR')}
                    </div>

                    <button
                      type="button"
                      onClick={(event) => event.preventDefault()}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      aria-label="Mais ações"
                    >
                      <EllipsisVertical className="h-4 w-4" />
                    </button>
                  </Link>
                </li>
              );
              })}
            </ul>
          )}

          <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-700/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">Exibindo {filteredTickets.length} resultados</p>
            <div className="flex items-center gap-2">
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-900/60">
                Anterior
              </button>
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-900/60">
                Próximo
              </button>
            </div>
          </footer>
        </section>
      </div>
    </ModernLayout>
  );
};

export default TicketsPage;
