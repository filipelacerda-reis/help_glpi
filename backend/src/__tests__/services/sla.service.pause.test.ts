import { TicketStatus, SlaInstanceStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import { slaService } from '../../services/sla.service';
import { businessCalendarService } from '../../services/businessCalendar.service';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    ticketSlaStats: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn(),
    },
    ticketStatusHistory: {
      findMany: jest.fn(),
    },
    ticketSlaInstance: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../services/businessCalendar.service', () => ({
  businessCalendarService: {
    getBusinessSchedule: jest.fn(),
  },
}));

jest.mock('../../services/ticketEvent.service', () => ({
  ticketEventService: {
    createEvent: jest.fn(),
  },
}));

describe('slaService recordResolution pause/resume', () => {
  it('calculates elapsed business minutes skipping waiting statuses', async () => {
    const ticketId = 'ticket-1';
    const createdAt = new Date('2024-01-15T12:00:00Z'); // 09:00 local
    const resolvedAt = new Date('2024-01-15T21:00:00Z'); // 18:00 local

    (prisma.ticketSlaStats.findUnique as jest.Mock).mockResolvedValue({
      ticketId,
      slaPolicyId: 'policy-1',
      slaPolicy: {
        calendarId: 'calendar-1',
        targetResolutionBusinessMinutes: 180,
      },
    });

    (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
      id: ticketId,
      createdAt,
    });

    (prisma.ticketStatusHistory.findMany as jest.Mock).mockResolvedValue([
      {
        ticketId,
        oldStatus: TicketStatus.OPEN,
        newStatus: TicketStatus.WAITING_REQUESTER,
        changedAt: new Date('2024-01-15T13:00:00Z'), // 10:00 local
      },
      {
        ticketId,
        oldStatus: TicketStatus.WAITING_REQUESTER,
        newStatus: TicketStatus.IN_PROGRESS,
        changedAt: new Date('2024-01-15T19:00:00Z'), // 16:00 local
      },
      {
        ticketId,
        oldStatus: TicketStatus.IN_PROGRESS,
        newStatus: TicketStatus.RESOLVED,
        changedAt: new Date('2024-01-15T21:00:00Z'), // 18:00 local
      },
    ]);

    (prisma.ticketSlaInstance.findFirst as jest.Mock).mockResolvedValue({
      id: 'instance-1',
      ticketId,
      status: SlaInstanceStatus.RUNNING,
    });

    (prisma.ticketSlaInstance.update as jest.Mock).mockResolvedValue({});
    (prisma.ticketSlaStats.update as jest.Mock).mockResolvedValue({});

    (businessCalendarService.getBusinessSchedule as jest.Mock).mockResolvedValue({
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
    });

    await slaService.recordResolution(ticketId, resolvedAt);

    const updateCall = (prisma.ticketSlaStats.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.businessResolutionTimeMs).toBe(180 * 60 * 1000);
  });
});
