import { TicketStatus, UserRole } from '@prisma/client';
import prisma from '../../lib/prisma';
import { ticketService } from '../../services/ticket.service';
import { businessCalendarService } from '../../services/businessCalendar.service';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    ticket: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ticketRelation: {
      findMany: jest.fn(),
    },
    ticketStatusHistory: {
      create: jest.fn(),
    },
    ticketTag: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    businessCalendarException: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../services/notification.service', () => ({
  notificationService: {
    createStatusChangeNotification: jest.fn(),
    createTeamChangeNotification: jest.fn(),
    createAssignmentNotification: jest.fn(),
  },
}));

jest.mock('../../services/ticketIntegrations.service', () => ({
  recordTicketUpdated: jest.fn(),
}));

jest.mock('../../utils/team.utils', () => ({
  isUserTeamMember: jest.fn(async () => true),
  isUserTeamLead: jest.fn(async () => true),
  getTeamMembers: jest.fn(async () => []),
  getUserTeams: jest.fn(async () => []),
}));

jest.mock('../../services/businessCalendar.service', () => ({
  businessCalendarService: {
    getDefaultCalendar: jest.fn(),
  },
}));

describe('ticketService business minutes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T15:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('sets resolutionBusinessMinutes using the default business schedule', async () => {
    const mockTicket = {
      id: 'ticket-1',
      createdAt: new Date('2024-01-15T12:00:00Z'),
      resolvedAt: null,
      closedAt: null,
      status: TicketStatus.OPEN,
      requesterId: 'requester-1',
      assignedTechnicianId: null,
      teamId: 'team-1',
      priority: null,
      categoryId: null,
      tipo: null,
      infraTipo: null,
      teamSolicitanteId: null,
    };

    (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
    (prisma.ticketRelation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.ticketStatusHistory.create as jest.Mock).mockResolvedValue({});
    (prisma.ticket.update as jest.Mock).mockResolvedValue({
      ...mockTicket,
      status: TicketStatus.RESOLVED,
      assignedTechnicianId: null,
    });
    (prisma.ticketTag.deleteMany as jest.Mock).mockResolvedValue({});
    (prisma.ticketTag.createMany as jest.Mock).mockResolvedValue({});
    (prisma.businessCalendarException.findMany as jest.Mock).mockResolvedValue([]);

    (businessCalendarService.getDefaultCalendar as jest.Mock).mockResolvedValue({
      id: 'calendar-1',
      timezone: 'America/Sao_Paulo',
      schedule: {
        monday: { open: '09:00', close: '18:00', enabled: true },
        tuesday: { open: '09:00', close: '18:00', enabled: true },
        wednesday: { open: '09:00', close: '18:00', enabled: true },
        thursday: { open: '09:00', close: '18:00', enabled: true },
        friday: { open: '09:00', close: '18:00', enabled: true },
        saturday: { open: '09:00', close: '18:00', enabled: false },
        sunday: { open: '09:00', close: '18:00', enabled: false },
      },
    });

    await ticketService.updateTicket('ticket-1', 'admin-1', UserRole.ADMIN, {
      status: TicketStatus.RESOLVED,
    });

    const updateCall = (prisma.ticket.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.resolutionBusinessMinutes).toBe(180);
  });
});
