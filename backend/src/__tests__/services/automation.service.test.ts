import { AutomationEvent, TicketPriority, TicketStatus, UserRole } from '@prisma/client';
import axios from 'axios';
import prisma from '../../lib/prisma';
import { automationService } from '../../services/automation.service';
import { ticketEventService } from '../../services/ticketEvent.service';
import { ticketService } from '../../services/ticket.service';

jest.mock('axios');

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    automationRule: {
      findMany: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../services/ticketEvent.service', () => ({
  ticketEventService: {
    createEvent: jest.fn(),
  },
}));

jest.mock('../../services/ticket.service', () => ({
  ticketService: {
    updateTicket: jest.fn(),
  },
}));

describe('automationService.processAutomations', () => {
  const ticket = {
    id: 'ticket-1',
    status: TicketStatus.OPEN,
    priority: TicketPriority.MEDIUM,
    teamId: 'team-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips rules when conditions do not match', async () => {
    (prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rule-1',
        name: 'Rule mismatch',
        event: AutomationEvent.ON_TICKET_CREATED,
        enabled: true,
        conditions: { priority: TicketPriority.HIGH },
        actions: [{ type: 'SET_STATUS', status: TicketStatus.IN_PROGRESS }],
      },
    ]);

    const results = await automationService.processAutomations(
      AutomationEvent.ON_TICKET_CREATED,
      ticket
    );

    expect(results).toHaveLength(0);
    expect(ticketService.updateTicket).not.toHaveBeenCalled();
    expect(ticketEventService.createEvent).not.toHaveBeenCalled();
  });

  it('executes SET_TEAM, SET_PRIORITY, SET_STATUS, ASSIGN_TO_TECHNICIAN actions', async () => {
    (prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rule-2',
        name: 'Rule update',
        event: AutomationEvent.ON_TICKET_UPDATED,
        enabled: true,
        conditions: { status: TicketStatus.OPEN },
        actions: [
          { type: 'SET_TEAM', teamId: 'team-2' },
          { type: 'SET_PRIORITY', priority: TicketPriority.HIGH },
          { type: 'SET_STATUS', status: TicketStatus.IN_PROGRESS },
          { type: 'ASSIGN_TO_TECHNICIAN', technicianId: 'tech-1' },
        ],
      },
    ]);

    const results = await automationService.processAutomations(
      AutomationEvent.ON_TICKET_UPDATED,
      ticket
    );

    expect(ticketService.updateTicket).toHaveBeenCalledTimes(4);
    expect(ticketService.updateTicket).toHaveBeenNthCalledWith(1, 'ticket-1', 'SYSTEM', UserRole.ADMIN, {
      teamId: 'team-2',
    });
    expect(ticketService.updateTicket).toHaveBeenNthCalledWith(2, 'ticket-1', 'SYSTEM', UserRole.ADMIN, {
      priority: TicketPriority.HIGH,
    });
    expect(ticketService.updateTicket).toHaveBeenNthCalledWith(3, 'ticket-1', 'SYSTEM', UserRole.ADMIN, {
      status: TicketStatus.IN_PROGRESS,
    });
    expect(ticketService.updateTicket).toHaveBeenNthCalledWith(4, 'ticket-1', 'SYSTEM', UserRole.ADMIN, {
      assignedTechnicianId: 'tech-1',
    });

    expect(results[0].triggered).toBe(true);
    expect(ticketEventService.createEvent).toHaveBeenCalledTimes(1);
  });

  it('handles ADD_TAG and TRIGGER_SLA as no-op success', async () => {
    (prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rule-3',
        name: 'Rule noop',
        event: AutomationEvent.ON_TICKET_CREATED,
        enabled: true,
        conditions: {},
        actions: [{ type: 'ADD_TAG', tagId: 'tag-1' }, { type: 'TRIGGER_SLA' }],
      },
    ]);

    const results = await automationService.processAutomations(
      AutomationEvent.ON_TICKET_CREATED,
      ticket
    );

    expect(results[0].actionResults).toHaveLength(2);
    expect(results[0].actionResults[0].success).toBe(true);
    expect(results[0].actionResults[1].success).toBe(true);
  });

  it('calls webhook when configured', async () => {
    (prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rule-4',
        name: 'Rule webhook',
        event: AutomationEvent.ON_COMMENT_ADDED,
        enabled: true,
        conditions: {},
        actions: [{ type: 'CALL_WEBHOOK', url: 'https://example.com/webhook' }],
      },
    ]);

    (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
      id: 'ticket-1',
      requester: { id: 'req-1', name: 'Req', email: 'req@seed.local' },
      assignedTechnician: null,
      category: null,
      team: null,
      tags: [],
    });

    (axios as jest.MockedFunction<typeof axios>).mockResolvedValue({ status: 200 } as any);

    const results = await automationService.processAutomations(
      AutomationEvent.ON_COMMENT_ADDED,
      ticket
    );

    expect(axios).toHaveBeenCalled();
    expect(results[0].actionResults[0].success).toBe(true);
  });

  it('captures webhook error', async () => {
    (prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rule-5',
        name: 'Rule webhook fail',
        event: AutomationEvent.ON_COMMENT_ADDED,
        enabled: true,
        conditions: {},
        actions: [{ type: 'CALL_WEBHOOK', url: 'https://example.com/webhook' }],
      },
    ]);

    (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
      id: 'ticket-1',
      requester: { id: 'req-1', name: 'Req', email: 'req@seed.local' },
      assignedTechnician: null,
      category: null,
      team: null,
      tags: [],
    });

    (axios as jest.MockedFunction<typeof axios>).mockRejectedValue(new Error('timeout'));

    const results = await automationService.processAutomations(
      AutomationEvent.ON_COMMENT_ADDED,
      ticket
    );

    expect(results[0].actionResults[0].success).toBe(false);
    expect(results[0].actionResults[0].error).toBe('timeout');
  });
});
