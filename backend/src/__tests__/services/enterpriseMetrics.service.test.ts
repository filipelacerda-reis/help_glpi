import { TicketStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import { enterpriseMetricsService } from '../../services/enterpriseMetrics.service';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    ticket: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    ticketSlaStats: {
      findMany: jest.fn(),
    },
    ticketStatusHistory: {
      findMany: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

const businessSchedule = {
  timezone: 'America/Sao_Paulo',
  weekly: {
    0: { start: '09:00', end: '18:00', enabled: false },
    1: { start: '09:00', end: '18:00', enabled: true },
    2: { start: '09:00', end: '18:00', enabled: true },
    3: { start: '09:00', end: '18:00', enabled: true },
    4: { start: '09:00', end: '18:00', enabled: true },
    5: { start: '09:00', end: '18:00', enabled: true },
    6: { start: '09:00', end: '18:00', enabled: false },
  },
  holidays: [],
};

const ticketA = {
  id: 'ticket-a',
  createdAt: new Date('2024-01-15T12:00:00Z'),
  firstResponseAt: new Date('2024-01-15T13:00:00Z'),
  resolvedAt: null,
  status: TicketStatus.OPEN,
  slaStats: { breached: false },
};

const ticketB = {
  id: 'ticket-b',
  createdAt: new Date('2024-01-15T12:00:00Z'),
  firstResponseAt: new Date('2024-01-15T14:00:00Z'),
  resolvedAt: new Date('2024-01-15T15:00:00Z'),
  status: TicketStatus.RESOLVED,
  slaStats: { breached: false },
};

const ticketC = {
  id: 'ticket-c',
  createdAt: new Date('2024-01-15T12:00:00Z'),
  firstResponseAt: new Date('2024-01-15T14:00:00Z'),
  resolvedAt: new Date('2024-01-15T15:00:00Z'),
  status: TicketStatus.OPEN,
  slaStats: { breached: false },
};

describe('enterpriseMetricsService', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('calculates MTTA/MTTR and reopen rate in overview', async () => {
    (prisma.ticket.count as jest.Mock)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    (prisma.ticket.findMany as jest.Mock)
      .mockResolvedValueOnce([ticketA, ticketB, ticketC])
      .mockResolvedValueOnce([{ id: 'ticket-b' }, { id: 'ticket-c' }]);

    (prisma.ticketSlaStats.findMany as jest.Mock).mockResolvedValue([
      { breached: false },
      { breached: false },
    ]);

    (prisma.ticketStatusHistory.findMany as jest.Mock).mockResolvedValue([
      { ticketId: 'ticket-c' },
    ]);

    jest.spyOn(enterpriseMetricsService, 'calculateTrend').mockResolvedValue([]);

    (prisma.ticket.groupBy as jest.Mock)
      .mockResolvedValueOnce([{ priority: 'HIGH', _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ teamSolicitanteId: 'team-a', _count: { _all: 1 } }]);

    (prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-a', name: 'Time A' },
    ]);

    const result = await enterpriseMetricsService.calculateOverview(
      {},
      undefined,
      undefined,
      true,
      businessSchedule
    );

    expect(result.mtta).toBe(100);
    expect(result.mttr).toBe(180);
    expect(result.reopenRatePercent).toBe(50);
  });

  it('calculates backlog aging with business minutes', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T15:00:00Z'));

    (prisma.ticket.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'ticket-backlog',
        title: 'Backlog',
        createdAt: new Date('2024-01-15T12:00:00Z'),
        teamId: 'team-a',
        team: { id: 'team-a', name: 'Time A' },
        priority: 'HIGH',
      },
    ]);

    const result = await enterpriseMetricsService.calculateBacklog({}, true, businessSchedule);

    expect(result.avgAgeMinutes).toBe(180);
    expect(result.totalOpen).toBe(1);
    expect(result.ageBuckets.find((b) => b.bucket === '0_8H')?.count).toBe(1);
    expect(result.oldestTickets[0].ageMinutes).toBe(180);

    jest.useRealTimers();
  });

  it('calculates byTeam MTTA/MTTR and reopen rate', async () => {
    (prisma.team.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'team-a',
        name: 'Time A',
        responsibleTickets: [ticketA, ticketB, ticketC],
      },
    ]);

    (prisma.ticketStatusHistory.findMany as jest.Mock).mockResolvedValue([
      { ticketId: 'ticket-c' },
    ]);

    const result = await enterpriseMetricsService.calculateByTeam(
      {},
      undefined,
      undefined,
      true,
      businessSchedule
    );

    expect(result.items[0].mtta).toBe(100);
    expect(result.items[0].mttr).toBe(180);
    expect(result.items[0].reopenRatePercent).toBe(50);
  });

  it('calculates byTechnician MTTA/MTTR and reopen rate', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'tech-1',
        name: 'Tecnico',
        assignedTickets: [ticketA, ticketB, ticketC],
        teams: [{ team: { id: 'team-a', name: 'Time A' } }],
      },
    ]);

    (prisma.ticketStatusHistory.findMany as jest.Mock).mockResolvedValue([
      { ticketId: 'ticket-c' },
    ]);

    const result = await enterpriseMetricsService.calculateByTechnician(
      {},
      undefined,
      undefined,
      true,
      businessSchedule
    );

    expect(result.items[0].mtta).toBe(100);
    expect(result.items[0].mttr).toBe(180);
    expect(result.items[0].reopenRatePercent).toBe(50);
  });
});
