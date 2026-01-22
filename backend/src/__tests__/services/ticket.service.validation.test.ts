import { TicketStatus, UserRole } from '@prisma/client';
import prisma from '../../lib/prisma';
import { ticketService } from '../../services/ticket.service';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    team: {
      findUnique: jest.fn(),
    },
    teamCategory: {
      findMany: jest.fn(),
    },
    teamTicketType: {
      findMany: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    ticketRelation: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../utils/team.utils', () => ({
  isUserTeamMember: jest.fn(async () => true),
  isUserTeamLead: jest.fn(async () => true),
  getTeamMembers: jest.fn(async () => []),
  getUserTeams: jest.fn(async () => []),
}));

jest.mock('../../services/notification.service', () => ({
  notificationService: {
    createTeamChangeNotification: jest.fn(),
    createAssignmentNotification: jest.fn(),
    createStatusChangeNotification: jest.fn(),
  },
}));

describe('ticketService validations', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects ticket creation with category not allowed for team', async () => {
    (prisma.team.findUnique as jest.Mock).mockResolvedValue({
      id: 'team-1',
      users: [{ userId: 'user-1' }],
    });
    (prisma.teamCategory.findMany as jest.Mock).mockResolvedValue([
      { categoryId: 'cat-allowed' },
    ]);
    (prisma.teamTicketType.findMany as jest.Mock).mockResolvedValue([]);

    await expect(
      ticketService.createTicket('user-1', {
        title: 'Teste',
        description: 'Descricao longa',
        teamId: 'team-1',
        categoryId: 'cat-invalid',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects team change when category becomes invalid', async () => {
    (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
      id: 'ticket-1',
      requesterId: 'user-1',
      teamId: 'team-old',
      categoryId: 'cat-invalid',
      tipo: null,
      assignedTechnicianId: null,
      status: TicketStatus.OPEN,
    });
    (prisma.team.findUnique as jest.Mock).mockResolvedValue({
      id: 'team-new',
    });
    (prisma.teamCategory.findMany as jest.Mock).mockResolvedValue([
      { categoryId: 'cat-allowed' },
    ]);
    (prisma.teamTicketType.findMany as jest.Mock).mockResolvedValue([]);

    await expect(
      ticketService.updateTicket('ticket-1', 'admin-1', UserRole.ADMIN, {
        teamId: 'team-new',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects closing a parent ticket with open children', async () => {
    (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
      id: 'ticket-1',
      requesterId: 'user-1',
      teamId: 'team-1',
      assignedTechnicianId: null,
      status: TicketStatus.OPEN,
    });
    (prisma.teamCategory.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.teamTicketType.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.ticketRelation.findMany as jest.Mock).mockResolvedValue([
      {
        relatedTicket: {
          id: 'child-1',
          title: 'Child',
          status: TicketStatus.OPEN,
        },
      },
    ]);

    await expect(
      ticketService.updateTicket('ticket-1', 'admin-1', UserRole.ADMIN, {
        status: TicketStatus.RESOLVED,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
