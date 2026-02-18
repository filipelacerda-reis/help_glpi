import prisma from '../lib/prisma';
import { TicketStatus } from '@prisma/client';

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

type CorporateQueryOptions = {
  months: number;
  comparePrevious: boolean;
};

function shiftMonths(base: Date, months: number) {
  const date = new Date(base);
  date.setMonth(date.getMonth() + months);
  return date;
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function getDelta(current: number, previous: number) {
  const delta = current - previous;
  if (previous === 0) {
    return {
      current,
      previous,
      delta,
      deltaPercent: null as number | null,
    };
  }
  return {
    current,
    previous,
    delta,
    deltaPercent: Number(((delta / previous) * 100).toFixed(2)),
  };
}

export const corporateModulesService = {
  async getFinanceOverview(options: CorporateQueryOptions) {
    const now = new Date();
    const periodStart = shiftMonths(now, -options.months);
    const previousStart = shiftMonths(periodStart, -options.months);

    const [equipments, assignments, ticketsOpen] = await Promise.all([
      prisma.equipment.findMany({
        select: {
          value: true,
          equipmentType: true,
          purchaseDate: true,
          status: true,
        },
      }),
      prisma.equipmentAssignment.findMany({
        select: {
          returnedAt: true,
        },
      }),
      prisma.ticket.count({
        where: {
          status: {
            in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_REQUESTER, TicketStatus.WAITING_THIRD_PARTY],
          },
        },
      }),
    ]);

    const totalAssetValue = equipments.reduce((acc, item) => acc + toNumber(item.value), 0);
    const assignedAssetValue = equipments
      .filter((item) => item.status === 'ASSIGNED')
      .reduce((acc, item) => acc + toNumber(item.value), 0);

    const byTypeMap = new Map<string, { count: number; totalValue: number }>();
    for (const equipment of equipments) {
      const current = byTypeMap.get(equipment.equipmentType) || { count: 0, totalValue: 0 };
      byTypeMap.set(equipment.equipmentType, {
        count: current.count + 1,
        totalValue: current.totalValue + toNumber(equipment.value),
      });
    }

    const byMonthMap = new Map<string, number>();
    let purchasesCurrentPeriod = 0;
    let purchasesPreviousPeriod = 0;

    for (const equipment of equipments) {
      const key = monthKey(equipment.purchaseDate);
      const value = toNumber(equipment.value);
      byMonthMap.set(key, (byMonthMap.get(key) || 0) + value);

      if (equipment.purchaseDate >= periodStart && equipment.purchaseDate <= now) {
        purchasesCurrentPeriod += value;
      } else if (equipment.purchaseDate >= previousStart && equipment.purchaseDate < periodStart) {
        purchasesPreviousPeriod += value;
      }
    }

    return {
      totalAssetValue,
      assignedAssetValue,
      inStockAssetValue: totalAssetValue - assignedAssetValue,
      openTickets: ticketsOpen,
      assignments: {
        active: assignments.filter((a) => !a.returnedAt).length,
        returned: assignments.filter((a) => !!a.returnedAt).length,
      },
      byType: Array.from(byTypeMap.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        totalValue: data.totalValue,
      })),
      purchasesByMonth: Array.from(byMonthMap.entries())
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-options.months),
      periodMonths: options.months,
      comparison: options.comparePrevious
        ? {
            purchases: getDelta(purchasesCurrentPeriod, purchasesPreviousPeriod),
          }
        : null,
    };
  },

  async getHrOverview(options: CorporateQueryOptions) {
    const now = new Date();
    const periodStart = shiftMonths(now, -options.months);
    const previousStart = shiftMonths(periodStart, -options.months);

    const [employees, teams, activeAssignments, newHires30d] = await Promise.all([
      prisma.employee.findMany({
        select: {
          id: true,
          active: true,
          teamId: true,
          roleTitle: true,
          hireDate: true,
          createdAt: true,
          assignments: {
            where: { returnedAt: null },
            select: { id: true },
          },
        },
      }),
      prisma.team.findMany({
        select: { id: true, name: true },
      }),
      prisma.equipmentAssignment.count({
        where: { returnedAt: null },
      }),
      prisma.employee.count({
        where: {
          hireDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
    const byTeam = new Map<string, number>();
    const byRole = new Map<string, number>();
    const hiresByMonthMap = new Map<string, number>();
    let hiresCurrentPeriod = 0;
    let hiresPreviousPeriod = 0;

    for (const employee of employees) {
      const team = employee.teamId ? teamNameById.get(employee.teamId) || 'Sem time' : 'Sem time';
      byTeam.set(team, (byTeam.get(team) || 0) + 1);
      byRole.set(employee.roleTitle, (byRole.get(employee.roleTitle) || 0) + 1);
      const hireRef = employee.hireDate || employee.createdAt;
      const key = monthKey(hireRef);
      hiresByMonthMap.set(key, (hiresByMonthMap.get(key) || 0) + 1);

      if (hireRef >= periodStart && hireRef <= now) {
        hiresCurrentPeriod += 1;
      } else if (hireRef >= previousStart && hireRef < periodStart) {
        hiresPreviousPeriod += 1;
      }
    }

    return {
      totalEmployees: employees.length,
      activeEmployees: employees.filter((e) => e.active).length,
      inactiveEmployees: employees.filter((e) => !e.active).length,
      activeAssignments,
      newHiresLast30Days: newHires30d,
      byTeam: Array.from(byTeam.entries()).map(([team, count]) => ({ team, count })),
      byRole: Array.from(byRole.entries())
        .map(([roleTitle, count]) => ({ roleTitle, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      employeesWithAssets: employees.filter((e) => e.assignments.length > 0).length,
      hiresByMonth: Array.from(hiresByMonthMap.entries())
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-options.months),
      periodMonths: options.months,
      comparison: options.comparePrevious
        ? {
            hires: getDelta(hiresCurrentPeriod, hiresPreviousPeriod),
          }
        : null,
    };
  },

  async getProcurementOverview(options: CorporateQueryOptions) {
    const now = new Date();
    const periodStart = shiftMonths(now, -options.months);
    const previousStart = shiftMonths(periodStart, -options.months);
    const warrantyThreshold = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    const [equipments, activeAssignments, openTickets] = await Promise.all([
      prisma.equipment.findMany({
        select: {
          id: true,
          equipmentType: true,
          status: true,
          warrantyEndDate: true,
          purchaseDate: true,
        },
      }),
      prisma.equipmentAssignment.findMany({
        where: { returnedAt: null },
        select: {
          id: true,
          expectedReturnAt: true,
        },
      }),
      prisma.ticket.findMany({
        where: {
          status: {
            in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_REQUESTER, TicketStatus.WAITING_THIRD_PARTY],
          },
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    const overdueReturns = activeAssignments.filter(
      (a) => a.expectedReturnAt && a.expectedReturnAt.getTime() < now.getTime()
    ).length;

    const warrantyExpiring = equipments.filter(
      (e) => e.warrantyEndDate && e.warrantyEndDate.getTime() <= warrantyThreshold.getTime()
    ).length;

    const retiredOrLost = equipments.filter((e) => e.status === 'RETIRED' || e.status === 'LOST');

    const replacementByType = new Map<string, number>();
    for (const item of retiredOrLost) {
      replacementByType.set(item.equipmentType, (replacementByType.get(item.equipmentType) || 0) + 1);
    }

    const openByMonthMap = new Map<string, number>();
    let openCurrentPeriod = 0;
    let openPreviousPeriod = 0;
    for (const ticket of openTickets) {
      const key = monthKey(ticket.createdAt);
      openByMonthMap.set(key, (openByMonthMap.get(key) || 0) + 1);

      if (ticket.createdAt >= periodStart && ticket.createdAt <= now) {
        openCurrentPeriod += 1;
      } else if (ticket.createdAt >= previousStart && ticket.createdAt < periodStart) {
        openPreviousPeriod += 1;
      }
    }

    return {
      pendingOperationalTickets: openTickets.length,
      activeAssignments: activeAssignments.length,
      overdueReturns,
      warrantyExpiring45Days: warrantyExpiring,
      replacementDemandByType: Array.from(replacementByType.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      retiredOrLostCount: retiredOrLost.length,
      openTicketsByMonth: Array.from(openByMonthMap.entries())
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-options.months),
      periodMonths: options.months,
      comparison: options.comparePrevious
        ? {
            pendingTickets: getDelta(openCurrentPeriod, openPreviousPeriod),
          }
        : null,
    };
  },
};
