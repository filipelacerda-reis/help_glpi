import { TicketStatus, TicketPriority, UserRole, TicketType, InfraType, InteractionType } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError, ErrorType } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { isUserTeamMember, isUserTeamLead, getTeamMembers, getUserTeams } from '../utils/team.utils';
import { notificationService } from './notification.service';
import { businessMinutesBetween, BusinessSchedule } from '../domain/time/businessTime.engine';
import { businessCalendarService } from './businessCalendar.service';
import * as ticketIntegrations from './ticketIntegrations.service';

export interface CreateTicketDto {
  title: string;
  description: string;
  categoryId?: string;
  priority?: TicketPriority;
  teamId: string; // Agora obrigatório
  tipo?: TicketType;
  infraTipo?: InfraType;
  teamSolicitanteId?: string;
  tagIds?: string[];
  // Gestão de Projetos
  dueDate?: Date | string;
  estimatedMinutes?: number;
  customFields?: Record<string, any>;
  parentTicketId?: string; // ID do ticket pai (para criar relação CHILD_OF)
}

export interface UpdateTicketDto {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTechnicianId?: string | null;
  categoryId?: string | null;
  teamId?: string | null;
  tipo?: TicketType;
  infraTipo?: InfraType;
  tagIds?: string[];
  // Gestão de Projetos
  dueDate?: Date | string | null;
  estimatedMinutes?: number | null;
  customFields?: Record<string, any> | null;
}

export interface CreateCommentDto {
  content: string;
  type: 'PUBLIC' | 'INTERNAL';
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });
  return `${values.year}-${values.month}-${values.day}`;
}

async function getDefaultBusinessSchedule(): Promise<BusinessSchedule> {
  const calendar = await businessCalendarService.getDefaultCalendar();
  const schedule = (calendar.schedule || {}) as Record<
    string,
    { open?: string; close?: string; enabled?: boolean }
  >;
  const timezone = calendar.timezone || 'America/Sao_Paulo';

  const exceptions = await prisma.businessCalendarException.findMany({
    where: { calendarId: calendar.id, isHoliday: true },
    select: { date: true },
  });
  const holidays = exceptions.map((exception) => formatDateInTimeZone(exception.date, timezone));

  const mapDay = (day: { open?: string; close?: string; enabled?: boolean } | undefined, enabled: boolean) => ({
    start: day?.open || '09:00',
    end: day?.close || '18:00',
    enabled: day?.enabled ?? enabled,
  });

  return {
    timezone,
    weekly: {
      0: mapDay(schedule.sunday, false),
      1: mapDay(schedule.monday, true),
      2: mapDay(schedule.tuesday, true),
      3: mapDay(schedule.wednesday, true),
      4: mapDay(schedule.thursday, true),
      5: mapDay(schedule.friday, true),
      6: mapDay(schedule.saturday, false),
    },
    holidays,
  };
}

async function validateTeamCategoryAndType(
  teamId: string,
  categoryId?: string | null,
  tipo?: TicketType | null
) {
  const teamCategories = await prisma.teamCategory.findMany({
    where: { teamId },
    select: { categoryId: true },
  });

  if (teamCategories.length > 0 && categoryId) {
    const allowed = new Set(teamCategories.map((c) => c.categoryId));
    if (!allowed.has(categoryId)) {
      throw new AppError(
        'Categoria não permitida para o time selecionado',
        400,
        ErrorType.VALIDATION_ERROR
      );
    }
  }

  const teamTicketTypes = await prisma.teamTicketType.findMany({
    where: { teamId },
    select: { ticketType: true },
  });

  if (teamTicketTypes.length > 0 && tipo) {
    const allowed = new Set(teamTicketTypes.map((t) => t.ticketType));
    if (!allowed.has(tipo)) {
      throw new AppError(
        'Tipo de ticket não permitido para o time selecionado',
        400,
        ErrorType.VALIDATION_ERROR
      );
    }
  }
}

