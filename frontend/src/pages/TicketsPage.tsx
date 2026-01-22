import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ticketService, Ticket } from '../services/ticket.service';
import { categoryService, Category } from '../services/category.service';
import { teamService, Team } from '../services/team.service';
import ModernLayout from '../components/ModernLayout';
import { Plus, LayoutGrid, List } from 'lucide-react';

const TicketsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    categoryId: '',
    teamId: '',
    tipo: '',
  });
  const [updatingTickets, setUpdatingTickets] = useState<Set<string>>(new Set());
  const [, forceUpdate] = useState(0);
  
  // Estados para swipe (touch e mouse)
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);
  const draggingTicket = useRef<Ticket | null>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const draggedTicketId = useRef<string | null>(null);
  const dragStartPosition = useRef<{ x: number; y: number } | null>(null);
  const dragMouseOffset = useRef<{ x: number; y: number } | null>(null); // Offset do mouse dentro do card
  // Referência genérica para o elemento do card sendo arrastado
  // Usamos HTMLElement (e não HTMLDivElement) para ser compatível com e.currentTarget
  const cardElementRef = useRef<HTMLElement | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const swipeThreshold = 50; // Mínimo de pixels para considerar um swipe

  useEffect(() => {
    const loadData = async () => {
      try {
        const filterParams: any = {};
        if (filters.status) filterParams.status = filters.status;
        if (filters.priority) filterParams.priority = filters.priority;
        if (filters.categoryId) filterParams.categoryId = filters.categoryId;
        if (filters.teamId) filterParams.teamId = filters.teamId;
        if (filters.tipo) filterParams.tipo = filters.tipo;

        const [ticketsData, categoriesData, teamsData] = await Promise.all([
          ticketService.getTickets(filterParams),
          categoryService.getAllCategories(),
          user?.role === 'ADMIN' || user?.role === 'TRIAGER' || user?.role === 'TECHNICIAN'
            ? teamService.getAllTeams()
            : Promise.resolve([]),
        ]);
        setTickets(ticketsData);
        setCategories(categoriesData);
        setTeams(teamsData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [filters, user]);

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: 'bg-yellow-500/30 text-yellow-400',
      IN_PROGRESS: 'bg-blue-500/30 text-blue-400',
      WAITING_REQUESTER: 'bg-orange-500/30 text-orange-400',
      WAITING_THIRD_PARTY: 'bg-purple-500/30 text-purple-400',
      RESOLVED: 'bg-green-500/30 text-green-400',
      CLOSED: 'bg-gray-600/50 text-gray-300',
    };
    return colors[status] || 'bg-gray-600/50 text-gray-300';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'bg-gray-600/50 text-gray-300',
      MEDIUM: 'bg-blue-500/30 text-blue-400',
      HIGH: 'bg-orange-500/30 text-orange-400',
      CRITICAL: 'bg-red-500/30 text-red-400',
    };
    return colors[priority] || 'bg-gray-600/50 text-gray-300';
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      INCIDENT: 'Incidente',
      SERVICE_REQUEST: 'Solicitação',
      PROBLEM: 'Problema',
      CHANGE: 'Mudança',
      TASK: 'Tarefa',
      QUESTION: 'Dúvida',
    };
    return labels[tipo] || tipo;
  };

  // Ordem dos status para navegação
  const statusOrder = ['OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'WAITING_THIRD_PARTY', 'RESOLVED', 'CLOSED'];

  // Função para detectar qual status está sob o cursor
  const getStatusUnderCursor = useCallback((x: number): string | null => {
    const kanbanContainer = document.querySelector('[data-kanban-container]');
    if (!kanbanContainer) return null;

    const columns = kanbanContainer.querySelectorAll('[data-status-column]');
    for (const column of columns) {
      const rect = column.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right) {
        return column.getAttribute('data-status-column');
      }
    }
    return null;
  }, []);

  // Função para atualizar status do ticket
  const handleStatusUpdate = useCallback(async (ticketId: string, newStatus: string) => {
    if (updatingTickets.has(ticketId)) return; // Evitar múltiplas atualizações

    setUpdatingTickets((prev) => new Set(prev).add(ticketId));
    
    try {
      await ticketService.updateTicket(ticketId, { status: newStatus });
      
      // Atualizar estado local
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar status do ticket:', error);
      alert('Erro ao atualizar status do ticket. Tente novamente.');
    } finally {
      setUpdatingTickets((prev) => {
        const newSet = new Set(prev);
        newSet.delete(ticketId);
        return newSet;
      });
    }
  }, []);

  // Handlers para swipe (touch events - mobile)
  const handleTouchStart = useCallback((e: React.TouchEvent, ticket: Ticket) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    isDragging.current = true;
    draggingTicket.current = ticket;
    draggedTicketId.current = ticket.id;
    dragOffset.current = { x: 0, y: 0 };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Prevenir scroll durante swipe
    if (swipeStartX.current !== null && isDragging.current && draggingTicket.current) {
      const deltaX = e.touches[0].clientX - swipeStartX.current;
      const deltaY = e.touches[0].clientY - (swipeStartY.current || 0);
      
      // Atualizar offset para animação
      dragOffset.current = { x: deltaX, y: deltaY };
      forceUpdate((prev) => prev + 1);
      
      // Se o movimento horizontal for maior que o vertical, prevenir scroll
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        e.preventDefault();
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent, ticket: Ticket) => {
    if (swipeStartX.current === null || swipeStartY.current === null || !isDragging.current) {
      isDragging.current = false;
      draggingTicket.current = null;
      dragOffset.current = null;
      draggedTicketId.current = null;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - swipeStartX.current;
    const deltaY = Math.abs(endY - swipeStartY.current);

    // Detectar qual status está sob o cursor
    const newStatus = getStatusUnderCursor(endX);

    // Reset
    swipeStartX.current = null;
    swipeStartY.current = null;
    isDragging.current = false;
    dragOffset.current = null;
    draggedTicketId.current = null;

    // Verificar se é um swipe válido (horizontal e com distância suficiente ou mudou de coluna)
    // Permitir mudança para qualquer status se arrastou para uma coluna diferente
    if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > deltaY) {
      let targetStatus: string | null = null;
      
      // Prioridade: status detectado sob o cursor
      if (newStatus && newStatus !== ticket.status) {
        targetStatus = newStatus;
      } 
      // Fallback: próximo/anterior baseado na direção
      else {
        const currentIndex = statusOrder.indexOf(ticket.status);
        if (deltaX > 0 && currentIndex < statusOrder.length - 1) {
          targetStatus = statusOrder[currentIndex + 1];
        } else if (deltaX < 0 && currentIndex > 0) {
          targetStatus = statusOrder[currentIndex - 1];
        }
      }
      
      if (targetStatus && targetStatus !== ticket.status) {
        handleStatusUpdate(ticket.id, targetStatus);
        return; // Prevenir navegação ao clicar
      }
    }
    
    draggingTicket.current = null;
  }, [getStatusUnderCursor, handleStatusUpdate]);

  // Handler global para mouse move (precisa ser no documento)
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || swipeStartX.current === null || swipeStartY.current === null || !draggingTicket.current) return;

    const deltaX = e.clientX - swipeStartX.current;
    const deltaY = e.clientY - (swipeStartY.current || 0);
    
    // Atualizar offset para animação (posição relativa ao ponto inicial do clique)
    dragOffset.current = { x: deltaX, y: deltaY };
    
    // Detectar coluna sob o cursor para feedback visual
    const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
    if (elementUnderCursor) {
      const columnElement = elementUnderCursor.closest('[data-status-column]');
      if (columnElement) {
        const status = columnElement.getAttribute('data-status-column');
        setDragOverColumn(status);
      } else {
        setDragOverColumn(null);
      }
    }
    
    // Sempre atualizar posição visual durante o drag
    e.preventDefault();
    
    // Forçar re-render para atualizar posição visual do overlay
    forceUpdate((prev) => prev + 1);
  }, [forceUpdate]);

  // Handler global para mouse up (precisa ser no documento)
  const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
    // Remover listeners
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
    
    if (!isDragging.current || swipeStartX.current === null || swipeStartY.current === null || !draggingTicket.current) {
      isDragging.current = false;
      draggingTicket.current = null;
      dragOffset.current = null;
      draggedTicketId.current = null;
      return;
    }

    const currentTicket = draggingTicket.current;
    const endX = e.clientX;
    const deltaX = endX - swipeStartX.current;

    // Detectar qual status está sob o cursor
    const newStatus = getStatusUnderCursor(endX);
    
    // Reset
    const wasDragging = isDragging.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    isDragging.current = false;
    dragOffset.current = null;
    draggedTicketId.current = null;
    dragStartPosition.current = null;
    dragMouseOffset.current = null;
    setDragOverColumn(null);
    dragStartPosition.current = null;
    setDragOverColumn(null);

    // Verificar se é um drag válido (horizontal e com distância suficiente ou mudou de coluna)
    // Permitir mudança para qualquer status se arrastou para uma coluna diferente
    if (wasDragging) {
      let targetStatus: string | null = null;
      
      // Prioridade: status detectado sob o cursor
      if (newStatus && newStatus !== currentTicket.status) {
        targetStatus = newStatus;
      } 
      // Fallback: próximo/anterior baseado na direção
      else if (Math.abs(deltaX) > swipeThreshold) {
        const currentIndex = statusOrder.indexOf(currentTicket.status);
        if (deltaX > 0 && currentIndex < statusOrder.length - 1) {
          targetStatus = statusOrder[currentIndex + 1];
        } else if (deltaX < 0 && currentIndex > 0) {
          targetStatus = statusOrder[currentIndex - 1];
        }
      }
      
      if (targetStatus && targetStatus !== currentTicket.status) {
        handleStatusUpdate(currentTicket.id, targetStatus);
        e.preventDefault();
        e.stopPropagation();
      }
    }
    
    draggingTicket.current = null;
  }, [getStatusUnderCursor, handleStatusUpdate, handleGlobalMouseMove]);

  // Handlers para swipe (mouse events - desktop/notebook)
  const handleMouseDown = useCallback((e: React.MouseEvent, ticket: Ticket) => {
    // Só iniciar drag se for botão esquerdo
    if (e.button !== 0) return;
    
    const cardElement = e.currentTarget as HTMLElement;
    const rect = cardElement.getBoundingClientRect();
    
    // Calcular offset do mouse dentro do card (para manter a posição relativa)
    const mouseOffsetX = e.clientX - rect.left;
    const mouseOffsetY = e.clientY - rect.top;
    
    swipeStartX.current = e.clientX;
    swipeStartY.current = e.clientY;
    isDragging.current = true;
    draggingTicket.current = ticket;
    draggedTicketId.current = ticket.id;
    dragOffset.current = { x: 0, y: 0 };
    dragStartPosition.current = { x: rect.left, y: rect.top };
    dragMouseOffset.current = { x: mouseOffsetX, y: mouseOffsetY };
    cardElementRef.current = cardElement;
    
    e.preventDefault(); // Prevenir seleção de texto
    e.stopPropagation();
    
    // Adicionar listeners globais
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);


  // Botão de criar ticket - disponível para TODOS os perfis autenticados
  // REQUESTER, TECHNICIAN, TRIAGER, ADMIN - todos podem criar tickets
  const headerActions = user ? (
    <Link
      to="/tickets/new"
      className="inline-flex items-center space-x-2 px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span>Novo Ticket</span>
    </Link>
  ) : null;

  if (loading) {
    return (
      <ModernLayout title="Tickets" subtitle="Gerencie todos os tickets do sistema" headerActions={headerActions}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-gray-400">Carregando tickets...</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Tickets" subtitle="Gerencie todos os tickets do sistema" headerActions={headerActions}>
      {/* Filtros */}
      <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
            >
              <option value="">Todos</option>
              <option value="OPEN">Aberto</option>
              <option value="IN_PROGRESS">Em Atendimento</option>
              <option value="WAITING_REQUESTER">Aguardando Usuário</option>
              <option value="WAITING_THIRD_PARTY">Aguardando Terceiros</option>
              <option value="RESOLVED">Resolvido</option>
              <option value="CLOSED">Fechado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
            <select
              value={filters.tipo}
              onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
              className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
            >
              <option value="">Todos</option>
              <option value="INCIDENT">Incidente</option>
              <option value="SERVICE_REQUEST">Solicitação de Serviço</option>
              <option value="PROBLEM">Problema</option>
              <option value="CHANGE">Mudança</option>
              <option value="TASK">Tarefa</option>
              <option value="QUESTION">Dúvida</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Prioridade</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
            >
              <option value="">Todas</option>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Categoria</label>
            <select
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
            >
              <option value="">Todas</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          {(user?.role === 'ADMIN' || user?.role === 'TRIAGER' || user?.role === 'TECHNICIAN') && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Time</label>
              <select
                value={filters.teamId}
                onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              >
                <option value="">Todos</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Toggle de Visualização - SEMPRE VISÍVEL */}
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" data-testid="view-toggle-container">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Tickets ({tickets.length})</h2>
        </div>
        <div className="flex items-center space-x-2 bg-gray-700/50 rounded-lg p-1 border border-gray-600/50 shadow-lg" data-testid="view-toggle-buttons">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Mudando para Lista, viewMode atual:', viewMode);
              setViewMode('list');
            }}
            className={`px-4 py-2 rounded text-sm font-medium transition-all flex items-center space-x-2 ${
              viewMode === 'list'
                ? 'bg-etus-green text-gray-900 shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
            }`}
            title="Visualização em Lista"
          >
            <List className="w-4 h-4" />
            <span className="font-semibold">Lista</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Mudando para Kanban, viewMode atual:', viewMode);
              setViewMode('kanban');
            }}
            className={`px-4 py-2 rounded text-sm font-medium transition-all flex items-center space-x-2 ${
              viewMode === 'kanban'
                ? 'bg-etus-green text-gray-900 shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
            }`}
            title="Visualização Kanban"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="font-semibold">Kanban</span>
          </button>
        </div>
      </div>

      {/* Visualização em Lista */}
      {viewMode === 'list' && (
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-600/50">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                to={`/tickets/${ticket.id}`}
                className="block hover:bg-gray-700/30 px-4 py-4 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-etus-green hover:text-etus-green-dark truncate">
                        #{ticket.id.slice(0, 8)} - {ticket.title}
                      </p>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/30 text-blue-400">
                        {getTipoLabel(ticket.tipo)}
                      </span>
                    </div>
                    {ticket.description && (
                      <p className="mt-1 text-sm text-gray-400 truncate">{ticket.description}</p>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                        ticket.status
                      )}`}
                    >
                      {getStatusLabel(ticket.status)}
                    </span>
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(
                        ticket.priority
                      )}`}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-400">
                  <span>Solicitante: {ticket.requester.name}</span>
                  {ticket.assignedTechnician && <span>Técnico: {ticket.assignedTechnician.name}</span>}
                  {ticket.team && <span>Time: {ticket.team.name}</span>}
                  <span className="ml-auto">
                    {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </Link>
            </li>
          ))}
          {tickets.length === 0 && (
            <li>
              <div className="text-center py-12 text-gray-400">
                Nenhum ticket encontrado
              </div>
            </li>
          )}
        </ul>
        </div>
      )}

      {/* Visualização Kanban */}
      {viewMode === 'kanban' && (
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg overflow-hidden" style={{ position: 'relative', zIndex: 1 }}>
          <div className="p-4 overflow-x-auto" data-kanban-container style={{ position: 'relative', zIndex: 1 }}>
            <div className="flex space-x-4 min-w-max">
              {['OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'WAITING_THIRD_PARTY', 'RESOLVED', 'CLOSED'].map((status) => {
                const statusTickets = tickets.filter((t) => t.status === status);
                return (
                  <div 
                    key={status} 
                    className={`flex-shrink-0 w-72 transition-all duration-200 ${
                      dragOverColumn === status ? 'bg-gray-700/30 rounded-lg' : ''
                    }`}
                    data-status-column={status}
                    style={{ position: 'relative', zIndex: 1 }}
                  >
                    <div className={`bg-gray-800/50 rounded-lg p-3 mb-2 transition-all duration-200 ${
                      dragOverColumn === status ? 'ring-2 ring-etus-green ring-opacity-50' : ''
                    }`}>
                      <h3 className="text-sm font-semibold text-white mb-1">
                        {getStatusLabel(status)}
                      </h3>
                      <span className="text-xs text-gray-400">{statusTickets.length} tickets</span>
                    </div>
                    <div 
                      className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto"
                    >
                      {statusTickets
                        .sort((a, b) => {
                          // Colocar o ticket sendo arrastado por último para ficar por cima
                          if (draggedTicketId.current === a.id) return 1;
                          if (draggedTicketId.current === b.id) return -1;
                          return 0;
                        })
                        .map((ticket) => {
                        const isUpdating = updatingTickets.has(ticket.id);
                        const isDraggingThis = draggedTicketId.current === ticket.id;
                        const canSwipeLeft = statusOrder.indexOf(ticket.status) > 0;
                        const canSwipeRight = statusOrder.indexOf(ticket.status) < statusOrder.length - 1;
                                                
                        return (
                          <div
                            key={ticket.id}
                            // Touch events (mobile)
                            onTouchStart={(e) => handleTouchStart(e, ticket)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={(e) => handleTouchEnd(e, ticket)}
                            // Mouse events (desktop/notebook)
                            onMouseDown={(e) => handleMouseDown(e, ticket)}
                            onClick={() => {
                              // Só navegar se não foi um drag
                              if (!isDragging.current && swipeStartX.current === null) {
                                navigate(`/tickets/${ticket.id}`);
                              }
                              // Reset após clique
                              isDragging.current = false;
                              swipeStartX.current = null;
                              swipeStartY.current = null;
                              draggingTicket.current = null;
                              dragOffset.current = null;
                              draggedTicketId.current = null;
                              forceUpdate((prev) => prev + 1);
                            }}
                            className={`block bg-gray-800/50 hover:bg-gray-800/70 rounded-lg p-3 border border-gray-600/50 cursor-pointer select-none ${
                              isUpdating ? 'opacity-50 pointer-events-none' : ''
                            } ${isDraggingThis ? 'opacity-30' : 'cursor-grab transition-all duration-200 hover:scale-[1.02]'}`}
                            style={{ 
                              touchAction: 'pan-x pan-y', 
                              userSelect: 'none',
                              transition: isDraggingThis ? 'opacity 0.2s ease-out' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
                              position: 'relative',
                              pointerEvents: isDraggingThis ? 'none' : 'auto',
                            }}
                          >
                            {/* Indicadores de swipe */}
                            {canSwipeLeft && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/50 rounded-l-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
                            )}
                            {canSwipeRight && (
                              <div className="absolute right-0 top-0 bottom-0 w-1 bg-green-500/50 rounded-r-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
                            )}
                            
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="text-sm font-medium text-white line-clamp-2 flex-1">
                                {ticket.title}
                              </h4>
                              <span
                                className={`ml-2 flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${getPriorityColor(
                                  ticket.priority
                                )}`}
                              >
                                {ticket.priority}
                              </span>
                            </div>
                            {ticket.assignedTechnician && (
                              <div className="flex items-center space-x-1 mb-2">
                                <div className="w-6 h-6 rounded-full bg-etus-green flex items-center justify-center text-xs font-semibold text-gray-900">
                                  {ticket.assignedTechnician.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs text-gray-400 truncate">
                                  {ticket.assignedTechnician.name}
                                </span>
                              </div>
                            )}
                            {ticket.dueDate && (
                              <div className="flex items-center space-x-1 text-xs">
                                <span className={`${
                                  new Date(ticket.dueDate) < new Date() && ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED'
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                                }`}>
                                  {new Date(ticket.dueDate).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            )}
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-xs text-gray-500">
                                #{ticket.id.slice(0, 8)}
                              </span>
                              {isUpdating && (
                                <div className="w-4 h-4 border-2 border-etus-green border-t-transparent rounded-full animate-spin" />
                              )}
                            </div>
                            {/* Dica de swipe */}
                            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-500">
                              {canSwipeLeft && <span className="hidden md:inline">← Arraste para voltar</span>}
                              {canSwipeLeft && canSwipeRight && <span className="hidden md:inline">•</span>}
                              {canSwipeRight && <span className="hidden md:inline">Arraste para avançar →</span>}
                              {/* Mobile */}
                              {canSwipeLeft && <span className="md:hidden">← Anterior</span>}
                              {canSwipeLeft && canSwipeRight && <span className="md:hidden">•</span>}
                              {canSwipeRight && <span className="md:hidden">Próximo →</span>}
                            </div>
                          </div>
                        );
                      })}
                      {statusTickets.length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          Nenhum ticket
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Drag Overlay - Renderizado via Portal no body */}
      {isDragging.current && draggingTicket.current && dragOffset.current && swipeStartX.current !== null && swipeStartY.current !== null && dragMouseOffset.current && 
        createPortal(
          <div
            className="fixed pointer-events-none z-[99999]"
            style={{
              left: `${swipeStartX.current + dragOffset.current.x}px`,
              top: `${swipeStartY.current + dragOffset.current.y}px`,
              width: cardElementRef.current ? `${cardElementRef.current.offsetWidth}px` : '288px',
              transform: `translate(-${dragMouseOffset.current.x}px, -${dragMouseOffset.current.y}px) rotate(2deg)`,
            }}
          >
            <div className="block bg-gray-800 rounded-lg p-3 border-2 border-etus-green shadow-2xl cursor-grabbing">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-white line-clamp-2 flex-1">
                  {draggingTicket.current.title}
                </h4>
                <span
                  className={`ml-2 flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${getPriorityColor(
                    draggingTicket.current.priority
                  )}`}
                >
                  {draggingTicket.current.priority}
                </span>
              </div>
              {draggingTicket.current.assignedTechnician && (
                <div className="flex items-center space-x-1 mb-2">
                  <div className="w-6 h-6 rounded-full bg-etus-green flex items-center justify-center text-xs font-semibold text-gray-900">
                    {draggingTicket.current.assignedTechnician.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-400 truncate">
                    {draggingTicket.current.assignedTechnician.name}
                  </span>
                </div>
              )}
              {draggingTicket.current.dueDate && (
                <div className="flex items-center space-x-1 text-xs">
                  <span className={`${
                    new Date(draggingTicket.current.dueDate) < new Date() && draggingTicket.current.status !== 'CLOSED' && draggingTicket.current.status !== 'RESOLVED'
                      ? 'text-red-400'
                      : 'text-gray-400'
                  }`}>
                    {new Date(draggingTicket.current.dueDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  #{draggingTicket.current.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ModernLayout>
  );
};

export default TicketsPage;
