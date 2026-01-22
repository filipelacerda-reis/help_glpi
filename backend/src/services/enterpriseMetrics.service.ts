import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { MetricsFilters, MetricsResponse } from '../types/metrics.types';
import { TicketStatus, TicketPriority } from '@prisma/client';
import { businessMinutesBetween } from '../domain/time/businessTime.engine';
import { diffInCalendarMinutes } from '../utils/businessHours';
import { businessCalendarService } from './businessCalendar.service';

/**
 * Serviço de métricas enterprise com cálculos avançados
 */
export const enterpriseMetricsService = {
  /**
   * Calcula métricas completas baseadas nos filtros fornecidos
   */
  async getMetrics(filters: MetricsFilters): Promise<MetricsResponse> {
    logger.debug('Calculando métricas enterprise', { filters });

    // Parsear datas
    const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
    const endDate = filters.endDate ? new Date(filters.endDate) : undefined;
    const useBusinessHours = filters.businessHours === true;

    // Construir where clause baseado nos filtros
    const where = this.buildWhereClause(filters, startDate, endDate);

    // Buscar schedule padrão se necessário
    let businessSchedule = null;
    if (useBusinessHours) {
      try {
        businessSchedule = await businessCalendarService.getBusinessSchedule(null);
      } catch (error) {
        logger.warn('Não foi possível carregar calendário de negócio, usando padrão', { error });
      }
    }

    // Calcular métricas em paralelo
    const [
      overview,
      byTeam,
      byTechnician,
      byCategoryAndTag,
      sla,
      backlog,
    ] = await Promise.all([
      this.calculateOverview(where, startDate, endDate, useBusinessHours, businessSchedule),
      this.calculateByTeam(where, startDate, endDate, useBusinessHours, businessSchedule),
      this.calculateByTechnician(where, startDate, endDate, useBusinessHours, businessSchedule),
      this.calculateByCategoryAndTag(where, startDate, endDate, useBusinessHours, businessSchedule),
      this.calculateSla(where, startDate, endDate),
      this.calculateBacklog(where, useBusinessHours, businessSchedule),
    ]);

    const response: MetricsResponse = {
      overview,
      byTeam,
      byTechnician,
      byCategoryAndTag,
      sla,
      backlog,
    };

    // Se comparePreviousPeriod estiver ativo, calcular período anterior
    if (filters.comparePreviousPeriod && startDate && endDate) {
      const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - periodDays);
      const prevEndDate = new Date(startDate);

      const prevWhere = this.buildWhereClause(
        { ...filters, startDate: prevStartDate.toISOString(), endDate: prevEndDate.toISOString() },
        prevStartDate,
        prevEndDate
      );

      const prevOverview = await this.calculateOverview(
        prevWhere,
        prevStartDate,
        prevEndDate,
        useBusinessHours,
        businessSchedule
      );

      response.comparison = {
        overview: {
          createdCount: prevOverview.createdCount,
          resolvedCount: prevOverview.resolvedCount,
          mtta: prevOverview.mtta,
          mttr: prevOverview.mttr,
          slaCompliancePercent: prevOverview.slaCompliancePercent,
        },
      };
    }

    logger.info('Métricas enterprise calculadas com sucesso');
    return response;
  },

  /**
   * Constrói a cláusula WHERE para Prisma baseada nos filtros
   */
  buildWhereClause(
    filters: MetricsFilters,
    startDate?: Date,
    endDate?: Date
  ): any {
    const where: any = {};

    // Filtro de data
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Filtros de entidade
    // Suportar teamId único ou teamIds (array) para líderes de múltiplos times
    if ((filters as any).teamIds && Array.isArray((filters as any).teamIds)) {
      where.teamId = { in: (filters as any).teamIds };
    } else if (filters.teamId) {
      where.teamId = filters.teamId;
    }
    if (filters.technicianId) where.assignedTechnicianId = filters.technicianId;
    if (filters.categoryId) where.categoryId = filters.categoryId;

    // Filtro de prioridade
    if (filters.priority) {
      const priorityMap: Record<string, TicketPriority> = {
        LOW: TicketPriority.LOW,
        MEDIUM: TicketPriority.MEDIUM,
        HIGH: TicketPriority.HIGH,
        CRITICAL: TicketPriority.CRITICAL,
        P1: TicketPriority.CRITICAL,
        P2: TicketPriority.HIGH,
        P3: TicketPriority.MEDIUM,
        P4: TicketPriority.LOW,
      };
      where.priority = priorityMap[filters.priority] || filters.priority;
    }

    // Filtro de status
    if (filters.status) {
      const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
      const statusMap: Record<string, TicketStatus> = {
        open: TicketStatus.OPEN,
        in_progress: TicketStatus.IN_PROGRESS,
        pending: TicketStatus.WAITING_REQUESTER,
        waiting_requester: TicketStatus.WAITING_REQUESTER,
        waiting_third_party: TicketStatus.WAITING_THIRD_PARTY,
        resolved: TicketStatus.RESOLVED,
        closed: TicketStatus.CLOSED,
      };
      const prismaStatuses = statusArray
        .map((s) => statusMap[s.toLowerCase()] || s)
        .filter((s): s is TicketStatus => Object.values(TicketStatus).includes(s as TicketStatus));
      if (prismaStatuses.length > 0) {
        where.status = { in: prismaStatuses };
      }
    }

    // Filtro de tags
    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        some: {
          tag: {
            OR: [
              { id: { in: filters.tags } },
              { name: { in: filters.tags } },
            ],
          },
        },
      };
    }

    return where;
  },

  /**
   * Calcula métricas de visão geral
   */
  async calculateOverview(
    where: any,
    startDate?: Date,
    endDate?: Date,
    useBusinessHours?: boolean,
    businessSchedule?: any
  ) {
    // Contagens básicas
    const [createdCount, resolvedCount, backlogCount] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.count({
        where: {
          ...where,
          status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        },
      }),
      prisma.ticket.count({
        where: {
          ...where,
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        },
      }),
    ]);

    // Tickets para cálculos de tempo
    const ticketsForTime = await prisma.ticket.findMany({
      where: {
        ...where,
        OR: [
          { firstResponseAt: { not: null } },
          { resolvedAt: { not: null } },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        firstResponseAt: true,
        resolvedAt: true,
        firstResponseBusinessMinutes: true,
        resolutionBusinessMinutes: true,
      },
    });

    // Calcular MTTA (Mean Time To Acknowledge)
    const mttaTickets = ticketsForTime.filter((t) => t.firstResponseAt);
    let mtta: number | null = null;
    if (mttaTickets.length > 0) {
      if (useBusinessHours && businessSchedule) {
        const minutes = mttaTickets
          .map((t) =>
            businessMinutesBetween(t.createdAt, t.firstResponseAt!, businessSchedule)
          )
          .filter((m) => m > 0);
        if (minutes.length > 0) {
          mtta = minutes.reduce((a, b) => a + b, 0) / minutes.length;
        }
      } else {
        const minutes = mttaTickets.map((t) =>
          diffInCalendarMinutes(t.createdAt, t.firstResponseAt!)
        );
        mtta = minutes.reduce((a, b) => a + b, 0) / minutes.length;
      }
    }

    // Calcular MTTR (Mean Time To Resolution)
    const mttrTickets = ticketsForTime.filter((t) => t.resolvedAt);
    let mttr: number | null = null;
    if (mttrTickets.length > 0) {
      if (useBusinessHours && businessSchedule) {
        const minutes = mttrTickets
          .map((t) =>
            businessMinutesBetween(t.createdAt, t.resolvedAt!, businessSchedule)
          )
          .filter((m) => m > 0);
        if (minutes.length > 0) {
          mttr = minutes.reduce((a, b) => a + b, 0) / minutes.length;
        }
      } else {
        const minutes = mttrTickets.map((t) =>
          diffInCalendarMinutes(t.createdAt, t.resolvedAt!)
        );
        mttr = minutes.reduce((a, b) => a + b, 0) / minutes.length;
      }
    }

    // Calcular SLA compliance
    const slaStats = await prisma.ticketSlaStats.findMany({
      where: {
        ticket: where,
      },
      select: {
        breached: true,
      },
    });
    const slaCompliancePercent =
      slaStats.length > 0
        ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
        : 0;

    // Calcular taxa de reabertura
    const resolvedTickets = await prisma.ticket.findMany({
      where: {
        ...where,
        resolvedAt: { not: null },
      },
      select: { id: true },
    });
    const reopenedTickets = await prisma.ticketStatusHistory.findMany({
      where: {
        ticket: where,
        oldStatus: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        newStatus: TicketStatus.OPEN,
      },
      select: { ticketId: true },
      distinct: ['ticketId'],
    });
    const reopenRatePercent =
      resolvedTickets.length > 0 ? (reopenedTickets.length / resolvedTickets.length) * 100 : 0;

    // Trend: tickets criados vs resolvidos por dia
    const trendCreatedVsResolved = await this.calculateTrend(where, startDate, endDate);

    // Distribuição por prioridade
    const priorityDistribution = await prisma.ticket.groupBy({
      by: ['priority'],
      where,
      _count: { _all: true },
    });

    // Tickets por time solicitante
    const ticketsByRequesterTeam = await prisma.ticket.groupBy({
      by: ['teamSolicitanteId'],
      where,
      _count: { _all: true },
    });

    const requesterTeamIds = ticketsByRequesterTeam
      .map((t) => t.teamSolicitanteId)
      .filter((id): id is string => id !== null);
    const requesterTeams = await prisma.team.findMany({
      where: { id: { in: requesterTeamIds } },
      select: { id: true, name: true },
    });
    const requesterTeamMap = new Map(requesterTeams.map((t) => [t.id, t.name]));

    return {
      createdCount,
      resolvedCount,
      backlogCount,
      mtta,
      mttr,
      slaCompliancePercent: Math.round(slaCompliancePercent * 100) / 100,
      reopenRatePercent: Math.round(reopenRatePercent * 100) / 100,
      trendCreatedVsResolved,
      priorityDistribution: priorityDistribution.map((p) => ({
        priority: p.priority,
        count: p._count._all,
      })),
      ticketsByRequesterTeam: ticketsByRequesterTeam.map((t) => ({
        teamId: t.teamSolicitanteId || '',
        teamName: t.teamSolicitanteId
          ? requesterTeamMap.get(t.teamSolicitanteId) || 'Time não encontrado'
          : 'Sem time',
        count: t._count._all,
      })),
    };
  },

  /**
   * Calcula tendência de tickets criados vs resolvidos por dia
   */
  async calculateTrend(where: any, startDate?: Date, endDate?: Date) {
    if (!startDate || !endDate) {
      // Se não há período, usar últimos 30 dias
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }

    const days: Array<{ date: string; created: number; resolved: number }> = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const [created, resolved] = await Promise.all([
        prisma.ticket.count({
          where: {
            ...where,
            createdAt: { gte: currentDate, lt: nextDate },
          },
        }),
        prisma.ticket.count({
          where: {
            ...where,
            resolvedAt: { gte: currentDate, lt: nextDate },
          },
        }),
      ]);

      days.push({
        date: currentDate.toISOString().split('T')[0],
        created,
        resolved,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  },

  /**
   * Calcula métricas por time
   */
  async calculateByTeam(
    where: any,
    startDate?: Date,
    endDate?: Date,
    useBusinessHours?: boolean,
    businessSchedule?: any
  ) {
    const teams = await prisma.team.findMany({
      include: {
        responsibleTickets: {
          where,
          include: {
            slaStats: true,
          },
        },
      },
    });

    const items = await Promise.all(
      teams.map(async (team) => {
        const tickets = team.responsibleTickets;
        const created = tickets.length;
        const resolved = tickets.filter(
          (t) => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED
        ).length;
        const backlog = created - resolved;

        // Calcular MTTA e MTTR
        const mttaTickets = tickets.filter((t) => t.firstResponseAt);
        const mttrTickets = tickets.filter((t) => t.resolvedAt);
        let mtta: number | null = null;
        let mttr: number | null = null;

        if (mttaTickets.length > 0) {
          if (useBusinessHours && businessSchedule) {
            const mttaMinutes = mttaTickets
              .map((t) =>
                businessMinutesBetween(t.createdAt, t.firstResponseAt!, businessSchedule)
              )
              .filter((m) => m > 0);
            if (mttaMinutes.length > 0) {
              mtta = mttaMinutes.reduce((a, b) => a + b, 0) / mttaMinutes.length;
            }
          } else {
            const mttaMinutes = mttaTickets.map((t) =>
              diffInCalendarMinutes(t.createdAt, t.firstResponseAt!)
            );
            if (mttaMinutes.length > 0) {
              mtta = mttaMinutes.reduce((a, b) => a + b, 0) / mttaMinutes.length;
            }
          }
        }

        if (mttrTickets.length > 0) {
          if (useBusinessHours && businessSchedule) {
            const mttrMinutes = mttrTickets
              .map((t) =>
                businessMinutesBetween(t.createdAt, t.resolvedAt!, businessSchedule)
              )
              .filter((m) => m > 0);
            if (mttrMinutes.length > 0) {
              mttr = mttrMinutes.reduce((a, b) => a + b, 0) / mttrMinutes.length;
            }
          } else {
            const mttrMinutes = mttrTickets.map((t) =>
              diffInCalendarMinutes(t.createdAt, t.resolvedAt!)
            );
            mttr = mttrMinutes.reduce((a, b) => a + b, 0) / mttrMinutes.length;
          }
        }

        // SLA compliance
        const slaStats = tickets.filter((t) => t.slaStats).map((t) => t.slaStats!);
        const slaCompliancePercent =
          slaStats.length > 0
            ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
            : 0;

        // Reopen rate
        const ticketIds = tickets.map((t) => t.id);
        const reopenedTickets =
          ticketIds.length > 0
            ? await prisma.ticketStatusHistory.findMany({
                where: {
                  ticketId: { in: ticketIds },
                  oldStatus: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
                  newStatus: TicketStatus.OPEN,
                },
                select: { ticketId: true },
                distinct: ['ticketId'],
              })
            : [];
        const resolvedForRate = tickets.filter((t) => t.resolvedAt);
        const reopenRatePercent =
          resolvedForRate.length > 0
            ? (reopenedTickets.length / resolvedForRate.length) * 100
            : 0;

        return {
          teamId: team.id,
          teamName: team.name,
          created,
          resolved,
          backlog,
          mtta,
          mttr,
          slaCompliancePercent: Math.round(slaCompliancePercent * 100) / 100,
          reopenRatePercent: Math.round(reopenRatePercent * 100) / 100,
        };
      })
    );

    return { items: items.filter((item) => item.created > 0) };
  },

  /**
   * Calcula métricas por técnico
   */
  async calculateByTechnician(
    where: any,
    startDate?: Date,
    endDate?: Date,
    useBusinessHours?: boolean,
    businessSchedule?: any
  ) {
    const technicians = await prisma.user.findMany({
      where: {
        role: { in: ['TECHNICIAN', 'TRIAGER', 'ADMIN'] },
      },
      include: {
        assignedTickets: {
          where,
          include: {
            team: true,
            slaStats: true,
          },
        },
        teams: {
          include: {
            team: true,
          },
        },
      },
    });

    const items = await Promise.all(
      technicians.map(async (technician) => {
        const tickets = technician.assignedTickets;
        const assigned = tickets.length;
        const resolved = tickets.filter(
          (t) => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED
        ).length;
        const backlog = assigned - resolved;

        // Time do técnico (primeiro time encontrado)
        const technicianTeam = technician.teams[0]?.team;
        const teamId = technicianTeam?.id || null;
        const teamName = technicianTeam?.name || null;

        // Calcular MTTA e MTTR
        const mttaTickets = tickets.filter((t) => t.firstResponseAt);
        const mttrTickets = tickets.filter((t) => t.resolvedAt);
        let mtta: number | null = null;
        let mttr: number | null = null;

        if (mttaTickets.length > 0) {
          if (useBusinessHours && businessSchedule) {
            const mttaMinutes = mttaTickets
              .map((t) =>
                businessMinutesBetween(t.createdAt, t.firstResponseAt!, businessSchedule)
              )
              .filter((m) => m > 0);
            if (mttaMinutes.length > 0) {
              mtta = mttaMinutes.reduce((a, b) => a + b, 0) / mttaMinutes.length;
            }
          } else {
            const mttaMinutes = mttaTickets.map((t) =>
              diffInCalendarMinutes(t.createdAt, t.firstResponseAt!)
            );
            if (mttaMinutes.length > 0) {
              mtta = mttaMinutes.reduce((a, b) => a + b, 0) / mttaMinutes.length;
            }
          }
        }

        if (mttrTickets.length > 0) {
          if (useBusinessHours && businessSchedule) {
            const mttrMinutes = mttrTickets
              .map((t) =>
                businessMinutesBetween(t.createdAt, t.resolvedAt!, businessSchedule)
              )
              .filter((m) => m > 0);
            if (mttrMinutes.length > 0) {
              mttr = mttrMinutes.reduce((a, b) => a + b, 0) / mttrMinutes.length;
            }
          } else {
            const mttrMinutes = mttrTickets.map((t) =>
              diffInCalendarMinutes(t.createdAt, t.resolvedAt!)
            );
            mttr = mttrMinutes.reduce((a, b) => a + b, 0) / mttrMinutes.length;
          }
        }

        // Tempo em status
        const timeInStatus = {
          inProgress: tickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).length,
          pendingUser: tickets.filter((t) => t.status === TicketStatus.WAITING_REQUESTER).length,
          pendingThirdParty: tickets.filter(
            (t) => t.status === TicketStatus.WAITING_THIRD_PARTY
          ).length,
        };

        // SLA compliance
        const slaStats = tickets.filter((t) => t.slaStats).map((t) => t.slaStats!);
        const slaCompliancePercent =
          slaStats.length > 0
            ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
            : 0;

        // Reopen rate
        const ticketIds = tickets.map((t) => t.id);
        const reopenedTickets =
          ticketIds.length > 0
            ? await prisma.ticketStatusHistory.findMany({
                where: {
                  ticketId: { in: ticketIds },
                  oldStatus: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
                  newStatus: TicketStatus.OPEN,
                },
                select: { ticketId: true },
                distinct: ['ticketId'],
              })
            : [];
        const resolvedForRate = tickets.filter((t) => t.resolvedAt);
        const reopenRatePercent =
          resolvedForRate.length > 0
            ? (reopenedTickets.length / resolvedForRate.length) * 100
            : 0;

        return {
          technicianId: technician.id,
          technicianName: technician.name,
          teamId,
          teamName,
          assigned,
          resolved,
          backlog,
          mtta,
          mttr,
          timeInStatus,
          slaCompliancePercent: Math.round(slaCompliancePercent * 100) / 100,
          reopenRatePercent: Math.round(reopenRatePercent * 100) / 100,
        };
      })
    );

    return { items: items.filter((item) => item.assigned > 0) };
  },

  /**
   * Calcula métricas por categoria e tag
   */
  async calculateByCategoryAndTag(
    where: any,
    startDate?: Date,
    endDate?: Date,
    useBusinessHours?: boolean,
    businessSchedule?: any
  ) {
    // Por categoria
    const categories = await prisma.category.findMany({
      include: {
        tickets: {
          where,
          include: {
            slaStats: true,
          },
        },
      },
    });

    const byCategory = (
      await Promise.all(
        categories.map(async (category) => {
        const tickets = category.tickets;
        const count = tickets.length;
        const resolved = tickets.filter((t) => t.resolvedAt);
        const slaStats = tickets.filter((t) => t.slaStats).map((t) => t.slaStats!);

        let mttr: number | null = null;
        if (resolved.length > 0) {
          if (useBusinessHours && businessSchedule) {
            const minutes = resolved
              .map((t) =>
                businessMinutesBetween(t.createdAt, t.resolvedAt!, businessSchedule)
              )
              .filter((m) => m > 0);
            if (minutes.length > 0) {
              mttr = minutes.reduce((a, b) => a + b, 0) / minutes.length;
            }
          } else {
            const minutes = resolved.map((t) =>
              diffInCalendarMinutes(t.createdAt, t.resolvedAt!)
            );
            mttr = minutes.reduce((a, b) => a + b, 0) / minutes.length;
          }
        }

        const slaCompliancePercent =
          slaStats.length > 0
            ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
            : 0;

        const ticketIds = tickets.map((t) => t.id);
        const reopenedTickets =
          ticketIds.length > 0
            ? await prisma.ticketStatusHistory.findMany({
                where: {
                  ticketId: { in: ticketIds },
                  oldStatus: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
                  newStatus: TicketStatus.OPEN,
                },
                select: { ticketId: true },
                distinct: ['ticketId'],
              })
            : [];
        const reopenRatePercent =
          resolved.length > 0 ? (reopenedTickets.length / resolved.length) * 100 : 0;

        return {
          categoryId: category.id,
          categoryName: category.name,
          count,
          mttr,
          slaCompliancePercent: Math.round(slaCompliancePercent * 100) / 100,
          reopenRatePercent: Math.round(reopenRatePercent * 100) / 100,
        };
      })
      )
    ).filter((c) => c.count > 0);

    // Por tag
    const ticketsWithTags = await prisma.ticket.findMany({
      where,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        slaStats: true,
      },
    });

    const tagMap = new Map<string, Array<typeof ticketsWithTags[0]>>();
    ticketsWithTags.forEach((ticket) => {
      ticket.tags.forEach((tt) => {
        if (!tagMap.has(tt.tag.name)) {
          tagMap.set(tt.tag.name, []);
        }
        tagMap.get(tt.tag.name)!.push(ticket);
      });
    });

    const byTag = (
      await Promise.all(
        Array.from(tagMap.entries()).map(async ([tag, tickets]) => {
        const count = tickets.length;
        const resolved = tickets.filter((t) => t.resolvedAt);
        const slaStats = tickets.filter((t) => t.slaStats).map((t) => t.slaStats!);

        let mttr: number | null = null;
        if (resolved.length > 0) {
          if (useBusinessHours && businessSchedule) {
            const minutes = resolved
              .map((t) =>
                businessMinutesBetween(t.createdAt, t.resolvedAt!, businessSchedule)
              )
              .filter((m) => m > 0);
            if (minutes.length > 0) {
              mttr = minutes.reduce((a, b) => a + b, 0) / minutes.length;
            }
          } else {
            const minutes = resolved.map((t) =>
              diffInCalendarMinutes(t.createdAt, t.resolvedAt!)
            );
            mttr = minutes.reduce((a, b) => a + b, 0) / minutes.length;
          }
        }

        const slaCompliancePercent =
          slaStats.length > 0
            ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
            : 0;

        const ticketIds = tickets.map((t) => t.id);
        const reopenedTickets =
          ticketIds.length > 0
            ? await prisma.ticketStatusHistory.findMany({
                where: {
                  ticketId: { in: ticketIds },
                  oldStatus: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
                  newStatus: TicketStatus.OPEN,
                },
                select: { ticketId: true },
                distinct: ['ticketId'],
              })
            : [];
        const reopenRatePercent =
          resolved.length > 0 ? (reopenedTickets.length / resolved.length) * 100 : 0;

        return {
          tag,
          count,
          mttr,
          slaCompliancePercent: Math.round(slaCompliancePercent * 100) / 100,
          reopenRatePercent: Math.round(reopenRatePercent * 100) / 100,
        };
      })
      )
    )
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50); // Top 50 tags

    return { byCategory, byTag };
  },

  /**
   * Calcula métricas de SLA com SLO (Service Level Objectives)
   */
  async calculateSla(where: any, startDate?: Date, endDate?: Date) {
    const slaStats = await prisma.ticketSlaStats.findMany({
      where: {
        ticket: where,
      },
      include: {
        ticket: {
          select: {
            priority: true,
            teamId: true,
            team: {
              select: {
                name: true,
              },
            },
          },
        },
        slaPolicy: {
          select: {
            id: true,
            name: true,
            targetCompliance: true,
            targetResolutionBusinessMinutes: true,
          },
        },
      },
    });

    const globalCompliancePercent =
      slaStats.length > 0
        ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
        : 0;

    // Buscar política de SLA padrão ou calcular média de targetCompliance das políticas ativas
    const activePolicies = await prisma.slaPolicy.findMany({
      where: { active: true },
      select: { targetCompliance: true },
    });
    
    // Calcular targetCompliance médio ou usar padrão de 98.5%
    const avgTargetCompliance = activePolicies.length > 0
      ? activePolicies.reduce((sum, p) => sum + (p.targetCompliance || 98.5), 0) / activePolicies.length
      : 98.5;

    // Determinar status do SLO
    const sloStatus: 'MET' | 'BREACHED' = globalCompliancePercent >= avgTargetCompliance ? 'MET' : 'BREACHED';

    // Por prioridade
    const byPriorityMap = new Map<TicketPriority, Array<typeof slaStats[0]>>();
    slaStats.forEach((stat) => {
      const priority = stat.ticket.priority;
      if (!byPriorityMap.has(priority)) {
        byPriorityMap.set(priority, []);
      }
      byPriorityMap.get(priority)!.push(stat);
    });

    const byPriority = Array.from(byPriorityMap.entries()).map(([priority, stats]) => {
      const compliancePercent = (stats.filter((s) => !s.breached).length / stats.length) * 100;
      // Calcular targetCompliance médio das políticas aplicadas a esses tickets
      const policies = stats.map(s => s.slaPolicy).filter(Boolean);
      const avgTarget = policies.length > 0
        ? policies.reduce((sum, p) => sum + (p?.targetCompliance || 98.5), 0) / policies.length
        : 98.5;
      return {
        priority: priority,
        compliancePercent,
        total: stats.length,
        outOfSla: stats.filter((s) => s.breached).length,
        targetCompliance: Math.round(avgTarget * 100) / 100,
        sloStatus: (compliancePercent >= avgTarget ? 'MET' : 'BREACHED') as 'MET' | 'BREACHED',
      };
    });

    // Por time
    const byTeamMap = new Map<string, Array<typeof slaStats[0]>>();
    slaStats.forEach((stat) => {
      if (stat.ticket.teamId) {
        if (!byTeamMap.has(stat.ticket.teamId)) {
          byTeamMap.set(stat.ticket.teamId, []);
        }
        byTeamMap.get(stat.ticket.teamId)!.push(stat);
      }
    });

    const byTeam = Array.from(byTeamMap.entries()).map(([teamId, stats]) => {
      const compliancePercent = (stats.filter((s) => !s.breached).length / stats.length) * 100;
      // Calcular targetCompliance médio das políticas aplicadas a esses tickets
      const policies = stats.map(s => s.slaPolicy).filter(Boolean);
      const avgTarget = policies.length > 0
        ? policies.reduce((sum, p) => sum + (p?.targetCompliance || 98.5), 0) / policies.length
        : 98.5;
      return {
        teamId,
        teamName: stats[0]?.ticket.team?.name || 'Time não encontrado',
        compliancePercent,
        total: stats.length,
        outOfSla: stats.filter((s) => s.breached).length,
        targetCompliance: Math.round(avgTarget * 100) / 100,
        sloStatus: (compliancePercent >= avgTarget ? 'MET' : 'BREACHED') as 'MET' | 'BREACHED',
      };
    });

    // Violation buckets (simplificado - baseado em tempo de violação)
    const violatedStats = slaStats.filter((s) => s.breached);
    const bucketCounts = {
      UP_TO_1H: 0,
      BETWEEN_1H_4H: 0,
      MORE_THAN_4H: 0,
    };

    violatedStats.forEach((stat) => {
      if (!stat.businessResolutionTimeMs || !stat.slaPolicy?.targetResolutionBusinessMinutes) {
        return;
      }
      const breachMinutes =
        (stat.businessResolutionTimeMs -
          stat.slaPolicy.targetResolutionBusinessMinutes * 60 * 1000) /
        60000;
      if (breachMinutes <= 60) {
        bucketCounts.UP_TO_1H += 1;
      } else if (breachMinutes <= 240) {
        bucketCounts.BETWEEN_1H_4H += 1;
      } else {
        bucketCounts.MORE_THAN_4H += 1;
      }
    });

    const violationBuckets = [
      {
        bucket: 'UP_TO_1H' as const,
        count: bucketCounts.UP_TO_1H,
      },
      {
        bucket: 'BETWEEN_1H_4H' as const,
        count: bucketCounts.BETWEEN_1H_4H,
      },
      {
        bucket: 'MORE_THAN_4H' as const,
        count: bucketCounts.MORE_THAN_4H,
      },
    ];

    return {
      globalCompliancePercent: Math.round(globalCompliancePercent * 100) / 100,
      targetCompliance: Math.round(avgTargetCompliance * 100) / 100,
      sloStatus,
      byPriority: byPriority.map((p) => ({
        ...p,
        compliancePercent: Math.round(p.compliancePercent * 100) / 100,
      })),
      byTeam: byTeam.map((t) => ({
        ...t,
        compliancePercent: Math.round(t.compliancePercent * 100) / 100,
      })),
      violationBuckets,
    };
  },

  /**
   * Calcula métricas de backlog
   */
  async calculateBacklog(where: any, useBusinessHours?: boolean, businessSchedule?: any) {
    const openTickets = await prisma.ticket.findMany({
      where: {
        ...where,
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const totalOpen = openTickets.length;
    const now = new Date();

    // Calcular idade média
    let avgAgeMinutes: number | null = null;
    if (openTickets.length > 0) {
      if (useBusinessHours && businessSchedule) {
        const ages = openTickets.map((t) =>
          businessMinutesBetween(t.createdAt, now, businessSchedule)
        );
        avgAgeMinutes = ages.reduce((a, b) => a + b, 0) / ages.length;
      } else {
        const ages = openTickets.map((t) => diffInCalendarMinutes(t.createdAt, now));
        avgAgeMinutes = ages.reduce((a, b) => a + b, 0) / ages.length;
      }
    }

    // Age buckets
    const ageBuckets = {
      '0_8H': 0,
      '8H_24H': 0,
      '1_3D': 0,
      '3_7D': 0,
      GT_7D: 0,
    };

    openTickets.forEach((ticket) => {
      const ageMinutes =
        useBusinessHours && businessSchedule
          ? businessMinutesBetween(ticket.createdAt, now, businessSchedule)
          : diffInCalendarMinutes(ticket.createdAt, now);

      if (ageMinutes < 8 * 60) {
        ageBuckets['0_8H']++;
      } else if (ageMinutes < 24 * 60) {
        ageBuckets['8H_24H']++;
      } else if (ageMinutes < 3 * 24 * 60) {
        ageBuckets['1_3D']++;
      } else if (ageMinutes < 7 * 24 * 60) {
        ageBuckets['3_7D']++;
      } else {
        ageBuckets.GT_7D++;
      }
    });

    // Por time
    const byTeamMap = new Map<string, Array<typeof openTickets[0]>>();
    openTickets.forEach((ticket) => {
      const teamId = ticket.teamId || 'no-team';
      if (!byTeamMap.has(teamId)) {
        byTeamMap.set(teamId, []);
      }
      byTeamMap.get(teamId)!.push(ticket);
    });

    const byTeam = Array.from(byTeamMap.entries()).map(([teamId, tickets]) => {
      const team = tickets[0]?.team;
      let avgAge: number | null = null;
      if (tickets.length > 0) {
        if (useBusinessHours && businessSchedule) {
          const ages = tickets.map((t) =>
            businessMinutesBetween(t.createdAt, now, businessSchedule)
          );
          avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
        } else {
          const ages = tickets.map((t) => diffInCalendarMinutes(t.createdAt, now));
          avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
        }
      }

      return {
        teamId: teamId === 'no-team' ? '' : teamId,
        teamName: team?.name || 'Sem time',
        count: tickets.length,
        avgAgeMinutes: avgAge,
      };
    });

    // Oldest tickets (top 20)
    const oldestTickets = openTickets
      .slice(0, 20)
      .map((ticket) => {
        const ageMinutes =
          useBusinessHours && businessSchedule
            ? businessMinutesBetween(ticket.createdAt, now, businessSchedule)
            : diffInCalendarMinutes(ticket.createdAt, now);

        return {
          ticketId: ticket.id,
          title: ticket.title,
          createdAt: ticket.createdAt.toISOString(),
          ageMinutes,
          teamId: ticket.teamId,
          teamName: ticket.team?.name || null,
          priority: ticket.priority,
        };
      });

    return {
      totalOpen,
      avgAgeMinutes,
      ageBuckets: [
        { bucket: '0_8H' as const, count: ageBuckets['0_8H'] },
        { bucket: '8H_24H' as const, count: ageBuckets['8H_24H'] },
        { bucket: '1_3D' as const, count: ageBuckets['1_3D'] },
        { bucket: '3_7D' as const, count: ageBuckets['3_7D'] },
        { bucket: 'GT_7D' as const, count: ageBuckets.GT_7D },
      ],
      byTeam,
      oldestTickets,
    };
  },

  /**
   * Calcula métricas pessoais de um técnico
   */
  async getTechnicianMetrics(
    technicianId: string,
    filters: { from?: Date; to?: Date; businessHours?: boolean }
  ): Promise<{
    totalTicketsAssigned: number;
    totalTicketsResolved: number;
    mtta: number | null;
    mttr: number | null;
    slaCompliancePercent: number;
    reopenRatePercent: number;
  }> {
    const startDate = filters.from;
    const endDate = filters.to;
    const useBusinessHours = filters.businessHours === true;

    const where: any = {
      assignedTechnicianId: technicianId,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) {
        const toDate = new Date(endDate);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    // Total de tickets atribuídos
    const totalTicketsAssigned = await prisma.ticket.count({ where });

    // Total de tickets resolvidos
    const totalTicketsResolved = await prisma.ticket.count({
      where: {
        ...where,
        status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      },
    });

    // Buscar schedule se necessário
    let businessSchedule = null;
    if (useBusinessHours) {
      try {
        businessSchedule = await businessCalendarService.getBusinessSchedule(null);
      } catch (error) {
        logger.warn('Não foi possível carregar calendário de negócio', { error });
      }
    }

    // Calcular MTTA
    const ticketsForMtta = await prisma.ticket.findMany({
      where: {
        ...where,
        firstResponseAt: { not: null },
      },
      select: {
        createdAt: true,
        firstResponseAt: true,
        firstResponseBusinessMinutes: true,
      },
    });

    let mtta: number | null = null;
    if (ticketsForMtta.length > 0) {
      if (useBusinessHours && businessSchedule) {
        const minutes = ticketsForMtta
          .map((t) =>
            businessMinutesBetween(t.createdAt, t.firstResponseAt!, businessSchedule)
          )
          .filter((m) => m > 0);
        if (minutes.length > 0) {
          mtta = minutes.reduce((a, b) => a + b, 0) / minutes.length;
        }
      } else {
        const minutes = ticketsForMtta.map((t) =>
          diffInCalendarMinutes(t.createdAt, t.firstResponseAt!)
        );
        mtta = minutes.reduce((a, b) => a + b, 0) / minutes.length;
      }
    }

    // Calcular MTTR
    const ticketsForMttr = await prisma.ticket.findMany({
      where: {
        ...where,
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
        resolutionBusinessMinutes: true,
      },
    });

    let mttr: number | null = null;
    if (ticketsForMttr.length > 0) {
      if (useBusinessHours && businessSchedule) {
        const minutes = ticketsForMttr
          .map((t) =>
            businessMinutesBetween(t.createdAt, t.resolvedAt!, businessSchedule)
          )
          .filter((m) => m > 0);
        if (minutes.length > 0) {
          mttr = minutes.reduce((a, b) => a + b, 0) / minutes.length;
        }
      } else {
        const minutes = ticketsForMttr.map((t) =>
          diffInCalendarMinutes(t.createdAt, t.resolvedAt!)
        );
        mttr = minutes.reduce((a, b) => a + b, 0) / minutes.length;
      }
    }

    // Calcular SLA compliance
    const slaStats = await prisma.ticketSlaStats.findMany({
      where: {
        ticket: where,
      },
      select: {
        breached: true,
      },
    });
    const slaCompliancePercent =
      slaStats.length > 0
        ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
        : 0;

    // Calcular taxa de reabertura
    const resolvedTickets = await prisma.ticket.findMany({
      where: {
        ...where,
        resolvedAt: { not: null },
      },
      select: { id: true },
    });
    const reopenedTickets = await prisma.ticketStatusHistory.findMany({
      where: {
        ticket: where,
        oldStatus: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        newStatus: TicketStatus.OPEN,
      },
      select: { ticketId: true },
      distinct: ['ticketId'],
    });
    const reopenRatePercent =
      resolvedTickets.length > 0 ? (reopenedTickets.length / resolvedTickets.length) * 100 : 0;

    return {
      totalTicketsAssigned,
      totalTicketsResolved,
      mtta,
      mttr,
      slaCompliancePercent,
      reopenRatePercent,
    };
  },
};