export const ticketService = {
  async createTicket(
    userId: string,
    data: CreateTicketDto,
    attachments?: Array<{
      fileName: string;
      filePath: string;
      fileSize: number;
      mimeType: string;
    }>
  ) {
    logger.debug('Criando novo ticket', { userId, title: data.title, priority: data.priority, teamId: data.teamId, tipo: data.tipo });

    // Validar se o time existe e tem membros
    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
      include: {
        users: {
          select: { userId: true },
        },
      },
    });

    if (!team) {
      logger.warn('Tentativa de criar ticket com time inexistente', { teamId: data.teamId, userId });
      throw new AppError('Time não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
    }

    if (team.users.length === 0) {
      logger.warn('Tentativa de criar ticket para time sem membros', { teamId: data.teamId, userId });
      throw new AppError('O time selecionado não possui membros. Adicione membros ao time antes de criar tickets.', 400, ErrorType.VALIDATION_ERROR);
    }

    await validateTeamCategoryAndType(data.teamId, data.categoryId, data.tipo);

    // Determinar teamSolicitanteId se não fornecido
    let teamSolicitanteId = data.teamSolicitanteId;
    if (!teamSolicitanteId) {
      // Tentar inferir do usuário solicitante
      const userTeams = await getUserTeams(userId);
      if (userTeams.length > 0) {
        teamSolicitanteId = userTeams[0]; // Usar o primeiro time do usuário
      }
    }

    // Validar ticket pai se fornecido
    if (data.parentTicketId) {
      const parentTicket = await prisma.ticket.findUnique({
        where: { id: data.parentTicketId },
      });
      if (!parentTicket) {
        throw new AppError('Ticket pai não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        requesterId: userId,
        priority: data.priority || TicketPriority.MEDIUM,
        categoryId: data.categoryId,
        teamId: data.teamId, // Agora obrigatório
        tipo: data.tipo || TicketType.INCIDENT,
        infraTipo: data.infraTipo,
        teamSolicitanteId,
        status: TicketStatus.OPEN,
        // Gestão de Projetos
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        estimatedMinutes: data.estimatedMinutes || null,
        customFields: data.customFields || undefined,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTechnician: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: true,
        team: true,
        teamSolicitante: true,
        tags: {
          include: {
            tag: true,
          },
        },
        observers: {
          include: {
            observer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Adicionar tags se fornecidas
    if (data.tagIds && data.tagIds.length > 0) {
      await prisma.ticketTag.createMany({
        data: data.tagIds.map((tagId) => ({
          ticketId: ticket.id,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    // Criar relação CHILD_OF se parentTicketId for fornecido
    if (data.parentTicketId) {
      await prisma.ticketRelation.create({
        data: {
          ticketId: ticket.id,
          relatedTicketId: data.parentTicketId,
          relationType: 'CHILD_OF',
        },
      });
      // Criar relação inversa PARENT_OF no ticket pai
      await prisma.ticketRelation.create({
        data: {
          ticketId: data.parentTicketId,
          relatedTicketId: ticket.id,
          relationType: 'PARENT_OF',
        },
      });
    }

    // Registrar histórico inicial
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: ticket.id,
        newStatus: TicketStatus.OPEN,
        changedById: userId,
      },
    });

    logger.info('Ticket criado com sucesso', {
      ticketId: ticket.id,
      requesterId: userId,
      status: ticket.status,
      priority: ticket.priority,
      tipo: ticket.tipo,
    });

    // Recarregar ticket com tags
    const finalTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTechnician: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: true,
        team: true,
        teamSolicitante: true,
        tags: {
          include: {
            tag: true,
          },
        },
        observers: {
          include: {
            observer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Criar anexos se houver
    if (attachments && attachments.length > 0 && finalTicket) {
      await Promise.all(
        attachments.map((att) =>
          prisma.ticketAttachment.create({
            data: {
              ticketId: finalTicket.id,
              fileName: att.fileName,
              filePath: att.filePath,
              fileSize: att.fileSize,
              mimeType: att.mimeType,
              uploadedById: userId,
            },
          })
        )
      );

      // Recarregar ticket com anexos incluídos
      const ticketWithAttachments = await prisma.ticket.findUnique({
        where: { id: finalTicket.id },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignedTechnician: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          category: true,
          team: true,
          teamSolicitante: true,
          tags: {
            include: {
              tag: true,
            },
          },
          observers: {
            include: {
              observer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          attachments: {
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (ticketWithAttachments) {
        return ticketWithAttachments;
      }
    }

    // Registrar evento de criação e iniciar integrações (SLA, automações)
    if (finalTicket) {
      await ticketIntegrations.recordTicketCreated(finalTicket.id, userId, finalTicket);
      
      // Criar entrada automática no diário se o criador for técnico/triagista/admin
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        if (user && (user.role === UserRole.TECHNICIAN || user.role === UserRole.TRIAGER || user.role === UserRole.ADMIN)) {
          const { technicianJournalService } = await import('./technicianJournal.service');
          await (technicianJournalService as any).createAutoEntryForTicketCreated(finalTicket, userId);
        }
      } catch (err) {
        logger.warn('Erro ao criar entrada automática no diário para ticket criado', {
          error: err instanceof Error ? err.message : String(err),
          ticketId: finalTicket.id,
        });
      }
    }

    return finalTicket;
  },

  async getTickets(userId: string, userRole: UserRole, filters?: {
    status?: TicketStatus;
    priority?: TicketPriority;
    categoryId?: string;
    assignedTechnicianId?: string;
    requesterId?: string;
    teamId?: string;
    tipo?: TicketType;
    teamSolicitanteId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    // Filtros por papel
    if (userRole === UserRole.REQUESTER) {
      // Requester vê seus próprios tickets e tickets que observa
      const observedTickets = await prisma.ticketObserver.findMany({
        where: { observerId: userId },
        select: { ticketId: true },
      });
      const observedTicketIds = observedTickets.map((ot) => ot.ticketId);
      
      if (observedTicketIds.length > 0) {
        where.OR = [
          { requesterId: userId },
          { id: { in: observedTicketIds } },
        ];
      } else {
        where.requesterId = userId;
      }
    } else if (userRole === UserRole.TECHNICIAN) {
      // Técnico vê tickets atribuídos a ele, do seu time ou que ele observa
      const userTeams = await prisma.userTeam.findMany({
        where: { userId },
        select: { teamId: true },
      });
      const teamIds = userTeams.map((ut) => ut.teamId);
      
      // Buscar tickets que o usuário observa
      const observedTickets = await prisma.ticketObserver.findMany({
        where: { observerId: userId },
        select: { ticketId: true },
      });
      const observedTicketIds = observedTickets.map((ot) => ot.ticketId);
      
      // Construir condições OR apenas se houver times ou tickets observados
      const orConditions: any[] = [{ assignedTechnicianId: userId }];
      
      if (teamIds.length > 0) {
        orConditions.push({ teamId: { in: teamIds } });
      }
      
      if (observedTicketIds.length > 0) {
        orConditions.push({ id: { in: observedTicketIds } });
      }
      
      // Se não houver condições OR válidas, usar apenas assignedTechnicianId
      if (orConditions.length > 1) {
        where.OR = orConditions;
      } else {
        where.assignedTechnicianId = userId;
      }
    } else if (userRole === UserRole.TRIAGER || userRole === UserRole.ADMIN) {
      // Triagista e Admin veem todos os tickets (sem filtro restritivo)
    }

    // Aplicar filtros adicionais
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters?.assignedTechnicianId) {
      where.assignedTechnicianId = filters.assignedTechnicianId;
    }
    if (filters?.requesterId) {
      where.requesterId = filters.requesterId;
    }
    if (filters?.teamId) {
      where.teamId = filters.teamId;
    }
    if (filters?.tipo) {
      where.tipo = filters.tipo;
    }
    if (filters?.teamSolicitanteId) {
      where.teamSolicitanteId = filters.teamSolicitanteId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const includeConfig: any = {
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignedTechnician: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      category: true,
      team: true,
      teamSolicitante: true,
      attachments: {
        select: {
          id: true,
          fileName: true,
          filePath: true,
          fileSize: true,
          mimeType: true,
          uploadedAt: true,
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
    };

    // Incluir observers
    includeConfig.observers = {
      include: {
        observer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    };

    try {
      const tickets = await prisma.ticket.findMany({
        where,
        include: includeConfig,
        orderBy: { createdAt: 'desc' },
      });
      
      logger.debug('Tickets encontrados', { 
        count: tickets.length, 
        userId, 
        userRole,
        whereKeys: Object.keys(where),
        hasOR: !!where.OR 
      });
      
      return tickets;
    } catch (error: any) {
      logger.error('Erro ao buscar tickets', { error: error.message, stack: error.stack, where, userId, userRole });
      throw error;
    }
  },

  async getTicketById(id: string, userId: string, userRole: UserRole) {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTechnician: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: true,
        team: true,
        teamSolicitante: true,
        tags: {
          include: {
            tag: true,
          },
        },
        observers: {
          include: {
            observer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            addedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { changedAt: 'asc' },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            filePath: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { uploadedAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
    }

    // Verificar permissão
    // Verificar se é o requester
    if (ticket.requesterId === userId) {
      return ticket;
    }

    // Verificar se é o técnico atribuído
    if (ticket.assignedTechnicianId === userId) {
      return ticket;
    }

    // Verificar se é membro do time
    if (ticket.teamId) {
      const isMember = await isUserTeamMember(userId, ticket.teamId);
      if (isMember) {
        return ticket;
      }
    }

    // Verificar se é observador
    const isObserver = await prisma.ticketObserver.findUnique({
      where: {
        ticketId_observerId: {
          ticketId: id,
          observerId: userId,
        },
      },
    });
    if (isObserver) {
      return ticket;
    }

    // ADMIN e TRIAGER podem ver todos os tickets
    if (userRole === UserRole.ADMIN || userRole === UserRole.TRIAGER) {
      return ticket;
    }

    // Se não passou em nenhuma verificação, negar acesso
    throw new AppError('Acesso negado', 403, ErrorType.FORBIDDEN_ERROR);
  },

  async updateTicket(id: string, userId: string, userRole: UserRole, data: UpdateTicketDto) {
    logger.debug('Atualizando ticket', { ticketId: id, userId, userRole, updates: Object.keys(data) });

    const ticket = await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      logger.warn('Tentativa de atualizar ticket inexistente', { ticketId: id, userId });
      throw new AppError('Ticket não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
    }

    // Verificar permissão
    if (userRole === UserRole.REQUESTER && ticket.requesterId !== userId) {
      logger.warn('Tentativa de acesso negado ao ticket', {
        ticketId: id,
        userId,
        requesterId: ticket.requesterId,
      });
      throw new AppError('Acesso negado', 403, ErrorType.FORBIDDEN_ERROR);
    }

    // Verificar se o usuário é membro do time do ticket
    const isMemberOfTicketTeam = ticket.teamId ? await isUserTeamMember(userId, ticket.teamId) : false;
    const isLeadOfTicketTeam = ticket.teamId ? await isUserTeamLead(userId, ticket.teamId) : false;

    // Validar teamId se fornecido (mover ticket para outro time)
    if (data.teamId !== undefined && data.teamId !== ticket.teamId) {
      const oldTeamId = ticket.teamId;

      // ADMIN, TRIAGER ou membros do time atual podem mover tickets
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.TRIAGER && !isMemberOfTicketTeam) {
        logger.warn('Tentativa de mover ticket sem permissão', { ticketId: id, userId, userRole });
        throw new AppError('Apenas administradores, triagistas ou membros do time podem mover tickets', 403, ErrorType.FORBIDDEN_ERROR);
      }

      if (data.teamId !== null) {
        const team = await prisma.team.findUnique({ where: { id: data.teamId } });
        if (!team) {
          throw new AppError('Time não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
        }
        logger.info('Ticket movido para outro time', { ticketId: id, oldTeamId: ticket.teamId, newTeamId: data.teamId, userId });
      }

      // Criar notificação de mudança de time
      try {
        await notificationService.createTeamChangeNotification(
          id,
          data.teamId,
          oldTeamId,
          userId,
          ticket.requesterId
        );
      } catch (err) {
        logger.warn('Erro ao criar notificação de mudança de time', { error: err });
      }
    }

    const targetTeamId = data.teamId !== undefined ? data.teamId : ticket.teamId;
    const targetCategoryId =
      data.categoryId !== undefined ? data.categoryId : ticket.categoryId;
    const targetTipo = data.tipo !== undefined ? data.tipo : ticket.tipo;

    if (targetTeamId) {
      await validateTeamCategoryAndType(targetTeamId, targetCategoryId, targetTipo);
    }

    // Validar assignedTechnicianId (assumir ou atribuir ticket)
    if (data.assignedTechnicianId !== undefined && data.assignedTechnicianId !== ticket.assignedTechnicianId) {
      const oldAssignedTechnicianId = ticket.assignedTechnicianId;

      // ADMIN e TRIAGER podem atribuir para qualquer técnico
      if (userRole === UserRole.ADMIN || userRole === UserRole.TRIAGER) {
        // Validar se o técnico existe
        if (data.assignedTechnicianId) {
          const technician = await prisma.user.findUnique({ where: { id: data.assignedTechnicianId } });
          if (!technician) {
            throw new AppError('Técnico não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
          }
        }
      }
      // Líder do time pode atribuir para membros do time
      else if (isLeadOfTicketTeam && ticket.teamId) {
        if (data.assignedTechnicianId) {
          // Verificar se o técnico é membro do time
          const isMember = await isUserTeamMember(data.assignedTechnicianId, ticket.teamId);
          if (!isMember) {
            throw new AppError('Apenas membros do time podem ser atribuídos por um líder', 403, ErrorType.FORBIDDEN_ERROR);
          }
        }
      }
      // Membros do time podem assumir o ticket (atribuir para si mesmo)
      else if (isMemberOfTicketTeam) {
        if (data.assignedTechnicianId !== userId) {
          throw new AppError('Membros do time podem apenas assumir tickets para si mesmos', 403, ErrorType.FORBIDDEN_ERROR);
        }
        logger.info('Ticket assumido por membro do time', { ticketId: id, userId });
      }
      else {
        throw new AppError('Você não tem permissão para atribuir este ticket', 403, ErrorType.FORBIDDEN_ERROR);
      }

      // Criar notificação de atribuição
      try {
        await notificationService.createAssignmentNotification(
          id,
          data.assignedTechnicianId,
          oldAssignedTechnicianId,
          userId,
          ticket.requesterId
        );
      } catch (err) {
        logger.warn('Erro ao criar notificação de atribuição', { error: err });
      }
      // Nota: A entrada no diário será criada após a atualização do ticket, no bloco de changes
    }

    // Apenas ADMIN e TRIAGER podem alterar priority
    if (data.priority !== undefined && userRole !== UserRole.ADMIN && userRole !== UserRole.TRIAGER) {
      throw new AppError('Apenas administradores ou triagistas podem alterar a prioridade', 403, ErrorType.FORBIDDEN_ERROR);
    }

    // Validar transição de status
    if (data.status && data.status !== ticket.status) {
      // Validação de negócio: impedir fechamento/resolução se houver filhos não resolvidos
      if (data.status === TicketStatus.RESOLVED || data.status === TicketStatus.CLOSED) {
        const childTickets = await prisma.ticketRelation.findMany({
          where: {
            ticketId: id,
            relationType: 'PARENT_OF',
          },
          include: {
            relatedTicket: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        });

        const unresolvedChildren = childTickets.filter(
          (rel) => rel.relatedTicket.status !== TicketStatus.RESOLVED && rel.relatedTicket.status !== TicketStatus.CLOSED
        );

        if (unresolvedChildren.length > 0) {
          logger.warn('Tentativa de fechar ticket com filhos não resolvidos', {
            ticketId: id,
            unresolvedChildrenCount: unresolvedChildren.length,
            unresolvedChildrenIds: unresolvedChildren.map((c) => c.relatedTicket.id),
          });
          throw new AppError(
            `Não é possível fechar este ticket. Existem ${unresolvedChildren.length} tarefa(s) filha(s) ainda não resolvida(s).`,
            400,
            ErrorType.VALIDATION_ERROR
          );
        }
      }

      logger.info('Mudança de status do ticket', {
        ticketId: id,
        oldStatus: ticket.status,
        newStatus: data.status,
        changedBy: userId,
      });

      // Registrar histórico de status
      await prisma.ticketStatusHistory.create({
        data: {
          ticketId: id,
          oldStatus: ticket.status,
          newStatus: data.status,
          changedById: userId,
        },
      });

      // Criar notificação de mudança de status
      try {
        await notificationService.createStatusChangeNotification(
          id,
          ticket.status,
          data.status,
          userId,
          ticket.requesterId,
          ticket.assignedTechnicianId
        );
      } catch (err) {
        logger.warn('Erro ao criar notificação de mudança de status', { error: err });
      }

      // Criar entrada automática no diário do técnico responsável
      // Usar o ticket ANTES da atualização para ter o assignedTechnicianId correto
      const assignedTechnicianId = data.assignedTechnicianId || ticket.assignedTechnicianId;
      
      if (assignedTechnicianId) {
        try {
          logger.debug('Criando entrada no diário para mudança de status', {
            ticketId: id,
            assignedTechnicianId,
            userId,
            userRole,
            oldStatus: ticket.status,
            newStatus: data.status,
            ticketAssignedTechnicianId: ticket.assignedTechnicianId,
          });
          
          const { technicianJournalService } = await import('./technicianJournal.service');
          const entry = await technicianJournalService.createAutoEntryForStatusChange(
            ticket,
            assignedTechnicianId,
            ticket.status,
            data.status
          );
          
          if (entry) {
            logger.info('Entrada no diário criada com sucesso para mudança de status', {
              ticketId: id,
              assignedTechnicianId,
              entryId: entry.id,
            });
          } else {
            logger.warn('Entrada no diário não foi criada (retornou null)', {
              ticketId: id,
              assignedTechnicianId,
              userId,
            });
          }
        } catch (err) {
          // Não quebrar o fluxo principal se houver erro no diário
          logger.error('Erro ao criar entrada automática no diário para mudança de status', {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            ticketId: id,
            assignedTechnicianId,
            userId,
          });
        }
      } else {
        logger.debug('Ticket não tem técnico atribuído, não criando entrada no diário', {
          ticketId: id,
          userId,
        });
      }

      // Atualizar datas de resolução/fechamento e calcular tempos
      const updateData: any = { ...data };
      let businessSchedule: BusinessSchedule | null = null;
      const ensureBusinessSchedule = async () => {
        if (!businessSchedule) {
          businessSchedule = await getDefaultBusinessSchedule();
        }
        return businessSchedule;
      };
      
      // Processar campos de gestão de projetos
      if (data.dueDate !== undefined) {
        updateData.dueDate = data.dueDate === null ? null : new Date(data.dueDate);
      }
      if (data.estimatedMinutes !== undefined) {
        updateData.estimatedMinutes = data.estimatedMinutes;
      }
      if (data.customFields !== undefined) {
        updateData.customFields = data.customFields === null ? undefined : data.customFields;
      }
      
      if (data.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
        const resolvedAt = new Date();
        updateData.resolvedAt = resolvedAt;
        
        // Calcular resolutionBusinessMinutes
        if (ticket.createdAt) {
          const schedule = await ensureBusinessSchedule();
          updateData.resolutionBusinessMinutes = businessMinutesBetween(
            ticket.createdAt,
            resolvedAt,
            schedule
          );
        }
        
        logger.info('Ticket resolvido', { ticketId: id });
      }
      
      if (data.status === TicketStatus.CLOSED && !ticket.closedAt) {
        const closedAt = new Date();
        updateData.closedAt = closedAt;
        
        // Calcular closureBusinessMinutes
        if (ticket.createdAt) {
          const schedule = await ensureBusinessSchedule();
          updateData.closureBusinessMinutes = businessMinutesBetween(
            ticket.createdAt,
            closedAt,
            schedule
          );
        }
        
        logger.info('Ticket fechado', { ticketId: id });
      }

      // Atualizar tags se fornecidas
      if (data.tagIds !== undefined) {
        // Remover todas as tags existentes
        await prisma.ticketTag.deleteMany({
          where: { ticketId: id },
        });

        // Adicionar novas tags
        if (data.tagIds.length > 0) {
          await prisma.ticketTag.createMany({
            data: data.tagIds.map((tagId) => ({
              ticketId: id,
              tagId,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Atualizar o ticket ANTES de criar entrada no diário para ter dados atualizados
      const updated = await prisma.ticket.update({
        where: { id },
        data: updateData,
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignedTechnician: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          category: true,
          team: true,
          teamSolicitante: true,
          tags: {
            include: {
              tag: true,
            },
          },
          observers: {
            include: {
              observer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Registrar eventos de atualização
      const changes: any = {};
      if (data.status && data.status !== ticket.status) {
        changes.status = { old: ticket.status, new: data.status };
      }
      if (data.priority && data.priority !== ticket.priority) {
        changes.priority = { old: ticket.priority, new: data.priority };
      }
      if (data.assignedTechnicianId !== undefined && data.assignedTechnicianId !== ticket.assignedTechnicianId) {
        changes.assignedTechnicianId = { old: ticket.assignedTechnicianId, new: data.assignedTechnicianId };
      }
      if (data.teamId !== undefined && data.teamId !== ticket.teamId) {
        changes.teamId = { old: ticket.teamId, new: data.teamId };
      }

      if (Object.keys(changes).length > 0) {
        await ticketIntegrations.recordTicketUpdated(id, userId, ticket, updated, changes);
      }

      // Criar entrada automática no diário para mudança de prioridade
      if (changes.priority && updated.assignedTechnicianId) {
        try {
          const { technicianJournalService } = await import('./technicianJournal.service');
          await (technicianJournalService as any).createAutoEntryForPriorityChange(
            updated,
            updated.assignedTechnicianId || '',
            changes.priority.old,
            changes.priority.new
          );
        } catch (err) {
          logger.warn('Erro ao criar entrada automática no diário para mudança de prioridade', {
            error: err instanceof Error ? err.message : String(err),
            ticketId: id,
          });
        }
      }

      // Criar entrada automática no diário para atribuição (quando muda status)
      if (changes.assignedTechnicianId && changes.assignedTechnicianId.new) {
        try {
          const { technicianJournalService } = await import('./technicianJournal.service');
          await (technicianJournalService as any).createAutoEntryForAssignment(
            updated,
            changes.assignedTechnicianId.new || '',
            userId,
            changes.assignedTechnicianId.old !== null
          );
        } catch (err) {
          logger.warn('Erro ao criar entrada automática no diário para atribuição', {
            error: err instanceof Error ? err.message : String(err),
            ticketId: id,
          });
        }
      }

      if (updated.assignedTechnicianId) {
        if (data.teamId !== undefined && data.teamId !== ticket.teamId) {
          logger.info('Time do ticket alterado', {
            ticketId: id,
            oldTeamId: ticket.teamId,
            newTeamId: updated.teamId,
            userId,
          });
          try {
            const { technicianJournalService } = await import('./technicianJournal.service');
            await (technicianJournalService as any).createAutoEntryForMetadataChange(
              updated,
              updated.assignedTechnicianId,
              `Time do ticket #${updated.id.substring(0, 8)} alterado de ${ticket.teamId || 'Sem time'} para ${updated.teamId || 'Sem time'}.`,
              'team_change'
            );
          } catch (err) {
            logger.warn('Erro ao criar entrada automática para mudança de time', {
              error: err instanceof Error ? err.message : String(err),
              ticketId: id,
            });
          }
        }

        if (data.categoryId !== undefined && data.categoryId !== ticket.categoryId) {
          logger.info('Categoria do ticket alterada', {
            ticketId: id,
            oldCategoryId: ticket.categoryId,
            newCategoryId: updated.categoryId,
            userId,
          });
          try {
            const { technicianJournalService } = await import('./technicianJournal.service');
            await (technicianJournalService as any).createAutoEntryForMetadataChange(
              updated,
              updated.assignedTechnicianId,
              `Categoria do ticket #${updated.id.substring(0, 8)} alterada de ${ticket.categoryId || 'Sem categoria'} para ${updated.categoryId || 'Sem categoria'}.`,
              'category_change'
            );
          } catch (err) {
            logger.warn('Erro ao criar entrada automática para mudança de categoria', {
              error: err instanceof Error ? err.message : String(err),
              ticketId: id,
            });
          }
        }

        if (data.tipo !== undefined && data.tipo !== ticket.tipo) {
          logger.info('Tipo do ticket alterado', {
            ticketId: id,
            oldTipo: ticket.tipo,
            newTipo: updated.tipo,
            userId,
          });
          try {
            const { technicianJournalService } = await import('./technicianJournal.service');
            await (technicianJournalService as any).createAutoEntryForMetadataChange(
              updated,
              updated.assignedTechnicianId,
              `Tipo do ticket #${updated.id.substring(0, 8)} alterado de ${ticket.tipo || 'Sem tipo'} para ${updated.tipo || 'Sem tipo'}.`,
              'ticket_type_change'
            );
          } catch (err) {
            logger.warn('Erro ao criar entrada automática para mudança de tipo', {
              error: err instanceof Error ? err.message : String(err),
              ticketId: id,
            });
          }
        }
      }

      return updated;
    }

    // Se não mudou status, apenas atualizar outros campos
    const updateData: any = { ...data };
    delete updateData.tagIds;
    
    // Processar campos de gestão de projetos
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate === null ? null : new Date(data.dueDate);
    }
    if (data.estimatedMinutes !== undefined) {
      updateData.estimatedMinutes = data.estimatedMinutes;
    }
    if (data.customFields !== undefined) {
      updateData.customFields = data.customFields === null ? undefined : data.customFields;
    }

    // Atualizar tags se fornecidas
    if (data.tagIds !== undefined) {
      // Remover todas as tags existentes
      await prisma.ticketTag.deleteMany({
        where: { ticketId: id },
      });

      // Adicionar novas tags
      if (data.tagIds.length > 0) {
        await prisma.ticketTag.createMany({
          data: data.tagIds.map((tagId) => ({
            ticketId: id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTechnician: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: true,
        team: true,
        teamSolicitante: true,
        tags: {
          include: {
            tag: true,
          },
        },
        observers: {
          include: {
            observer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Registrar eventos de atualização
    const changes: any = {};
    if (data.priority && data.priority !== ticket.priority) {
      changes.priority = { old: ticket.priority, new: data.priority };
    }
    if (data.assignedTechnicianId !== undefined && data.assignedTechnicianId !== ticket.assignedTechnicianId) {
      changes.assignedTechnicianId = { old: ticket.assignedTechnicianId, new: data.assignedTechnicianId };
    }
    if (data.teamId !== undefined && data.teamId !== ticket.teamId) {
      changes.teamId = { old: ticket.teamId, new: data.teamId };
    }

    if (Object.keys(changes).length > 0) {
      await ticketIntegrations.recordTicketUpdated(id, userId, ticket, updated, changes);
    }

    // Criar entrada automática no diário para mudança de prioridade
    if (changes.priority && updated.assignedTechnicianId) {
      try {
        const { technicianJournalService } = await import('./technicianJournal.service');
        await (technicianJournalService as any).createAutoEntryForPriorityChange(
          updated,
          updated.assignedTechnicianId || '',
          changes.priority.old,
          changes.priority.new
        );
      } catch (err) {
        logger.warn('Erro ao criar entrada automática no diário para mudança de prioridade', {
          error: err instanceof Error ? err.message : String(err),
          ticketId: id,
        });
      }
    }

    // Criar entrada automática no diário para atribuição
    if (changes.assignedTechnicianId && changes.assignedTechnicianId.new) {
      try {
        const { technicianJournalService } = await import('./technicianJournal.service');
        await (technicianJournalService as any).createAutoEntryForAssignment(
          updated,
          changes.assignedTechnicianId.new || '',
          userId,
          changes.assignedTechnicianId.old !== null
        );
      } catch (err) {
        logger.warn('Erro ao criar entrada automática no diário para atribuição', {
          error: err instanceof Error ? err.message : String(err),
          ticketId: id,
        });
      }
    }

    return updated;
  },

  async addComment(ticketId: string, userId: string, data: CreateCommentDto, attachments?: Array<{
    fileName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
  }>) {
    logger.debug('Adicionando comentário ao ticket', {
      ticketId,
      userId,
      type: data.type,
      contentLength: data.content.length,
      attachmentsCount: attachments?.length || 0,
    });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      logger.warn('Tentativa de comentar ticket inexistente', { ticketId, userId });
      throw new AppError('Ticket não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
    }

    // Buscar time do autor para registrar na interação
    const authorTeams = await getUserTeams(userId);
    const authorTeamId = authorTeams.length > 0 ? authorTeams[0] : null;

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        authorId: userId,
        content: data.content,
        type: data.type,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Registrar evento de comentário adicionado
    await ticketIntegrations.recordCommentAdded(ticketId, userId, comment.id);

    // Tentar criar entrada no diário do técnico, sem quebrar o fluxo principal
    try {
      // Verificar se o autor é um técnico (não solicitante)
      const author = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      // Registrar no diário se o autor for técnico/triagista/admin (tanto PUBLIC quanto INTERNAL)
      if (
        author &&
        (author.role === UserRole.TECHNICIAN ||
          author.role === UserRole.TRIAGER ||
          author.role === UserRole.ADMIN)
      ) {
        const { technicianJournalService } = await import('./technicianJournal.service');
        await technicianJournalService.createAutoEntryForComment(comment, ticket, userId);
        logger.debug('Entrada no diário criada para comentário', {
          commentId: comment.id,
          ticketId,
          userId,
          authorRole: author.role,
          commentType: comment.type,
        });
      } else {
        logger.debug('Comentário não registrado no diário - autor não é técnico/triagista/admin', {
          commentId: comment.id,
          ticketId,
          userId,
          authorRole: author?.role,
        });
      }
    } catch (journalError) {
      logger.warn('Erro ao criar entrada automática no diário para comentário', {
        commentId: comment.id,
        ticketId,
        userId,
        error:
          journalError instanceof Error ? journalError.message : String(journalError),
      });
    }

    // Registrar interação se for resposta pública de agente (não solicitante)
    if (data.type === 'PUBLIC') {
      const author = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      // Se não for solicitante, registrar como PUBLIC_REPLY
      if (author && author.role !== UserRole.REQUESTER) {
        await prisma.ticketInteraction.create({
          data: {
            ticketId,
            authorId: userId,
            authorTeamId: authorTeamId,
            type: InteractionType.PUBLIC_REPLY,
          },
        });

        // Se for a primeira resposta pública, atualizar firstResponseAt e calcular tempo
        if (!ticket.firstResponseAt) {
          const firstResponseAt = new Date();
          const schedule = await getDefaultBusinessSchedule();
          const firstResponseBusinessMinutes = businessMinutesBetween(
            ticket.createdAt,
            firstResponseAt,
            schedule
          );

          await prisma.ticket.update({
            where: { id: ticketId },
            data: {
              firstResponseAt,
              firstResponseBusinessMinutes,
            },
          });
        }
      }
    }

    // Criar anexos se houver
    if (attachments && attachments.length > 0) {
      await Promise.all(
        attachments.map((att) =>
          prisma.ticketAttachment.create({
            data: {
              ticketId,
              commentId: comment.id,
              fileName: att.fileName,
              filePath: att.filePath,
              fileSize: att.fileSize,
              mimeType: att.mimeType,
              uploadedById: userId,
            },
          })
        )
      );

      // Recarregar comentário com anexos
      const commentWithAttachments = await prisma.ticketComment.findUnique({
        where: { id: comment.id },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          attachments: {
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      logger.info('Comentário adicionado ao ticket', {
        commentId: comment.id,
        ticketId,
        authorId: userId,
        type: data.type,
        attachmentsCount: attachments.length,
      });

      // Buscar informações do autor para criar notificação
      const author = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      // Criar notificação se o comentário for público (para qualquer tipo de usuário)
      if (data.type === 'PUBLIC' && author) {
        try {
          await notificationService.createCommentNotification(
            ticketId,
            userId,
            author.role,
            ticket.requesterId
          );
        } catch (err) {
          logger.warn('Erro ao criar notificação de comentário', { error: err });
          // Não falhar a operação se a notificação falhar
        }
      }

      return commentWithAttachments!;
    }

    logger.info('Comentário adicionado ao ticket', {
      commentId: comment.id,
      ticketId,
      authorId: userId,
      type: data.type,
    });

    // Buscar informações do autor para criar notificação
    const author = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    // Criar notificação se o comentário for público (para qualquer tipo de usuário)
    if (data.type === 'PUBLIC' && author) {
      try {
        await notificationService.createCommentNotification(
          ticketId,
          userId,
          author.role,
          ticket.requesterId
        );
      } catch (err) {
        logger.warn('Erro ao criar notificação de comentário', { error: err });
        // Não falhar a operação se a notificação falhar
      }
    }

    return comment;
  },

  async getComments(ticketId: string, userId: string, userRole: UserRole) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
    }

    // Verificar permissão
    if (userRole === UserRole.REQUESTER && ticket.requesterId !== userId) {
      throw new AppError('Acesso negado', 403, ErrorType.FORBIDDEN_ERROR);
    }

    const comments = await prisma.ticketComment.findMany({
      where: { ticketId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { uploadedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Filtrar comentários internos para solicitantes
    if (userRole === UserRole.REQUESTER) {
      return comments.filter((comment) => comment.type === 'PUBLIC');
    }

    return comments;
  },

  async addObserver(ticketId: string, observerId: string, addedById: string) {
    logger.debug('Adicionando observador ao ticket', { ticketId, observerId, addedById });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
    }

    const observer = await prisma.user.findUnique({ where: { id: observerId } });
    if (!observer) {
      throw new AppError('Usuário não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
    }

    // Verificar se já é observador
    const existing = await prisma.ticketObserver.findUnique({
      where: {
        ticketId_observerId: {
          ticketId,
          observerId,
        },
      },
    });

    if (existing) {
      throw new AppError('Usuário já é observador deste ticket', 400, ErrorType.VALIDATION_ERROR);
    }

    // Verificar se não é o próprio requester ou técnico atribuído (não precisa ser observador)
    if (ticket.requesterId === observerId || ticket.assignedTechnicianId === observerId) {
      throw new AppError('O solicitante e o técnico atribuído não precisam ser observadores', 400, ErrorType.VALIDATION_ERROR);
    }

    const ticketObserver = await prisma.ticketObserver.create({
      data: {
        ticketId,
        observerId,
        addedById,
      },
      include: {
        observer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        addedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info('Observador adicionado ao ticket', { ticketId, observerId, addedById });
    return ticketObserver;
  },

  async removeObserver(ticketId: string, observerId: string, userId: string) {
    logger.debug('Removendo observador do ticket', { ticketId, observerId, userId });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404, ErrorType.NOT_FOUND_ERROR);
    }

    // Verificar se o observador existe
    const ticketObserver = await prisma.ticketObserver.findUnique({
      where: {
        ticketId_observerId: {
          ticketId,
          observerId,
        },
      },
    });

    if (!ticketObserver) {
      throw new AppError('Observador não encontrado neste ticket', 404, ErrorType.NOT_FOUND_ERROR);
    }

    // Verificar permissão: requester, técnico atribuído, admin ou o próprio observador podem remover
    const isRequester = ticket.requesterId === userId;
    const isAssignedTechnician = ticket.assignedTechnicianId === userId;
    const isObserver = observerId === userId;
    
    // Verificar se é admin
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.role === UserRole.ADMIN;

    if (!isRequester && !isAssignedTechnician && !isObserver && !isAdmin) {
      throw new AppError('Você não tem permissão para remover observadores deste ticket', 403, ErrorType.FORBIDDEN_ERROR);
    }

    await prisma.ticketObserver.delete({
      where: {
        ticketId_observerId: {
          ticketId,
          observerId,
        },
      },
    });

    logger.info('Observador removido do ticket', { ticketId, observerId, userId });
  },

  async getObservers(ticketId: string) {
    const observers = await prisma.ticketObserver.findMany({
      where: { ticketId },
      include: {
        observer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        addedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return observers;
  },
};

