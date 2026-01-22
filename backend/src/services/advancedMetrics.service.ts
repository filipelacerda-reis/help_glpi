import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { TicketType, TagGroup, InteractionType } from '@prisma/client';
import { businessMinutesToHours } from '../utils/businessHours';

export interface MetricsFilters {
  from?: Date;
  to?: Date;
  tipo?: TicketType;
  teamResponsavelId?: string;
  teamSolicitanteId?: string;
  categoryId?: string;
  featureTag?: string; // ID da tag feature
  infraTag?: string; // ID da tag infra
  rcTag?: string; // ID da tag rc
}

export const advancedMetricsService = {
  async getTicketSummary(filters?: MetricsFilters) {
    logger.debug('Calculando métricas avançadas de tickets', { filters });

    const where: any = {};

    // Filtro por data
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) {
        where.createdAt.gte = filters.from;
      }
      if (filters.to) {
        where.createdAt.lte = filters.to;
      }
    }

    // Filtros adicionais
    if (filters?.tipo) {
      where.tipo = filters.tipo;
    }
    if (filters?.teamResponsavelId) {
      where.teamId = filters.teamResponsavelId;
    }
    if (filters?.teamSolicitanteId) {
      where.teamSolicitanteId = filters.teamSolicitanteId;
    }
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    // Filtro por tags (se fornecido)
    if (filters?.featureTag || filters?.infraTag || filters?.rcTag) {
      const tagFilters: any[] = [];
      if (filters.featureTag) {
        tagFilters.push({ tagId: filters.featureTag });
      }
      if (filters.infraTag) {
        tagFilters.push({ tagId: filters.infraTag });
      }
      if (filters.rcTag) {
        tagFilters.push({ tagId: filters.rcTag });
      }

      if (tagFilters.length > 0) {
        where.tags = {
          some: {
            OR: tagFilters,
          },
        };
      }
    }

    // 1. Contagem por tipo
    const ticketsByType = await prisma.ticket.groupBy({
      by: ['tipo'],
      where,
      _count: { _all: true },
    });

    // 2. Contagem por categoria
    const ticketsByCategory = await prisma.ticket.groupBy({
      by: ['categoryId'],
      where,
      _count: { _all: true },
    });

    // 3. Top tags por grupo
    const topFeatureTags = await this.getTopTagsByGroup(where, TagGroup.FEATURE, 10);
    const topInfraTags = await this.getTopTagsByGroup(where, TagGroup.INFRA, 10);
    const topRcTags = await this.getTopTagsByGroup(where, TagGroup.RC, 10);
    const topQuestionTags = await this.getTopTagsByGroup(where, TagGroup.QUESTION, 10);

    // 4. Recorrência de dúvidas (tipo QUESTION)
    const questionTickets = await prisma.ticket.findMany({
      where: {
        ...where,
        tipo: TicketType.QUESTION,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        teamSolicitante: true,
      },
    });

    const questionsByTag: Record<string, number> = {};
    const questionsByTeam: Record<string, number> = {};

    questionTickets.forEach((ticket) => {
      // Por tag question:*
      ticket.tags.forEach((tt) => {
        if (tt.tag.group === TagGroup.QUESTION) {
          questionsByTag[tt.tag.name] = (questionsByTag[tt.tag.name] || 0) + 1;
        }
      });

      // Por time solicitante
      if (ticket.teamSolicitanteId) {
        questionsByTeam[ticket.teamSolicitanteId] = (questionsByTeam[ticket.teamSolicitanteId] || 0) + 1;
      }
    });

    // 5. MTTR (Mean Time To Resolution) - Tempo médio de resolução
    const resolvedTickets = await prisma.ticket.findMany({
      where: {
        ...where,
        resolvedAt: { not: null },
        resolutionBusinessMinutes: { not: null },
      },
      select: {
        tipo: true,
        teamId: true,
        resolutionBusinessMinutes: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // MTTR geral
    const mttrGeneral = this.calculateAverage(resolvedTickets.map((t) => t.resolutionBusinessMinutes || 0));

    // MTTR por tipo
    const mttrByType: Record<string, number> = {};
    const ticketsByTypeMap = new Map<TicketType, number[]>();
    resolvedTickets.forEach((t) => {
      if (!ticketsByTypeMap.has(t.tipo)) {
        ticketsByTypeMap.set(t.tipo, []);
      }
      ticketsByTypeMap.get(t.tipo)!.push(t.resolutionBusinessMinutes || 0);
    });
    ticketsByTypeMap.forEach((minutes, tipo) => {
      mttrByType[tipo] = this.calculateAverage(minutes);
    });

    // MTTR por time responsável
    const mttrByTeam: Record<string, { teamName: string; avgHours: number; count: number }> = {};
    const ticketsByTeamMap = new Map<string, number[]>();
    resolvedTickets.forEach((t) => {
      if (t.teamId) {
        if (!ticketsByTeamMap.has(t.teamId)) {
          ticketsByTeamMap.set(t.teamId, []);
        }
        ticketsByTeamMap.get(t.teamId)!.push(t.resolutionBusinessMinutes || 0);
      }
    });

    // Buscar nomes dos times
    const teamIds = Array.from(ticketsByTeamMap.keys());
    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true },
    });
    const teamMap = new Map(teams.map((t) => [t.id, t.name]));

    ticketsByTeamMap.forEach((minutes, teamId) => {
      mttrByTeam[teamId] = {
        teamName: teamMap.get(teamId) || 'Time não encontrado',
        avgHours: this.calculateAverage(minutes),
        count: minutes.length,
      };
    });

    // MTTR por FEATURE, INFRA, RC
    const mttrByFeature = this.calculateMTTRByTagGroup(resolvedTickets, TagGroup.FEATURE);
    const mttrByInfra = this.calculateMTTRByTagGroup(resolvedTickets, TagGroup.INFRA);
    const mttrByRc = this.calculateMTTRByTagGroup(resolvedTickets, TagGroup.RC);

    // 6. Tempo médio de primeira resposta
    const ticketsWithFirstResponse = await prisma.ticket.findMany({
      where: {
        ...where,
        firstResponseAt: { not: null },
        firstResponseBusinessMinutes: { not: null },
      },
      select: {
        tipo: true,
        teamId: true,
        categoryId: true,
        firstResponseBusinessMinutes: true,
      },
    });

    const avgFirstResponseGeneral = this.calculateAverage(
      ticketsWithFirstResponse.map((t) => t.firstResponseBusinessMinutes || 0)
    );

    // Por time responsável
    const avgFirstResponseByTeam: Record<string, { teamName: string; avgHours: number; count: number }> = {};
    const firstResponseByTeamMap = new Map<string, number[]>();
    ticketsWithFirstResponse.forEach((t) => {
      if (t.teamId) {
        if (!firstResponseByTeamMap.has(t.teamId)) {
          firstResponseByTeamMap.set(t.teamId, []);
        }
        firstResponseByTeamMap.get(t.teamId)!.push(t.firstResponseBusinessMinutes || 0);
      }
    });

    firstResponseByTeamMap.forEach((minutes, teamId) => {
      avgFirstResponseByTeam[teamId] = {
        teamName: teamMap.get(teamId) || 'Time não encontrado',
        avgHours: this.calculateAverage(minutes),
        count: minutes.length,
      };
    });

    // Por tipo
    const avgFirstResponseByType: Record<string, number> = {};
    const firstResponseByTypeMap = new Map<TicketType, number[]>();
    ticketsWithFirstResponse.forEach((t) => {
      if (!firstResponseByTypeMap.has(t.tipo)) {
        firstResponseByTypeMap.set(t.tipo, []);
      }
      firstResponseByTypeMap.get(t.tipo)!.push(t.firstResponseBusinessMinutes || 0);
    });
    firstResponseByTypeMap.forEach((minutes, tipo) => {
      avgFirstResponseByType[tipo] = this.calculateAverage(minutes);
    });

    // Por categoria
    const avgFirstResponseByCategory: Record<string, { categoryName: string; avgHours: number; count: number }> = {};
    const firstResponseByCategoryMap = new Map<string, number[]>();
    ticketsWithFirstResponse.forEach((t) => {
      if (t.categoryId) {
        if (!firstResponseByCategoryMap.has(t.categoryId)) {
          firstResponseByCategoryMap.set(t.categoryId, []);
        }
        firstResponseByCategoryMap.get(t.categoryId)!.push(t.firstResponseBusinessMinutes || 0);
      }
    });

    // Buscar nomes das categorias
    const categoryIds = Array.from(firstResponseByCategoryMap.keys());
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    firstResponseByCategoryMap.forEach((minutes, categoryId) => {
      avgFirstResponseByCategory[categoryId] = {
        categoryName: categoryMap.get(categoryId) || 'Categoria não encontrada',
        avgHours: this.calculateAverage(minutes),
        count: minutes.length,
      };
    });

    // 7. Qual time abre mais chamados
    const ticketsByRequesterTeam = await prisma.ticket.groupBy({
      by: ['teamSolicitanteId'],
      where,
      _count: { _all: true },
    });

    const requesterTeams = await prisma.team.findMany({
      where: {
        id: {
          in: ticketsByRequesterTeam
            .map((t) => t.teamSolicitanteId)
            .filter((id): id is string => id !== null),
        },
      },
      select: { id: true, name: true },
    });
    const requesterTeamMap = new Map(requesterTeams.map((t) => [t.id, t.name]));

    // 8. Qual time responde mais chamados
    const interactionsByTeam = await prisma.ticketInteraction.groupBy({
      by: ['authorTeamId'],
      where: {
        type: InteractionType.PUBLIC_REPLY,
        createdAt: filters?.from || filters?.to
          ? {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            }
          : undefined,
      },
      _count: { _all: true },
    });

    const responseTeams = await prisma.team.findMany({
      where: {
        id: {
          in: interactionsByTeam
            .map((i) => i.authorTeamId)
            .filter((id): id is string => id !== null),
        },
      },
      select: { id: true, name: true },
    });
    const responseTeamMap = new Map(responseTeams.map((t) => [t.id, t.name]));

    // 9. Quem do time responde mais
    const interactionsByAuthor = await prisma.ticketInteraction.groupBy({
      by: ['authorId'],
      where: {
        type: InteractionType.PUBLIC_REPLY,
        createdAt: filters?.from || filters?.to
          ? {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            }
          : undefined,
      },
      _count: { _all: true },
      orderBy: {
        _count: {
          authorId: 'desc',
        },
      },
      take: 20, // Top 20
    });

    const authorIds = interactionsByAuthor.map((i) => i.authorId);
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, name: true, email: true },
    });
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    logger.info('Métricas avançadas calculadas com sucesso');

    return {
      ticketsByType: ticketsByType.map((item) => ({
        tipo: item.tipo,
        count: item._count._all,
      })),
      ticketsByCategory: ticketsByCategory.map((item) => ({
        categoryId: item.categoryId,
        count: item._count._all,
      })),
      topFeatureTags,
      topInfraTags,
      topRcTags,
      topQuestionTags,
      questionsByTag: Object.entries(questionsByTag).map(([tag, count]) => ({ tag, count })),
      questionsByTeam: Object.entries(questionsByTeam).map(([teamId, count]) => ({
        teamId,
        teamName: requesterTeamMap.get(teamId) || 'Time não encontrado',
        count,
      })),
      mttr: {
        general: businessMinutesToHours(mttrGeneral),
        byType: Object.fromEntries(
          Object.entries(mttrByType).map(([tipo, minutes]) => [tipo, businessMinutesToHours(minutes)])
        ),
        byTeam: Object.fromEntries(
          Object.entries(mttrByTeam).map(([teamId, data]) => [
            teamId,
            { ...data, avgHours: businessMinutesToHours(data.avgHours) },
          ])
        ),
        byFeature: mttrByFeature,
        byInfra: mttrByInfra,
        byRc: mttrByRc,
      },
      avgFirstResponse: {
        general: businessMinutesToHours(avgFirstResponseGeneral),
        byTeam: Object.fromEntries(
          Object.entries(avgFirstResponseByTeam).map(([teamId, data]) => [
            teamId,
            { ...data, avgHours: businessMinutesToHours(data.avgHours) },
          ])
        ),
        byType: Object.fromEntries(
          Object.entries(avgFirstResponseByType).map(([tipo, minutes]) => [tipo, businessMinutesToHours(minutes)])
        ),
        byCategory: Object.fromEntries(
          Object.entries(avgFirstResponseByCategory).map(([categoryId, data]) => [
            categoryId,
            { ...data, avgHours: businessMinutesToHours(data.avgHours) },
          ])
        ),
      },
      ticketsByRequesterTeam: ticketsByRequesterTeam.map((item) => ({
        teamId: item.teamSolicitanteId,
        teamName: item.teamSolicitanteId ? requesterTeamMap.get(item.teamSolicitanteId) || 'Time não encontrado' : null,
        count: item._count._all,
      })),
      interactionsByTeam: interactionsByTeam.map((item) => ({
        teamId: item.authorTeamId,
        teamName: item.authorTeamId ? responseTeamMap.get(item.authorTeamId) || 'Time não encontrado' : null,
        count: item._count._all,
      })),
      interactionsByAuthor: interactionsByAuthor.map((item) => ({
        authorId: item.authorId,
        author: authorMap.get(item.authorId) || null,
        count: item._count._all,
      })),
    };
  },

  async getTopTagsByGroup(where: any, group: TagGroup, limit: number = 10) {
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    const tagCounts: Record<string, number> = {};

    tickets.forEach((ticket) => {
      ticket.tags.forEach((tt) => {
        if (tt.tag.group === group && tt.tag.isActive) {
          tagCounts[tt.tag.name] = (tagCounts[tt.tag.name] || 0) + 1;
        }
      });
    });

    return Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  calculateMTTRByTagGroup(
    tickets: Array<{
      resolutionBusinessMinutes: number | null;
      tags: Array<{ tag: { group: TagGroup; name: string; isActive: boolean } }>;
    }>,
    group: TagGroup
  ): Array<{ tag: string; avgHours: number; count: number }> {
    const tagMap = new Map<string, number[]>();

    tickets.forEach((ticket) => {
      if (!ticket.resolutionBusinessMinutes) return;

      ticket.tags.forEach((tt) => {
        if (tt.tag.group === group && tt.tag.isActive) {
          if (!tagMap.has(tt.tag.name)) {
            tagMap.set(tt.tag.name, []);
          }
          tagMap.get(tt.tag.name)!.push(ticket.resolutionBusinessMinutes!);
        }
      });
    });

    return Array.from(tagMap.entries())
      .map(([tag, minutes]) => ({
        tag,
        avgHours: businessMinutesToHours(this.calculateAverage(minutes)),
        count: minutes.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  },

  calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, n) => acc + n, 0);
    return sum / numbers.length;
  },

  /**
   * Métricas expandidas para dashboard administrativo
   */
  async getExpandedMetrics(filters?: {
    from?: Date;
    to?: Date;
    teamId?: string;
    agentId?: string;
    categoryId?: string;
    priority?: string;
    status?: string;
    requesterTeamId?: string;
  }) {
    logger.debug('Calculando métricas expandidas', { filters });

    const where: any = {};

    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    if (filters?.teamId) where.teamId = filters.teamId;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.status) where.status = filters.status;
    if (filters?.requesterTeamId) where.teamSolicitanteId = filters.requesterTeamId;

    // Métricas globais
    const [totalCreated, totalResolved, openTickets, slaStats, csatStats, reopenCount] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.count({ where: { ...where, status: { in: ['RESOLVED', 'CLOSED'] } } }),
      prisma.ticket.count({ where: { ...where, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      prisma.ticketSlaStats.findMany({
        where: {
          ticket: where,
        },
        select: {
          breached: true,
          businessFirstResponseTimeMs: true,
          businessResolutionTimeMs: true,
          slaPolicy: {
            select: {
              targetFirstResponseBusinessMinutes: true,
              targetResolutionBusinessMinutes: true,
            },
          },
        },
      }),
      prisma.ticketSatisfaction.findMany({
        where: {
          ticket: where,
        },
        select: {
          score: true,
        },
      }),
      prisma.ticketEvent.count({
        where: {
          ticket: where,
          eventType: 'STATUS_CHANGED',
          newValue: { path: ['status'], equals: 'OPEN' },
        },
      }),
    ]);

    // Calcular SLA compliance
    const slaComplianceRate =
      slaStats.length > 0
        ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
        : 0;

    // Calcular tempos médios
    const avgFirstResponse =
      slaStats.filter((s) => s.businessFirstResponseTimeMs).length > 0
        ? slaStats
            .filter((s) => s.businessFirstResponseTimeMs)
            .reduce((acc, s) => acc + (s.businessFirstResponseTimeMs || 0), 0) /
          slaStats.filter((s) => s.businessFirstResponseTimeMs).length /
          1000 /
          60
        : 0;

    const avgResolution =
      slaStats.filter((s) => s.businessResolutionTimeMs).length > 0
        ? slaStats
            .filter((s) => s.businessResolutionTimeMs)
            .reduce((acc, s) => acc + (s.businessResolutionTimeMs || 0), 0) /
          slaStats.filter((s) => s.businessResolutionTimeMs).length /
          1000 /
          60
        : 0;

    // Calcular CSAT médio
    const csatAverage =
      csatStats.length > 0
        ? csatStats.reduce((acc, s) => acc + s.score, 0) / csatStats.length
        : 0;

    // Calcular taxa de reabertura
    const reopenRate = totalResolved > 0 ? (reopenCount / totalResolved) * 100 : 0;

    // Métricas por time
    const teams = await prisma.team.findMany({
      include: {
        responsibleTickets: {
          where,
          include: {
            slaStats: true,
            satisfaction: true,
          },
        },
      },
    });

    const byTeam = teams
      .map((team) => {
        const tickets = team.responsibleTickets;
        const resolved = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');
        const slaStats = tickets.filter((t) => t.slaStats).map((t) => t.slaStats!);
        const csatStats = tickets.filter((t) => t.satisfaction).map((t) => t.satisfaction!);

        const compliance =
          slaStats.length > 0
            ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
            : 0;

        const avgRes = slaStats.filter((s) => s.businessResolutionTimeMs).length > 0
          ? slaStats
              .filter((s) => s.businessResolutionTimeMs)
              .reduce((acc, s) => acc + (s.businessResolutionTimeMs || 0), 0) /
            slaStats.filter((s) => s.businessResolutionTimeMs).length /
            1000 /
            60
          : 0;

        const csat = csatStats.length > 0
          ? csatStats.reduce((acc, s) => acc + s.score, 0) / csatStats.length
          : 0;

        return {
          teamId: team.id,
          teamName: team.name,
          ticketsCreated: tickets.length,
          ticketsResolved: resolved.length,
          slaComplianceRate: compliance,
          averageResolutionBusinessMinutes: avgRes,
          csatAverage: csat,
        };
      })
      .filter((t) => t.ticketsCreated > 0);

    // Métricas por agente
    const agents = await prisma.user.findMany({
      where: {
        role: { in: ['TECHNICIAN', 'TRIAGER', 'ADMIN'] },
      },
      include: {
        assignedTickets: {
          where,
          include: {
            slaStats: true,
            satisfaction: true,
          },
        },
      },
    });

    const byAgent = agents
      .map((agent) => {
        const tickets = agent.assignedTickets;
        const resolved = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');
        const slaStats = tickets.filter((t) => t.slaStats).map((t) => t.slaStats!);
        const csatStats = tickets.filter((t) => t.satisfaction).map((t) => t.satisfaction!);

        const compliance =
          slaStats.length > 0
            ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
            : 0;

        const avgRes = slaStats.filter((s) => s.businessResolutionTimeMs).length > 0
          ? slaStats
              .filter((s) => s.businessResolutionTimeMs)
              .reduce((acc, s) => acc + (s.businessResolutionTimeMs || 0), 0) /
            slaStats.filter((s) => s.businessResolutionTimeMs).length /
            1000 /
            60
          : 0;

        const csat = csatStats.length > 0
          ? csatStats.reduce((acc, s) => acc + s.score, 0) / csatStats.length
          : 0;

        return {
          agentId: agent.id,
          agentName: agent.name,
          ticketsResolved: resolved.length,
          slaComplianceRate: compliance,
          averageResolutionBusinessMinutes: avgRes,
          csatAverage: csat,
        };
      })
      .filter((a) => a.ticketsResolved > 0)
      .sort((a, b) => b.ticketsResolved - a.ticketsResolved);

    // Métricas por categoria
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

    const byCategory = categories
      .map((category) => {
        const tickets = category.tickets;
        const resolved = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');
        const slaStats = tickets.filter((t) => t.slaStats).map((t) => t.slaStats!);

        const avgRes = slaStats.filter((s) => s.businessResolutionTimeMs).length > 0
          ? slaStats
              .filter((s) => s.businessResolutionTimeMs)
              .reduce((acc, s) => acc + (s.businessResolutionTimeMs || 0), 0) /
            slaStats.filter((s) => s.businessResolutionTimeMs).length /
            1000 /
            60
          : 0;

        return {
          categoryId: category.id,
          categoryName: category.name,
          ticketsCreated: tickets.length,
          ticketsResolved: resolved.length,
          averageResolutionBusinessMinutes: avgRes,
        };
      })
      .filter((c) => c.ticketsCreated > 0);

    // Time series (tickets criados e resolvidos por dia)
    const dateRange = filters?.from && filters?.to
      ? Math.ceil((filters.to.getTime() - filters.from.getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    const timeSeries: any[] = [];
    for (let i = 0; i < dateRange; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (dateRange - i - 1));
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [created, resolved] = await Promise.all([
        prisma.ticket.count({
          where: {
            ...where,
            createdAt: { gte: date, lt: nextDate },
          },
        }),
        prisma.ticket.count({
          where: {
            ...where,
            resolvedAt: { gte: date, lt: nextDate },
          },
        }),
      ]);

      timeSeries.push({
        date: date.toISOString().split('T')[0],
        ticketsCreated: created,
        ticketsResolved: resolved,
      });
    }

    // SLA risk buckets
    const slaInstances = await prisma.ticketSlaInstance.findMany({
      where: {
        ticket: where,
        status: { in: ['RUNNING', 'PAUSED'] },
      },
      include: {
        slaPolicy: true,
        ticket: {
          include: {
            slaStats: true,
          },
        },
      },
    });

    // Calcular risco baseado no tempo restante (simplificado)
    const onTrack = slaInstances.filter((i) => {
      // Lógica simplificada - pode ser melhorada
      return true; // Por enquanto, considerar todos como on track
    }).length;

    const atRisk = 0; // Implementar lógica de risco
    const breached = await prisma.ticketSlaInstance.count({
      where: {
        ticket: where,
        status: 'BREACHED',
      },
    });

    return {
      global: {
        totalTicketsCreated: totalCreated,
        totalTicketsResolved: totalResolved,
        backlogOpenTickets: openTickets,
        slaComplianceRate: Math.round(slaComplianceRate * 100) / 100,
        averageFirstResponseBusinessMinutes: Math.round(avgFirstResponse * 100) / 100,
        averageResolutionBusinessMinutes: Math.round(avgResolution * 100) / 100,
        reopenRate: Math.round(reopenRate * 100) / 100,
        csatAverage: Math.round(csatAverage * 100) / 100,
      },
      byTeam,
      byAgent,
      byCategory,
      timeSeries,
      slaRiskBuckets: {
        onTrack,
        atRisk,
        breached,
      },
    };
  },
};

