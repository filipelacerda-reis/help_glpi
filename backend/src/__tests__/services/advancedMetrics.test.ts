import { advancedMetricsService } from '../../services/advancedMetrics.service';
import prisma from '../../lib/prisma';
import { TicketType } from '@prisma/client';

// Mock do Prisma
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    ticket: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    ticketTag: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    ticketInteraction: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    category: {
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

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AdvancedMetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTicketSummary', () => {
    it('deve retornar estrutura completa de métricas', async () => {
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await advancedMetricsService.getTicketSummary();

      expect(result).toHaveProperty('ticketsByType');
      expect(result).toHaveProperty('ticketsByCategory');
      expect(result).toHaveProperty('topFeatureTags');
      expect(result).toHaveProperty('topInfraTags');
      expect(result).toHaveProperty('topRcTags');
      expect(result).toHaveProperty('topQuestionTags');
      expect(result).toHaveProperty('questionsByTag');
      expect(result).toHaveProperty('questionsByTeam');
      expect(result).toHaveProperty('mttr');
      expect(result).toHaveProperty('avgFirstResponse');
      expect(result).toHaveProperty('ticketsByRequesterTeam');
      expect(result).toHaveProperty('interactionsByTeam');
      expect(result).toHaveProperty('interactionsByAuthor');
    });

    it('deve aplicar filtro de data from', async () => {
      const fromDate = new Date('2024-01-01');
      
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await advancedMetricsService.getTicketSummary({ from: fromDate });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: fromDate,
            }),
          }),
        })
      );
    });

    it('deve aplicar filtro de data to', async () => {
      const toDate = new Date('2024-12-31');
      
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await advancedMetricsService.getTicketSummary({ to: toDate });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              lte: toDate,
            }),
          }),
        })
      );
    });

    it('deve aplicar filtro de tipo', async () => {
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await advancedMetricsService.getTicketSummary({ tipo: TicketType.INCIDENT });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tipo: TicketType.INCIDENT,
          }),
        })
      );
    });

    it('deve aplicar filtro de teamResponsavelId', async () => {
      const teamId = 'team-123';
      
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await advancedMetricsService.getTicketSummary({ teamResponsavelId: teamId });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            teamId: teamId,
          }),
        })
      );
    });

    it('deve calcular tickets por tipo corretamente', async () => {
      const mockGroupByResult = [
        { tipo: TicketType.INCIDENT, _count: { _all: 10 } },
        { tipo: TicketType.SERVICE_REQUEST, _count: { _all: 5 } },
        { tipo: TicketType.QUESTION, _count: { _all: 3 } },
      ];

      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue(mockGroupByResult);
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await advancedMetricsService.getTicketSummary();

      expect(prisma.ticket.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['tipo'],
        })
      );
      expect(result.ticketsByType).toBeDefined();
      expect(Array.isArray(result.ticketsByType)).toBe(true);
    });

    it('deve calcular tickets por categoria corretamente', async () => {
      const mockGroupByResult = [
        { categoryId: 'cat-1', _count: { _all: 8 } },
        { categoryId: 'cat-2', _count: { _all: 12 } },
        { categoryId: null, _count: { _all: 4 } },
      ];

      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue(mockGroupByResult);
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await advancedMetricsService.getTicketSummary();

      expect(prisma.ticket.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['categoryId'],
        })
      );
      expect(result.ticketsByCategory).toBeDefined();
      expect(Array.isArray(result.ticketsByCategory)).toBe(true);
    });

    it('deve aplicar filtro de featureTag', async () => {
      const featureTagId = 'tag-feature-123';
      
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketTag.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticketInteraction.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await advancedMetricsService.getTicketSummary({ featureTag: featureTagId });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: expect.objectContaining({
              some: expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    tagId: featureTagId,
                  }),
                ]),
              }),
            }),
          }),
        })
      );
    });
  });
});

