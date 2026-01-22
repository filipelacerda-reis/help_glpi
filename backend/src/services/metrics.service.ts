import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export interface MetricsFilters {
  teamId?: string;
}

export const metricsService = {
  async getMetrics(filters?: MetricsFilters) {
    logger.debug('Calculando métricas do sistema', { filters });

    // Construir filtro de where baseado no time (se fornecido)
    const whereClause: any = {};
    if (filters?.teamId) {
      whereClause.teamId = filters.teamId;
    }

    // Tickets por status
    const ticketsByStatus = await prisma.ticket.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { _all: true },
    });

    // Tickets por prioridade
    const ticketsByPriority = await prisma.ticket.groupBy({
      by: ['priority'],
      where: whereClause,
      _count: { _all: true },
    });

    // Tickets por time
    const ticketsByTeam = await prisma.ticket.groupBy({
      by: ['teamId'],
      where: whereClause,
      _count: { _all: true },
    });

    // Buscar tickets resolvidos para calcular tempo médio
    const resolvedTickets = await prisma.ticket.findMany({
      where: {
        resolvedAt: { not: null },
        ...whereClause,
      },
      select: {
        id: true,
        createdAt: true,
        resolvedAt: true,
        teamId: true,
      },
    });

    // Calcular tempo médio de resolução por time
    const metricsByTeam: Record<string, { total: number; totalHours: number }> = {};

    for (const ticket of resolvedTickets) {
      if (!ticket.teamId || !ticket.resolvedAt) continue;

      const hours =
        (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);

      if (!metricsByTeam[ticket.teamId]) {
        metricsByTeam[ticket.teamId] = { total: 0, totalHours: 0 };
      }

      metricsByTeam[ticket.teamId].total += 1;
      metricsByTeam[ticket.teamId].totalHours += hours;
    }

    // Buscar informações dos times para incluir nos resultados
    const teamIds = Object.keys(metricsByTeam);
    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true },
    });

    const teamMap = new Map(teams.map((t) => [t.id, t.name]));

    const avgResolutionTimeByTeam = Object.entries(metricsByTeam).map(
      ([teamId, { total, totalHours }]) => ({
        teamId,
        teamName: teamMap.get(teamId) || 'Time não encontrado',
        totalResolved: total,
        avgResolutionHours: totalHours / total,
      })
    );

    // Enriquecer ticketsByTeam com nomes dos times
    const teamsForTickets = await prisma.team.findMany({
      where: {
        id: {
          in: ticketsByTeam
            .map((t) => t.teamId)
            .filter((id): id is string => id !== null),
        },
      },
      select: { id: true, name: true },
    });

    const teamNameMap = new Map(teamsForTickets.map((t) => [t.id, t.name]));

    const ticketsByTeamWithNames = ticketsByTeam.map((item) => ({
      teamId: item.teamId,
      teamName: item.teamId ? teamNameMap.get(item.teamId) || 'Time não encontrado' : null,
      count: item._count._all,
    }));

    logger.info('Métricas calculadas com sucesso');

    // Calcular totais para garantir que nunca retornem null
    const totalTickets = ticketsByStatus.reduce((sum, item) => sum + item._count._all, 0);
    const openTickets = ticketsByStatus
      .filter((item) => !['RESOLVED', 'CLOSED'].includes(item.status))
      .reduce((sum, item) => sum + item._count._all, 0);
    const closedTickets = ticketsByStatus
      .filter((item) => ['RESOLVED', 'CLOSED'].includes(item.status))
      .reduce((sum, item) => sum + item._count._all, 0);

    return {
      totalTickets,
      openTickets,
      closedTickets,
      ticketsByStatus: ticketsByStatus.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
      ticketsByPriority: ticketsByPriority.map((item) => ({
        priority: item.priority,
        count: item._count._all,
      })),
      ticketsByTeam: ticketsByTeamWithNames,
      avgResolutionTimeByTeam,
    };
  },
};

