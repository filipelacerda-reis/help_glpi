import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ticketService, Ticket } from '../services/ticket.service';
import ModernLayout from '../components/ModernLayout';
import { Plus } from 'lucide-react';

const DashboardPage = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
  });

  useEffect(() => {
    const loadTickets = async () => {
      try {
        let filters: any = {};
        
        if (user?.role === 'TRIAGER') {
          filters.status = 'OPEN';
        } else if (user?.role === 'TECHNICIAN') {
          // Técnico vê tickets atribuídos a ele
        } else if (user?.role === 'REQUESTER') {
          // Solicitante vê apenas seus tickets
        }

        const data = await ticketService.getTickets(filters);
        setTickets(data);

        // Calcular estatísticas
        const statsData = {
          open: data.filter((t) => t.status === 'OPEN').length,
          inProgress: data.filter((t) => t.status === 'IN_PROGRESS').length,
          resolved: data.filter((t) => t.status === 'RESOLVED').length,
          closed: data.filter((t) => t.status === 'CLOSED').length,
        };
        setStats(statsData);
      } catch (error) {
        console.error('Erro ao carregar tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTickets();
  }, [user]);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      OPEN: 'Aberto',
      IN_PROGRESS: 'Em Atendimento',
      WAITING_REQUESTER: 'Aguardando Usuário',
      WAITING_THIRD_PARTY: 'Aguardando Terceiros',
      RESOLVED: 'Resolvido',
      CLOSED: 'Fechado',
    };
    return labels[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'bg-gray-600/50 text-gray-300',
      MEDIUM: 'bg-etus-green/30 text-etus-green',
      HIGH: 'bg-orange-500/30 text-orange-400',
      CRITICAL: 'bg-red-500/30 text-red-400',
    };
    return colors[priority] || 'bg-gray-600/50 text-gray-300';
  };

  // Botão de criar ticket - disponível para TODOS os perfis autenticados
  // REQUESTER, TECHNICIAN, TRIAGER, ADMIN - todos podem criar tickets
  const headerActions = user ? (
    <Link
      to="/tickets/new"
      className="inline-flex items-center space-x-2 px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span>Abrir Novo Ticket</span>
    </Link>
  ) : null;

  if (loading) {
    return (
      <ModernLayout title="Dashboard" subtitle={`Bem-vindo, ${user?.name}`} headerActions={headerActions}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-gray-400">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Dashboard" subtitle={`Bem-vindo, ${user?.name}`} headerActions={headerActions}>
      {/* Stats Cards */}
      {(user?.role === 'ADMIN' || user?.role === 'TRIAGER') && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-5 hover:bg-gray-700/40 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Abertos</p>
                <p className="text-3xl font-bold text-white">{stats.open}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-5 hover:bg-gray-700/40 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Em Atendimento</p>
                <p className="text-3xl font-bold text-white">{stats.inProgress}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-5 hover:bg-gray-700/40 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Resolvidos</p>
                <p className="text-3xl font-bold text-white">{stats.resolved}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-5 hover:bg-gray-700/40 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Fechados</p>
                <p className="text-3xl font-bold text-white">{stats.closed}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tickets List */}
      <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-600/50">
          <h2 className="text-lg font-semibold text-white">Tickets Recentes</h2>
        </div>
        <ul className="divide-y divide-gray-600/50">
          {tickets.slice(0, 10).map((ticket) => (
            <li key={ticket.id}>
              <Link
                to={`/tickets/${ticket.id}`}
                className="block hover:bg-gray-700/30 px-4 py-4 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    <p className="text-sm font-medium text-etus-green hover:text-etus-green-dark truncate">
                      #{ticket.id.slice(0, 8)} - {ticket.title}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(
                        ticket.priority
                      )}`}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Status: {getStatusLabel(ticket.status)}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {tickets.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Nenhum ticket encontrado
          </div>
        )}
      </div>
    </ModernLayout>
  );
};

export default DashboardPage;
