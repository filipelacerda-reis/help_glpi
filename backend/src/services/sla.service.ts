import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { TicketStatus, SlaInstanceStatus, TicketEventType, EventOrigin } from '@prisma/client';
import { businessCalendarService } from './businessCalendar.service';
import { ticketEventService } from './ticketEvent.service';
import { businessMinutesBetween, BusinessSchedule } from '../domain/time/businessTime.engine';

export interface CreateSlaPolicyDto {
  name: string;
  description?: string;
  appliesTo: {
    teamId?: string;
    categoryId?: string;
    priority?: string;
    ticketType?: string;
    requesterTeamId?: string;
  };
  targetFirstResponseBusinessMinutes?: number;
  targetResolutionBusinessMinutes: number;
  calendarId: string;
  active?: boolean;
}

export interface UpdateSlaPolicyDto {
  name?: string;
  description?: string;
  appliesTo?: CreateSlaPolicyDto['appliesTo'];
  targetFirstResponseBusinessMinutes?: number;
  targetResolutionBusinessMinutes?: number;
  calendarId?: string;
  active?: boolean;
}

const COUNTED_STATUSES = new Set<TicketStatus>([
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
]);

async function calculateElapsedBusinessMinutes(
  ticket: { id: string; createdAt: Date },
  endAt: Date,
  schedule: BusinessSchedule
) {
  if (!ticket.createdAt || endAt <= ticket.createdAt) {
    return 0;
  }

  const history = await prisma.ticketStatusHistory.findMany({
    where: {
      ticketId: ticket.id,
      changedAt: { lte: endAt },
    },
    orderBy: { changedAt: 'asc' },
  });

  const events: Array<{ status: TicketStatus; at: Date }> = [];
  if (history.length > 0) {
    const first = history[0];
    const initialStatus = first.oldStatus ?? first.newStatus ?? TicketStatus.OPEN;
    events.push({ status: initialStatus, at: ticket.createdAt });
    history.forEach((entry) => {
      if (entry.changedAt > ticket.createdAt) {
        events.push({ status: entry.newStatus, at: entry.changedAt });
      }
    });
  } else {
    events.push({ status: TicketStatus.OPEN, at: ticket.createdAt });
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  let totalMinutes = 0;
  for (let i = 0; i < events.length; i += 1) {
    const start = events[i].at;
    const end = i + 1 < events.length ? events[i + 1].at : endAt;
    if (end <= start) {
      continue;
    }
    if (COUNTED_STATUSES.has(events[i].status)) {
      totalMinutes += businessMinutesBetween(start, end, schedule);
    }
  }

  return totalMinutes;
}

export const slaService = {
  /**
   * Cria uma política de SLA
   */
  async createPolicy(data: CreateSlaPolicyDto) {
    // Verificar se o calendário existe
    await businessCalendarService.getCalendarById(data.calendarId);

    const policy = await prisma.slaPolicy.create({
      data: {
        name: data.name,
        description: data.description,
        appliesTo: data.appliesTo as any,
        targetFirstResponseBusinessMinutes: data.targetFirstResponseBusinessMinutes,
        targetResolutionBusinessMinutes: data.targetResolutionBusinessMinutes,
        calendarId: data.calendarId,
        active: data.active !== undefined ? data.active : true,
      },
    });

    logger.info('Política de SLA criada', { policyId: policy.id, name: policy.name });
    return policy;
  },

  /**
   * Busca todas as políticas
   */
  async getAllPolicies(activeOnly?: boolean) {
    const where: any = {};
    if (activeOnly) {
      where.active = true;
    }

    return prisma.slaPolicy.findMany({
      where,
      include: {
        calendar: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  },

  /**
   * Busca política por ID
   */
  async getPolicyById(id: string) {
    const policy = await prisma.slaPolicy.findUnique({
      where: { id },
      include: {
        calendar: true,
      },
    });

    if (!policy) {
      throw new AppError('Política de SLA não encontrada', 404);
    }

    return policy;
  },

  /**
   * Atualiza política
   */
  async updatePolicy(id: string, data: UpdateSlaPolicyDto) {
    const policy = await prisma.slaPolicy.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new AppError('Política de SLA não encontrada', 404);
    }

    if (data.calendarId) {
      await businessCalendarService.getCalendarById(data.calendarId);
    }

    const updated = await prisma.slaPolicy.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        appliesTo: data.appliesTo as any,
        targetFirstResponseBusinessMinutes: data.targetFirstResponseBusinessMinutes,
        targetResolutionBusinessMinutes: data.targetResolutionBusinessMinutes,
        calendarId: data.calendarId,
        active: data.active,
      },
    });

    logger.info('Política de SLA atualizada', { policyId: id });
    return updated;
  },

  /**
   * Remove uma política de SLA
   */
  async deletePolicy(id: string) {
    const policy = await prisma.slaPolicy.findUnique({
      where: { id },
      include: {
        _count: {
          select: { instances: true, stats: true }
        }
      }
    });

    if (!policy) {
      throw new AppError('Política de SLA não encontrada', 404);
    }

    if (policy._count.instances > 0 || policy._count.stats > 0) {
      throw new AppError('Não é possível excluir esta política pois ela está vinculada a tickets existentes. Tente inativá-la.', 400);
    }

    await prisma.slaPolicy.delete({
      where: { id },
    });

    logger.info('Política de SLA excluída', { policyId: id });
  },

  /**
   * Seleciona a política de SLA mais adequada para um ticket
   */
  async selectPolicyForTicket(ticket: {
    teamId?: string | null;
    categoryId?: string | null;
    priority: string;
    tipo: string;
    teamSolicitanteId?: string | null;
  }) {
    const policies = await prisma.slaPolicy.findMany({
      where: { active: true },
      include: {
        calendar: true,
      },
    });

    // Ordenar por especificidade (mais específica primeiro)
    const scored = policies.map((policy) => {
      const appliesTo = policy.appliesTo as any;
      let score = 0;

      if (appliesTo.teamId && appliesTo.teamId === ticket.teamId) score += 10;
      if (appliesTo.categoryId && appliesTo.categoryId === ticket.categoryId) score += 8;
      if (appliesTo.priority && appliesTo.priority === ticket.priority) score += 6;
      if (appliesTo.ticketType && appliesTo.ticketType === ticket.tipo) score += 4;
      if (appliesTo.requesterTeamId && appliesTo.requesterTeamId === ticket.teamSolicitanteId) score += 2;

      return { policy, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Retornar a política com maior score, ou a primeira se nenhuma tiver score > 0
    if (scored[0] && scored[0].score > 0) {
      return scored[0].policy;
    }

    // Se nenhuma política específica, retornar a primeira ativa (ou criar uma padrão)
    return scored[0]?.policy || null;
  },

  /**
   * Inicia SLA para um ticket
   */
  async startSlaForTicket(ticketId: string, actorUserId?: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404);
    }

    // Verificar se já existe SLA ativo
    const existing = await prisma.ticketSlaInstance.findFirst({
      where: {
        ticketId,
        status: {
          in: [SlaInstanceStatus.RUNNING, SlaInstanceStatus.PAUSED],
        },
      },
    });

    if (existing) {
      logger.warn('SLA já existe para o ticket', { ticketId });
      return existing;
    }

    // Selecionar política
    const policy = await this.selectPolicyForTicket({
      teamId: ticket.teamId,
      categoryId: ticket.categoryId,
      priority: ticket.priority,
      tipo: ticket.tipo,
      teamSolicitanteId: ticket.teamSolicitanteId,
    });

    if (!policy) {
      logger.warn('Nenhuma política de SLA encontrada para o ticket', { ticketId });
      return null;
    }

    // Criar instância
    const instance = await prisma.ticketSlaInstance.create({
      data: {
        ticketId,
        slaPolicyId: policy.id,
        startedAt: new Date(),
        status: SlaInstanceStatus.RUNNING,
      },
    });

    // Criar stats
    await prisma.ticketSlaStats.upsert({
      where: { ticketId },
      create: {
        ticketId,
        slaPolicyId: policy.id,
        breached: false,
      },
      update: {},
    });

    // Registrar evento
    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.SLA_STARTED,
      actorUserId,
      origin: EventOrigin.SYSTEM,
      newValue: {
        slaPolicyId: policy.id,
        slaPolicyName: policy.name,
      },
    });

    logger.info('SLA iniciado para ticket', { ticketId, policyId: policy.id });
    return instance;
  },

  /**
   * Calcula e atualiza estatísticas de SLA quando há primeira resposta
   */
  async recordFirstResponse(ticketId: string, firstResponseAt: Date) {
    const stats = await prisma.ticketSlaStats.findUnique({
      where: { ticketId },
      include: {
        slaPolicy: {
          include: {
            calendar: true,
          },
        },
      },
    });

    if (!stats) {
      return;
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return;
    }

    const schedule = await businessCalendarService.getBusinessSchedule(
      stats.slaPolicy?.calendarId || null
    );
    const businessMinutes = businessMinutesBetween(ticket.createdAt, firstResponseAt, schedule);
    const businessMs = businessMinutes * 60 * 1000;

    // Atualizar stats
    await prisma.ticketSlaStats.update({
      where: { ticketId },
      data: {
        firstResponseAt,
        businessFirstResponseTimeMs: businessMs,
      },
    });

    // Verificar se violou SLA
    if (stats.slaPolicy.targetFirstResponseBusinessMinutes) {
      const targetMs = stats.slaPolicy.targetFirstResponseBusinessMinutes * 60 * 1000;
      if (businessMs > targetMs) {
        await this.breachSla(ticketId, 'FIRST_RESPONSE_EXCEEDED');
      }
    }

    logger.debug('Primeira resposta registrada no SLA', { ticketId, businessMinutes });
  },

  /**
   * Calcula e atualiza estatísticas de SLA quando ticket é resolvido
   */
  async recordResolution(ticketId: string, resolvedAt: Date) {
    const stats = await prisma.ticketSlaStats.findUnique({
      where: { ticketId },
      include: {
        slaPolicy: {
          include: {
            calendar: true,
          },
        },
      },
    });

    if (!stats) {
      return;
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return;
    }

    const schedule = await businessCalendarService.getBusinessSchedule(
      stats.slaPolicy?.calendarId || null
    );
    const businessMinutes = await calculateElapsedBusinessMinutes(ticket, resolvedAt, schedule);
    const businessMs = businessMinutes * 60 * 1000;

    // Verificar se violou SLA
    const targetMs = stats.slaPolicy.targetResolutionBusinessMinutes * 60 * 1000;
    const breached = businessMs > targetMs;

    // Atualizar instância
    const instance = await prisma.ticketSlaInstance.findFirst({
      where: {
        ticketId,
        status: {
          in: [SlaInstanceStatus.RUNNING, SlaInstanceStatus.PAUSED],
        },
      },
    });

    if (instance) {
      await prisma.ticketSlaInstance.update({
        where: { id: instance.id },
        data: {
          resolvedAt,
          status: breached ? SlaInstanceStatus.BREACHED : SlaInstanceStatus.MET,
        },
      });

      // Registrar evento
      await ticketEventService.createEvent({
        ticketId,
        eventType: breached ? TicketEventType.SLA_BREACHED : TicketEventType.SLA_MET,
        origin: EventOrigin.SYSTEM,
        newValue: {
          slaPolicyId: stats.slaPolicyId,
          businessResolutionTimeMs: businessMs,
          targetResolutionTimeMs: targetMs,
          breached,
        },
      });
    }

    // Atualizar stats
    await prisma.ticketSlaStats.update({
      where: { ticketId },
      data: {
        resolvedAt,
        businessResolutionTimeMs: businessMs,
        breached,
        breachReason: breached ? 'RESOLUTION_EXCEEDED' : null,
      },
    });

    logger.info('Resolução registrada no SLA', { ticketId, businessMinutes, breached });
  },

  /**
   * Marca SLA como violado
   */
  async breachSla(ticketId: string, reason: string) {
    const instance = await prisma.ticketSlaInstance.findFirst({
      where: {
        ticketId,
        status: {
          in: [SlaInstanceStatus.RUNNING, SlaInstanceStatus.PAUSED],
        },
      },
    });

    if (!instance) {
      return;
    }

    await prisma.ticketSlaInstance.update({
      where: { id: instance.id },
      data: {
        status: SlaInstanceStatus.BREACHED,
        breachedAt: new Date(),
      },
    });

    await prisma.ticketSlaStats.update({
      where: { ticketId },
      data: {
        breached: true,
        breachReason: reason,
      },
    });

    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.SLA_BREACHED,
      origin: EventOrigin.SYSTEM,
      newValue: {
        slaPolicyId: instance.slaPolicyId,
        reason,
      },
    });

    logger.warn('SLA violado', { ticketId, reason });
  },
};
