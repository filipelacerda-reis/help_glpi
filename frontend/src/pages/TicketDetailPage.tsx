import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ticketService, Ticket, TicketComment } from '../services/ticket.service';
import { userService } from '../services/user.service';
import { teamService, Team } from '../services/team.service';
import { tagService, Tag } from '../services/tag.service';
import { ticketEventService, TicketEvent } from '../services/ticketEvent.service';
import { ticketRelationService, TicketRelation } from '../services/ticketRelation.service';
import { worklogService, Worklog } from '../services/worklog.service';
import { satisfactionService, Satisfaction } from '../services/satisfaction.service';
import { kbService, KbArticle } from '../services/kb.service';
import { RichTextEditor } from '../components/RichTextEditor';
import { FileUpload } from '../components/FileUpload';
import { UserAutocomplete } from '../components/UserAutocomplete';
import DOMPurify from 'dompurify';
import ModernLayout from '../components/ModernLayout';
import DarkModal from '../components/DarkModal';
import { marked } from 'marked';
import {
  Edit,
  Plus,
  Link as LinkIcon,
  Star,
  MessageSquare,
  Clock,
  CheckCircle,
  Info,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Configurar marked para preservar quebras de linha e espaços
marked.setOptions({
  breaks: true,
  gfm: true,
});

const TicketDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [commentType, setCommentType] = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC');
  const [submitting, setSubmitting] = useState(false);
  const [commentImages, setCommentImages] = useState<File[]>([]);
  
  // Handlers para novos componentes
  const handleCommentContentChange = (value: string) => {
    setCommentContent(value);
  };

  const handleCommentFilesSelected = (files: File[]) => {
    setCommentImages(files);
  };

  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [, setTeamMembers] = useState<any[]>([]);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editingTags, setEditingTags] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showAddObserverModal, setShowAddObserverModal] = useState(false);
  const [selectedObserverId, setSelectedObserverId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'relations'>('details');
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [relations, setRelations] = useState<{ outgoing: TicketRelation[]; incoming: TicketRelation[] } | null>(null);
  const [worklogs, setWorklogs] = useState<Worklog[]>([]);
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [showSatisfactionModal, setShowSatisfactionModal] = useState(false);
  const [satisfactionScore, setSatisfactionScore] = useState<number>(5);
  const [satisfactionComment, setSatisfactionComment] = useState<string>('');
  const [kbArticles, setKbArticles] = useState<Array<{ article: KbArticle; createdAt: string }>>([]);
  const [showAddRelationModal, setShowAddRelationModal] = useState(false);
  const [relationTicketId, setRelationTicketId] = useState<string>('');
  const [relationType, setRelationType] = useState<TicketRelation['relationType']>('CHILD_OF');
  const [showKbSearchModal, setShowKbSearchModal] = useState(false);
  const [kbSearchQuery, setKbSearchQuery] = useState('');
  const [kbSearchResults, setKbSearchResults] = useState<KbArticle[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;

      try {
        const [ticketData, commentsData] = await Promise.all([
          ticketService.getTicketById(id),
          ticketService.getComments(id),
        ]);
        setTicket(ticketData);
        setComments(commentsData);

        // Carregar times e tags
        const [teamsData, tagsData] = await Promise.all([
          teamService.getAllTeams(),
          tagService.getAllTags({ isActive: true }),
        ]);
        setTeams(teamsData);
        setTags(tagsData);
        
        // Inicializar tags selecionadas do ticket
        if (ticketData.tags) {
          setSelectedTagIds(ticketData.tags.map((tt: any) => tt.tagId));
        }

        // Se o ticket tem um time, verificar se o usuário é membro
        if (ticketData.teamId && user) {
          try {
            const membership = await teamService.checkUserMembership(ticketData.teamId);
            setIsTeamMember(membership.isMember);
            setIsTeamLead(membership.isLead);
            const members = membership.members.map((m) => m.user);
            setTeamMembers(members);
            
            // Se for líder do time, carregar membros para atribuição
            if (membership.isLead) {
              setUsers(members);
            }
          } catch (err) {
            console.error('Erro ao verificar associação ao time:', err);
          }
        }

        // Carregar usuários para atribuição (se for triagista/admin)
        if (user?.role === 'TRIAGER' || user?.role === 'ADMIN') {
          try {
            const usersData = await userService.getAllUsers();
            setUsers(usersData.filter((u) => u.role === 'TECHNICIAN'));
            // Carregar todos os usuários para o modal de observadores
            setAllUsers(usersData);
          } catch (err) {
            console.error('Erro ao carregar usuários:', err);
          }
        }

        // Carregar observadores do ticket
        try {
          await ticketService.getObservers(id);
          // Os observadores já vêm no ticket, mas podemos atualizar se necessário
        } catch (err) {
          console.error('Erro ao carregar observadores:', err);
        }

        // Carregar dados adicionais
        await loadAdditionalData(id);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao carregar ticket');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, user]);

  const loadAdditionalData = async (ticketId: string) => {
    try {
      const [eventsData, relationsData, worklogsData, satisfactionData, kbArticlesData] = await Promise.all([
        ticketEventService.getTicketEvents(ticketId, { pageSize: 100 }).catch(() => ({ events: [], pagination: { total: 0 } })),
        ticketRelationService.getTicketRelations(ticketId).catch(() => ({ outgoing: [], incoming: [] })),
        worklogService.getTicketWorklogs(ticketId).catch(() => []),
        satisfactionService.getTicketSatisfaction(ticketId).catch(() => null),
        kbService.getTicketArticles(ticketId).catch(() => []),
      ]);

      setEvents(eventsData.events || []);
      setRelations(relationsData);
      setWorklogs(worklogsData);
      setSatisfaction(satisfactionData);
      setKbArticles(kbArticlesData);
    } catch (err) {
      console.error('Erro ao carregar dados adicionais:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !commentContent.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('content', commentContent);
      formData.append('type', commentType);
      if (user?.id) {
        formData.append('authorId', user.id);
      }

      commentImages.forEach((image) => {
        formData.append('images', image);
      });

      await ticketService.addCommentWithImages(id, formData);
      setCommentContent('');
      setCommentImages([]);
      const updatedComments = await ticketService.getComments(id);
      setComments(updatedComments);
      // Recarregar eventos para incluir o novo comentário
      await loadAdditionalData(id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao adicionar comentário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!id) return;

    try {
      const updatedTicket = await ticketService.updateTicket(id, { status: newStatus });
      setTicket(updatedTicket);
      await loadAdditionalData(id); // Recarregar eventos
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar status');
    }
  };

  const handleAssignTechnician = async (technicianId: string | null) => {
    if (!id) return;

    try {
      const updatedTicket = await ticketService.updateTicket(id, {
        assignedTechnicianId: technicianId,
      });
      setTicket(updatedTicket);
      await loadAdditionalData(id); // Recarregar eventos
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atribuir técnico');
    }
  };

  const handleUpdatePriority = async (priority: string) => {
    if (!id) return;

    try {
      const updatedTicket = await ticketService.updateTicket(id, { priority });
      setTicket(updatedTicket);
      await loadAdditionalData(id); // Recarregar eventos
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar prioridade');
    }
  };

  const handleAssignTeam = async (teamId: string | null) => {
    if (!id) return;

    try {
      const updatedTicket = await ticketService.updateTicket(id, {
        teamId: teamId,
      });
      setTicket(updatedTicket);
      // Recarregar dados de associação ao time se mudou
      if (teamId && user) {
        const membership = await teamService.checkUserMembership(teamId);
        setIsTeamMember(membership.isMember);
        setIsTeamLead(membership.isLead);
        setTeamMembers(membership.members.map((m) => m.user));
      } else {
        setIsTeamMember(false);
        setIsTeamLead(false);
        setTeamMembers([]);
      }
      await loadAdditionalData(id); // Recarregar eventos
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atribuir time');
    }
  };

  const handleTakeTicket = async () => {
    if (!id || !user) return;

    try {
      const updatedTicket = await ticketService.updateTicket(id, {
        assignedTechnicianId: user.id,
        status: 'IN_PROGRESS',
      });
      setTicket(updatedTicket);
      await loadAdditionalData(id); // Recarregar eventos
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao assumir ticket');
    }
  };

  // Funções de observadores
  const handleAddObserver = () => {
    setShowAddObserverModal(true);
    // Carregar todos os usuários para o modal
    if (allUsers.length === 0) {
      userService.getAllUsers().then((users) => {
        setAllUsers(users);
      }).catch((err) => {
        console.error('Erro ao carregar usuários:', err);
      });
    }
  };

  const handleRemoveObserver = async (observerId: string) => {
    if (!id) return;
    try {
      await ticketService.removeObserver(id, observerId);
      const updatedTicket = await ticketService.getTicketById(id);
      setTicket(updatedTicket);
      await loadAdditionalData(id); // Recarregar eventos
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao remover observador');
    }
  };

  const handleConfirmAddObserver = async (selectedIds: string[]) => {
    if (!id || selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map(observerId => ticketService.addObserver(id, observerId)));
      const updatedTicket = await ticketService.getTicketById(id);
      setTicket(updatedTicket);
      setShowAddObserverModal(false);
      setSelectedObserverId(''); // Resetar para o próximo uso
      await loadAdditionalData(id); // Recarregar eventos
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao adicionar observador');
    }
  };

  const handleAddRelation = async () => {
    if (!id || !relationTicketId) return;
    try {
      await ticketRelationService.createRelation(id, {
        relatedTicketId: relationTicketId,
        relationType,
      });
      await loadAdditionalData(id);
      setShowAddRelationModal(false);
      setRelationTicketId('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao adicionar relação');
    }
  };

  const handleRemoveRelation = async (relatedTicketId: string, relationType: TicketRelation['relationType']) => {
    if (!id) return;
    try {
      await ticketRelationService.removeRelation(id, relatedTicketId, relationType);
      await loadAdditionalData(id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao remover relação');
    }
  };

  const handleSubmitSatisfaction = async () => {
    if (!id) return;
    try {
      await satisfactionService.createOrUpdateSatisfaction(id, {
        score: satisfactionScore,
        comment: satisfactionComment,
      });
      const updated = await satisfactionService.getTicketSatisfaction(id);
      setSatisfaction(updated);
      setShowSatisfactionModal(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar avaliação');
    }
  };

  const getEventLabel = (event: TicketEvent): string => {
    const actorName = event.actor?.name || 'Sistema';
    const time = new Date(event.createdAt).toLocaleString('pt-BR');

    switch (event.eventType) {
      case 'CREATED':
        return `Ticket criado por ${actorName} em ${time}`;
      case 'STATUS_CHANGED':
        const oldStatus = event.oldValue?.status || 'N/A';
        const newStatus = event.newValue?.status || 'N/A';
        return `Status alterado de ${oldStatus} para ${newStatus} por ${actorName} em ${time}`;
      case 'PRIORITY_CHANGED':
        const oldPriority = event.oldValue?.priority || 'N/A';
        const newPriority = event.newValue?.priority || 'N/A';
        return `Prioridade alterada de ${oldPriority} para ${newPriority} por ${actorName} em ${time}`;
      case 'ASSIGNED':
        return `Ticket atribuído por ${actorName} em ${time}`;
      case 'UNASSIGNED':
        return `Atribuição removida por ${actorName} em ${time}`;
      case 'TEAM_CHANGED':
        return `Time alterado por ${actorName} em ${time}`;
      case 'COMMENT_ADDED':
        return `Comentário adicionado por ${actorName} em ${time}`;
      case 'ATTACHMENT_ADDED':
        return `Anexo adicionado por ${actorName} em ${time}`;
      case 'ATTACHMENT_REMOVED':
        return `Anexo removido por ${actorName} em ${time}`;
      case 'TAG_ADDED':
        return `Tag adicionada por ${actorName} em ${time}`;
      case 'TAG_REMOVED':
        return `Tag removida por ${actorName} em ${time}`;
      case 'SLA_STARTED':
        return `SLA iniciado em ${time}`;
      case 'SLA_BREACHED':
        return `SLA violado em ${time}`;
      case 'SLA_MET':
        return `SLA cumprido em ${time}`;
      case 'AUTOMATION_TRIGGERED':
        return `Automação executada em ${time}`;
      case 'RELATION_ADDED':
        return `Relação adicionada por ${actorName} em ${time}`;
      case 'RELATION_REMOVED':
        return `Relação removida por ${actorName} em ${time}`;
      default:
        return `${event.eventType} por ${actorName} em ${time}`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-blue-500/20 text-blue-400';
      case 'IN_PROGRESS':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'WAITING_REQUESTER':
      case 'WAITING_THIRD_PARTY':
        return 'bg-orange-500/20 text-orange-400';
      case 'RESOLVED':
        return 'bg-green-500/20 text-green-400';
      case 'CLOSED':
        return 'bg-gray-500/20 text-slate-500 dark:text-slate-400';
      default:
        return 'bg-gray-500/20 text-slate-500 dark:text-slate-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-green-500/20 text-green-400';
      case 'MEDIUM':
        return 'bg-blue-500/20 text-blue-400';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400';
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-slate-500 dark:text-slate-400';
    }
  };

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

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      LOW: 'Baixa',
      MEDIUM: 'Média',
      HIGH: 'Alta',
      CRITICAL: 'Crítica',
    };
    return labels[priority] || priority;
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      INCIDENT: 'Incidente',
      SERVICE_REQUEST: 'Solicitação de Serviço',
      PROBLEM: 'Problema',
      CHANGE: 'Mudança',
      TASK: 'Tarefa',
      QUESTION: 'Dúvida',
    };
    return labels[tipo] || tipo;
  };

  const getInfraTipoLabel = (infraTipo: string) => {
    const labels: Record<string, string> = {
      LOCAL: 'Local',
      NUVEM: 'Nuvem',
      HIBRIDA: 'Híbrida',
      ESTACAO_TRABALHO: 'Estação de Trabalho',
      REDE_LOCAL: 'Rede Local',
      SERVIDOR_FISICO: 'Servidor Físico',
    };
    return labels[infraTipo] || infraTipo;
  };

  const formatBusinessMinutes = (minutes: number | null | undefined): string => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const handleUpdateTags = async () => {
    if (!id) return;
    
    try {
      const updatedTicket = await ticketService.updateTicket(id, {
        tagIds: selectedTagIds,
      });
      setTicket(updatedTicket);
      setEditingTags(false);
      await loadAdditionalData(id); // Recarregar eventos
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar tags');
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const getTagsByGroup = (group: Tag['group']) => {
    return tags.filter((tag) => tag.group === group);
  };

  const getGroupLabel = (group: Tag['group']): string => {
    const labels: Record<Tag['group'], string> = {
      FEATURE: 'Feature',
      AREA: 'Área Impactada',
      ENV: 'Ambiente',
      PLATFORM: 'Plataforma',
      SOURCE: 'Origem',
      IMPACT: 'Impacto',
      RC: 'Causa Raiz',
      STATUS_REASON: 'Motivo do Status',
      WORK: 'Tipo de Trabalho',
      QUESTION: 'Tipo de Dúvida',
      INFRA: 'Infraestrutura',
    };
    return labels[group] || group;
  };

  if (loading) {
    return (
      <ModernLayout title="Carregando Ticket..." subtitle="Detalhes e histórico do chamado">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  if (!ticket) {
    return (
      <ModernLayout title="Ticket Não Encontrado" subtitle="O ticket solicitado não existe ou você não tem permissão para visualizá-lo.">
        <div className="text-center py-12">
          <p className="text-red-400">Ticket não encontrado</p>
          <button
            onClick={() => navigate('/tickets')}
            className="mt-4 text-indigo-600 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-400-light transition-colors"
          >
            ← Voltar para lista
          </button>
        </div>
      </ModernLayout>
    );
  }

  const canEdit = user?.role === 'TECHNICIAN' || user?.role === 'TRIAGER' || user?.role === 'ADMIN' || isTeamMember;
  const canClose = user?.role === 'REQUESTER' && ticket.status === 'RESOLVED';
  const canTakeTicket = isTeamMember && !ticket.assignedTechnicianId && ticket.status === 'OPEN';
  const canAssignToTeamMember = isTeamLead && ticket.teamId;
  const canMoveTicket = isTeamMember && ticket.teamId;

  return (
    <ModernLayout
      title={`Ticket #${ticket.id.slice(0, 8)} - ${ticket.title}`}
      subtitle="Detalhes e histórico do chamado"
    >
      <div className="max-w-5xl mx-auto">
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-slate-200 dark:border-slate-700/60">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                ${activeTab === 'details'
                  ? 'border-etus-green text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-gray-200 hover:border-gray-500'
                }`}
            >
              <Info className="w-4 h-4" />
              <span>Detalhes</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                ${activeTab === 'history'
                  ? 'border-etus-green text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-gray-200 hover:border-gray-500'
                }`}
            >
              <Clock className="w-4 h-4" />
              <span>Histórico</span>
            </button>
            <button
              onClick={() => setActiveTab('relations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                ${activeTab === 'relations'
                  ? 'border-etus-green text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-gray-200 hover:border-gray-500'
                }`}
            >
              <LinkIcon className="w-4 h-4" />
              <span>Relações</span>
            </button>
          </nav>
        </div>

        {activeTab === 'history' && (
          <div className="bg-slate-50 dark:bg-slate-900/40 backdrop-blur-sm shadow-lg rounded-lg p-6 mb-6 border border-slate-200 dark:border-slate-700/60">
            <h2 className="text-lg font-semibold text-white mb-4">Histórico do Ticket</h2>
            <div className="space-y-4">
              {events.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum evento registrado</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="flex items-start space-x-3 pb-4 border-b border-slate-200 dark:border-slate-700/60 last:border-0">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-600 mt-2"></div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-600 dark:text-slate-300">{getEventLabel(event)}</p>
                      {event.metadata && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <code className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 px-1 rounded">{JSON.stringify(event.metadata, null, 2)}</code>
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'relations' && (
          <div className="bg-slate-50 dark:bg-slate-900/40 backdrop-blur-sm shadow-lg rounded-lg p-6 mb-6 border border-slate-200 dark:border-slate-700/60">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">Tickets Relacionados</h2>
              {(user?.role === 'ADMIN' || user?.role === 'TRIAGER') && (
                <button
                  onClick={() => setShowAddRelationModal(true)}
                  className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-400-light hover:bg-indigo-600/20 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Relação</span>
                </button>
              )}
            </div>
            <div className="space-y-4">
              {relations && (relations.outgoing.length > 0 || relations.incoming.length > 0) ? (
                <>
                  {relations.outgoing.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Relacionamentos de Saída</h3>
                      {relations.outgoing.map((rel) => (
                        <div key={`${rel.ticketId}-${rel.relatedTicketId}-${rel.relationType}`} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg mb-2 border border-slate-200 dark:border-slate-700">
                          <div>
                            <span className="text-sm font-medium text-white">
                              {rel.relationType.replace('_', ' ')}: #{rel.relatedTicketId.substring(0, 8)}
                            </span>
                            {rel.relatedTicket && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">{rel.relatedTicket.title}</p>
                            )}
                          </div>
                          {(user?.role === 'ADMIN' || user?.role === 'TRIAGER') && (
                            <button
                              onClick={() => handleRemoveRelation(rel.relatedTicketId, rel.relationType)}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {relations.incoming.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Relacionamentos de Entrada</h3>
                      {relations.incoming.map((rel) => (
                        <div key={`${rel.ticketId}-${rel.relatedTicketId}-${rel.relationType}`} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg mb-2 border border-slate-200 dark:border-slate-700">
                          <div>
                            <span className="text-sm font-medium text-white">
                              {rel.relationType.replace('_', ' ')}: #{rel.relatedTicketId.substring(0, 8)}
                            </span>
                            {rel.relatedTicket && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">{rel.relatedTicket.title}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum ticket relacionado</p>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo principal - apenas na aba de detalhes */}
        {activeTab === 'details' && ticket && (
          <>
        <div className="bg-slate-50 dark:bg-slate-900/40 backdrop-blur-sm shadow-lg rounded-lg p-6 mb-6 border border-slate-200 dark:border-slate-700/60">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                #{ticket.id.slice(0, 8)} - {ticket.title}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Criado em {new Date(ticket.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                {getStatusLabel(ticket.status)}
              </span>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getPriorityColor(ticket.priority)}`}>
                {getPriorityLabel(ticket.priority)}
              </span>
              <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-500/20 text-blue-400">
                {getTipoLabel(ticket.tipo)}
              </span>
              {ticket.infraTipo && (
                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-purple-500/20 text-purple-400">
                  {getInfraTipoLabel(ticket.infraTipo)}
                </span>
              )}
            </div>
          </div>

          <div className="mb-4">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Descrição</h2>
            <div 
              className="text-slate-600 dark:text-slate-300 prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.description) }}
            />
          </div>

          {/* Exibir imagens anexadas */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Anexos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {ticket.attachments.map((attachment) => (
                  <div key={attachment.id} className="relative">
                    <a
                      href={attachment.url || `/uploads/tickets/${attachment.filePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={attachment.url || `/uploads/tickets/${attachment.filePath}`}
                        alt={attachment.fileName}
                        className="w-full h-32 object-cover rounded-md border border-slate-300 dark:border-slate-700 hover:opacity-75 cursor-pointer"
                      />
                    </a>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{attachment.fileName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Solicitante</p>
              <p className="text-sm text-white">{ticket.requester.name}</p>
            </div>
            {ticket.assignedTechnician && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Técnico Responsável</p>
                <p className="text-sm text-white">{ticket.assignedTechnician.name}</p>
              </div>
            )}
            {ticket.category && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Categoria</p>
                <p className="text-sm text-white">{ticket.category.name}</p>
              </div>
            )}
            {ticket.team && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Time Responsável</p>
                <p className="text-sm text-white">{ticket.team.name}</p>
              </div>
            )}
            {ticket.teamSolicitante && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Time Solicitante</p>
                <p className="text-sm text-white">{ticket.teamSolicitante.name}</p>
              </div>
            )}
          </div>

          {/* Observadores */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Observadores</h3>
              {(user?.role === 'ADMIN' || user?.role === 'TRIAGER' || user?.id === ticket.requesterId || user?.id === ticket.assignedTechnicianId) && (
                <button
                  type="button"
                  onClick={handleAddObserver}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-400-light transition-colors"
                >
                  <Plus className="inline-block w-3 h-3 mr-1" /> Adicionar Observador
                </button>
              )}
            </div>
            {ticket.observers && ticket.observers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ticket.observers.map((obs) => (
                  <div
                    key={obs.observerId}
                    className="flex items-center gap-2 px-2 py-1 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-full text-sm text-slate-600 dark:text-slate-300"
                  >
                    <span>{obs.observer.name}</span>
                    {(user?.role === 'ADMIN' || user?.id === ticket.requesterId || user?.id === ticket.assignedTechnicianId || user?.id === obs.observerId) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveObserver(obs.observerId)}
                        className="text-red-400 hover:text-red-300 text-xs"
                        title="Remover observador"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum observador adicionado</p>
            )}
          </div>

          {/* Tempos em Horário Comercial */}
          {(ticket.firstResponseBusinessMinutes !== null || ticket.resolutionBusinessMinutes !== null || ticket.closureBusinessMinutes !== null) && (
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Tempos (Horário Comercial)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                {ticket.firstResponseBusinessMinutes !== null && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Primeira Resposta: </span>
                    <span className="font-medium text-white">{formatBusinessMinutes(ticket.firstResponseBusinessMinutes)}</span>
                  </div>
                )}
                {ticket.resolutionBusinessMinutes !== null && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Resolução: </span>
                    <span className="font-medium text-white">{formatBusinessMinutes(ticket.resolutionBusinessMinutes)}</span>
                  </div>
                )}
                {ticket.closureBusinessMinutes !== null && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Fechamento: </span>
                    <span className="font-medium text-white">{formatBusinessMinutes(ticket.closureBusinessMinutes)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gestão de Projetos - Barra de Progresso de Tarefas Filhas */}
          {relations && relations.outgoing.some((r) => r.relationType === 'PARENT_OF') && (
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Progresso das Tarefas</h3>
              {(() => {
                const childTickets = relations.outgoing
                  .filter((r) => r.relationType === 'PARENT_OF')
                  .map((r) => r.relatedTicket)
                  .filter((t): t is NonNullable<typeof t> => t !== undefined);
                const totalTasks = childTickets.length;
                const completedTasks = childTickets.filter(
                  (t) => t.status === 'RESOLVED' || t.status === 'CLOSED'
                ).length;
                const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                
                return (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {completedTasks} de {totalTasks} tarefas concluídas
                      </span>
                      <span className="text-sm font-semibold text-white">{progressPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          progressPercentage === 100 ? 'bg-green-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Gestão de Projetos - Prazos e Tempo */}
          {(ticket.dueDate || ticket.estimatedMinutes || (ticket.worklogs && ticket.worklogs.length > 0)) && (
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Prazos e Tempo</h3>
              <div className="space-y-3">
                {/* Due Date */}
                {ticket.dueDate && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">Data de Entrega: </span>
                    <span
                      className={`text-sm font-medium ${
                        new Date(ticket.dueDate) < new Date() && ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED'
                          ? 'text-red-400'
                          : 'text-white'
                      }`}
                    >
                      {new Date(ticket.dueDate).toLocaleString('pt-BR')}
                    </span>
                    {new Date(ticket.dueDate) < new Date() && ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                )}

                {/* Estimado vs Realizado */}
                {(ticket.estimatedMinutes || (ticket.worklogs && ticket.worklogs.length > 0)) && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Tempo: Estimado vs Realizado</h4>
                    {(() => {
                      const estimated = ticket.estimatedMinutes || 0;
                      const actual = ticket.worklogs
                        ? ticket.worklogs.reduce((sum, w) => sum + (w.durationMinutes || 0), 0)
                        : 0;
                      const chartData = [
                        { name: 'Estimado', value: estimated, color: '#10b981' },
                        { name: 'Realizado', value: actual, color: actual > estimated ? '#ef4444' : '#3b82f6' },
                      ];
                      
                      return (
                        <div>
                          <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Estimado: </span>
                              <span className="font-medium text-white">{Math.round(estimated / 60)}h {estimated % 60}m</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Realizado: </span>
                              <span className={`font-medium ${actual > estimated ? 'text-red-400' : 'text-white'}`}>
                                {Math.round(actual / 60)}h {actual % 60}m
                              </span>
                            </div>
                          </div>
                          <ResponsiveContainer width="100%" height={100}>
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis dataKey="name" stroke="#9ca3af" />
                              <YAxis stroke="#9ca3af" />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                formatter={(value: number) => `${Math.round(value / 60)}h ${value % 60}m`}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gestão de Projetos - Campos Personalizados */}
          {ticket.customFields && Object.keys(ticket.customFields).length > 0 && (
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Informações Adicionais</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(ticket.customFields).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{key}</p>
                    <p className="text-sm text-white">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {ticket.tags && ticket.tags.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tags</h3>
                {(user?.role === 'ADMIN' || user?.role === 'TRIAGER') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingTags) {
                        setEditingTags(false);
                        // Restaurar tags originais
                        if (ticket.tags) {
                          setSelectedTagIds(ticket.tags.map((tt: any) => tt.tagId));
                        }
                      } else {
                        setEditingTags(true);
                      }
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-400-light transition-colors"
                  >
                    <Edit className="inline-block w-3 h-3 mr-1" /> {editingTags ? 'Cancelar' : 'Editar'}
                  </button>
                )}
              </div>
              {editingTags ? (
                <div className="space-y-3">
                  {['FEATURE', 'AREA', 'ENV', 'PLATFORM', 'SOURCE', 'IMPACT', 'RC', 'STATUS_REASON', 'WORK', 'QUESTION', 'INFRA'].map((group) => {
                    const groupTags = getTagsByGroup(group as Tag['group']);
                    if (groupTags.length === 0) return null;
                    
                    return (
                      <div key={group} className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-2 bg-white dark:bg-slate-800">
                        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{getGroupLabel(group as Tag['group'])}</h4>
                        <div className="flex flex-wrap gap-1">
                          {groupTags.map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                                selectedTagIds.includes(tag.id)
                                  ? 'bg-indigo-600 text-gray-900 border-etus-green'
                                  : 'bg-gray-600/50 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-etus-green'
                              }`}
                            >
                              {tag.name.replace(/^(feature|area|env|platform|source|impact|rc|status_reason|work|question|infra):/, '')}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTags(false);
                        if (ticket.tags) {
                          setSelectedTagIds(ticket.tags.map((tt: any) => tt.tagId));
                        }
                      }}
                      className="px-3 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateTags}
                      className="px-3 py-1 text-xs bg-indigo-600 text-gray-900 rounded-lg hover:bg-indigo-600-dark transition-colors"
                    >
                      Salvar Tags
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ticket.tags.map((tt: any) => {
                    const tag = tags.find((t) => t.id === tt.tagId);
                    if (!tag) return null;
                    
                    const groupColors: Record<Tag['group'], string> = {
                      FEATURE: 'bg-blue-500/20 text-blue-400',
                      AREA: 'bg-purple-500/20 text-purple-400',
                      ENV: 'bg-yellow-500/20 text-yellow-400',
                      PLATFORM: 'bg-indigo-500/20 text-indigo-400',
                      SOURCE: 'bg-pink-500/20 text-pink-400',
                      IMPACT: 'bg-red-500/20 text-red-400',
                      RC: 'bg-orange-500/20 text-orange-400',
                      STATUS_REASON: 'bg-gray-500/20 text-slate-500 dark:text-slate-400',
                      WORK: 'bg-teal-500/20 text-teal-400',
                      QUESTION: 'bg-cyan-500/20 text-cyan-400',
                      INFRA: 'bg-green-500/20 text-green-400',
                    };
                    
                    return (
                      <span
                        key={tt.tagId}
                        className={`px-2 py-1 text-xs rounded-full ${groupColors[tag.group] || 'bg-gray-500/20 text-slate-500 dark:text-slate-400'}`}
                        title={getGroupLabel(tag.group)}
                      >
                        {tag.name.replace(/^(feature|area|env|platform|source|impact|rc|status_reason|work|question|infra):/, '')}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Botão para assumir ticket (membros do time) */}
          {canTakeTicket && (
            <div className="border-t border-slate-200 dark:border-slate-700/60 pt-4 mt-4">
              <button
                onClick={handleTakeTicket}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg shadow-sm text-sm font-medium text-white transition-colors"
              >
                <CheckCircle className="inline-block w-4 h-4 mr-2" /> Assumir Ticket
              </button>
            </div>
          )}

          {canEdit && (
            <div className="border-t border-slate-200 dark:border-slate-700/60 pt-4 mt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={ticket.status}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white transition-all"
                  >
                    <option value="OPEN">Aberto</option>
                    <option value="IN_PROGRESS">Em Atendimento</option>
                    <option value="WAITING_REQUESTER">Aguardando Usuário</option>
                    <option value="WAITING_THIRD_PARTY">Aguardando Terceiros</option>
                    <option value="RESOLVED">Resolvido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Prioridade
                  </label>
                  <select
                    value={ticket.priority}
                    onChange={(e) => handleUpdatePriority(e.target.value)}
                    className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white transition-all"
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>

                {/* Atribuir técnico: ADMIN, TRIAGER ou líder do time */}
                {(user?.role === 'TRIAGER' || user?.role === 'ADMIN' || canAssignToTeamMember) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Técnico
                    </label>
                    <select
                      value={ticket.assignedTechnicianId || ''}
                      onChange={(e) =>
                        handleAssignTechnician(e.target.value || null)
                      }
                      className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white transition-all"
                    >
                      <option value="">Não atribuído</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Mover para outro time: ADMIN, TRIAGER ou membro do time */}
                {(user?.role === 'TRIAGER' || user?.role === 'ADMIN' || canMoveTicket) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Time
                    </label>
                    <select
                      value={ticket.teamId || ''}
                      onChange={(e) =>
                        handleAssignTeam(e.target.value || null)
                      }
                      className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white transition-all"
                    >
                      <option value="">Não atribuído</option>
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
          )}

          {canClose && (
            <div className="border-t border-slate-200 dark:border-slate-700/60 pt-4 mt-4">
              <button
                onClick={() => handleUpdateStatus('CLOSED')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg shadow-sm text-sm font-medium text-white transition-colors"
              >
                <CheckCircle className="inline-block w-4 h-4 mr-2" /> Fechar Ticket
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 backdrop-blur-sm shadow-lg rounded-lg p-6 mb-6 border border-slate-200 dark:border-slate-700/60">
          <h2 className="text-lg font-semibold text-white mb-4">Comentários</h2>

          <div className="space-y-4 mb-6">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className={`border-l-4 pl-4 py-2 rounded-r-lg ${
                  comment.type === 'INTERNAL'
                    ? 'border-orange-400 bg-orange-900/20'
                    : 'border-etus-green bg-indigo-600/10'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-medium text-white">{comment.author.name}</p>
                  <div className="flex items-center space-x-2">
                    {comment.type === 'INTERNAL' && (
                      <span className="text-xs px-2 py-1 bg-orange-500/30 text-orange-400 rounded">
                        Interno
                      </span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(comment.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div 
                  className="text-sm prose prose-invert max-w-none comment-content"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.content) }}
                />
                
                {/* Exibir imagens do comentário */}
                {comment.attachments && comment.attachments.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {comment.attachments.map((attachment) => (
                      <div key={attachment.id} className="relative">
                        <a
                          href={attachment.url || `/uploads/tickets/${attachment.filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={attachment.url || `/uploads/tickets/${attachment.filePath}`}
                            alt={attachment.fileName}
                            className="w-full h-24 object-cover rounded-md border border-slate-300 dark:border-slate-700 hover:opacity-75 cursor-pointer"
                          />
                        </a>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{attachment.fileName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleAddComment} className="border-t border-slate-200 dark:border-slate-700/60 pt-4">
            {canEdit && (
              <div className="mb-3">
                <label className="flex items-center text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={commentType === 'INTERNAL'}
                    onChange={(e) =>
                      setCommentType(e.target.checked ? 'INTERNAL' : 'PUBLIC')
                    }
                    className="mr-2 rounded border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 bg-gray-800"
                  />
                  <span className="text-sm">Comentário interno</span>
                </label>
              </div>
            )}
            
            <div className="mb-4">
              <RichTextEditor
                value={commentContent}
                onChange={handleCommentContentChange}
                placeholder="Adicione um comentário..."
                height="150px"
              />
            </div>
            
            {/* Upload de imagens para comentário */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Anexos (opcional)
              </label>
              <FileUpload
                onFilesSelected={handleCommentFilesSelected}
                maxFiles={10}
                maxSize={5 * 1024 * 1024} // 5MB
                accept={{
                  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-gray-900 rounded-lg shadow-sm text-sm font-semibold hover:bg-indigo-600-dark disabled:opacity-50 transition-colors"
            >
              <MessageSquare className="inline-block w-4 h-4 mr-2" /> {submitting ? 'Enviando...' : 'Adicionar Comentário'}
            </button>
          </form>
        </div>
          </>
        )}

      {/* Seção de CSAT - apenas para tickets fechados e solicitante */}
      {activeTab === 'details' && ticket && ticket.status === 'CLOSED' && user?.id === ticket.requesterId && (
        <div className="bg-slate-50 dark:bg-slate-900/40 backdrop-blur-sm shadow-lg rounded-lg p-6 mb-6 border border-slate-200 dark:border-slate-700/60">
          <h3 className="text-lg font-semibold text-white mb-4">Avaliar Atendimento</h3>
          {satisfaction ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Avaliação:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className={`w-5 h-5 ${star <= satisfaction.score ? 'text-yellow-400' : 'text-gray-600'}`} />
                  ))}
                </div>
              </div>
              {satisfaction.comment && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{satisfaction.comment}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowSatisfactionModal(true)}
              className="px-4 py-2 bg-indigo-600 text-gray-900 rounded-lg text-sm font-medium hover:bg-indigo-600-dark transition-colors"
            >
              <Star className="inline-block w-4 h-4 mr-2" /> Avaliar Atendimento
            </button>
          )}
        </div>
      )}

      {/* Seção de Worklogs */}
      {activeTab === 'details' && worklogs.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900/40 backdrop-blur-sm shadow-lg rounded-lg p-6 mb-6 border border-slate-200 dark:border-slate-700/60">
          <h3 className="text-lg font-semibold text-white mb-4">Worklogs</h3>
          <div className="space-y-2">
            {worklogs.map((worklog) => (
              <div key={worklog.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium text-white">{worklog.user.name}</p>
                  {worklog.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{worklog.description}</p>
                  )}
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {Math.floor(worklog.durationMinutes / 60)}h {worklog.durationMinutes % 60}min
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seção de Base de Conhecimento */}
      {activeTab === 'details' && (user?.role === 'ADMIN' || user?.role === 'TRIAGER' || user?.role === 'TECHNICIAN') && (
        <div className="bg-slate-50 dark:bg-slate-900/40 backdrop-blur-sm shadow-lg rounded-lg p-6 mb-6 border border-slate-200 dark:border-slate-700/60">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Artigos de Conhecimento</h3>
            <button
              onClick={() => {
                setShowKbSearchModal(true);
                setKbSearchQuery('');
                setKbSearchResults([]);
              }}
              className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-400-light hover:bg-indigo-600/20 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Vincular Artigo</span>
            </button>
          </div>
          {kbArticles.length > 0 ? (
            <div className="space-y-2">
              {kbArticles.map((item) => (
                <div key={item.article.id} className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-medium text-white">{item.article.title}</h4>
                  {item.article.category && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.article.category.name}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum artigo vinculado</p>
          )}
        </div>
      )}

      {/* Modal para adicionar observador */}
      <DarkModal
        isOpen={showAddObserverModal}
        onClose={() => {
          setShowAddObserverModal(false);
          setSelectedObserverId('');
        }}
        title="Adicionar Observador"
      >
        <UserAutocomplete
          selectedUserIds={selectedObserverId ? [selectedObserverId] : []}
          onSelectionChange={(ids) => setSelectedObserverId(ids[0] || '')}
          excludeUserIds={[
            ticket.requesterId,
            ...(ticket.assignedTechnicianId ? [ticket.assignedTechnicianId] : []),
            ...(ticket.observers?.map((obs: any) => obs.observerId) || [])
          ]}
          placeholder="Digite o nome ou email do usuário..."
          label="Selecione o usuário"
          darkTheme={true}
        />
        <div className="flex justify-end space-x-2 mt-4">
          <button
            type="button"
            onClick={() => {
              setShowAddObserverModal(false);
              setSelectedObserverId('');
            }}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleConfirmAddObserver(selectedObserverId ? [selectedObserverId] : [])}
            disabled={!selectedObserverId}
            className="px-4 py-2 bg-indigo-600 text-gray-900 rounded-lg text-sm font-medium hover:bg-indigo-600-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Adicionar
          </button>
        </div>
      </DarkModal>

      {/* Modal de CSAT */}
      <DarkModal
        isOpen={showSatisfactionModal}
        onClose={() => {
          setShowSatisfactionModal(false);
          setSatisfactionComment('');
          setSatisfactionScore(5);
        }}
        title="Avaliar Atendimento"
      >
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Nota (1-5)</label>
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setSatisfactionScore(star)}
                className={`text-3xl ${star <= satisfactionScore ? 'text-yellow-400' : 'text-gray-600'} hover:text-yellow-400`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Comentário (opcional)</label>
          <textarea
            value={satisfactionComment}
            onChange={(e) => setSatisfactionComment(e.target.value)}
            className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            rows={3}
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => {
              setShowSatisfactionModal(false);
              setSatisfactionComment('');
              setSatisfactionScore(5);
            }}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmitSatisfaction}
            className="px-4 py-2 bg-indigo-600 text-gray-900 rounded-lg text-sm font-medium hover:bg-indigo-600-dark"
          >
            Salvar
          </button>
        </div>
      </DarkModal>

      {/* Modal de busca de KB */}
      <DarkModal
        isOpen={showKbSearchModal}
        onClose={() => {
          setShowKbSearchModal(false);
          setKbSearchQuery('');
          setKbSearchResults([]);
        }}
        title="Buscar e Vincular Artigo"
        maxWidth="2xl"
      >
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar artigos..."
            value={kbSearchQuery}
            onChange={async (e) => {
              setKbSearchQuery(e.target.value);
              if (e.target.value.length > 2) {
                try {
                  const results = await kbService.searchArticles({
                    query: e.target.value,
                    status: 'PUBLISHED',
                    limit: 10,
                  });
                  setKbSearchResults(results);
                } catch (err) {
                  console.error('Erro ao buscar artigos:', err);
                }
              } else {
                setKbSearchResults([]);
              }
            }}
            className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {kbSearchResults.map((article) => (
            <div
              key={article.id}
              className="p-3 border border-slate-200 dark:border-slate-700/60 rounded-lg hover:border-etus-green cursor-pointer bg-white dark:bg-slate-800"
              onClick={async () => {
                if (id) {
                  try {
                    await kbService.linkArticleToTicket(id, article.id);
                    await loadAdditionalData(id);
                    setShowKbSearchModal(false);
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Erro ao vincular artigo');
                  }
                }
              }}
            >
              <h4 className="font-medium text-white">{article.title}</h4>
              {article.category && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{article.category.name}</p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {article.content.substring(0, 150)}...
              </p>
            </div>
          ))}
          {kbSearchQuery.length > 2 && kbSearchResults.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Nenhum artigo encontrado</p>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setShowKbSearchModal(false);
              setKbSearchQuery('');
              setKbSearchResults([]);
            }}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
          >
            Fechar
          </button>
        </div>
      </DarkModal>

      {/* Modal para adicionar relação */}
      <DarkModal
        isOpen={showAddRelationModal}
        onClose={() => {
          setShowAddRelationModal(false);
          setRelationTicketId('');
        }}
        title="Adicionar Relação"
      >
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">ID do Ticket Relacionado</label>
          <input
            type="text"
            value={relationTicketId}
            onChange={(e) => setRelationTicketId(e.target.value)}
            className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Digite o ID do ticket"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Tipo de Relação</label>
          <select
            value={relationType}
            onChange={(e) => setRelationType(e.target.value as TicketRelation['relationType'])}
            className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="CHILD_OF">Filho de</option>
            <option value="PARENT_OF">Pai de</option>
            <option value="DUPLICATE_OF">Duplicata de</option>
            <option value="CAUSED_BY">Causado por</option>
            <option value="BLOCKED_BY">Bloqueado por</option>
          </select>
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => {
              setShowAddRelationModal(false);
              setRelationTicketId('');
            }}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAddRelation}
            disabled={!relationTicketId}
            className="px-4 py-2 bg-indigo-600 text-gray-900 rounded-lg text-sm font-medium hover:bg-indigo-600-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Adicionar
          </button>
        </div>
      </DarkModal>
      </div>
    </ModernLayout>
  );
};

export default TicketDetailPage;

