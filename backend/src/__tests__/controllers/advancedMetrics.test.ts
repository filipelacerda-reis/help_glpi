import { Request, Response } from 'express';
import { advancedMetricsController } from '../../controllers/advancedMetrics.controller';
import { advancedMetricsService } from '../../services/advancedMetrics.service';
import { UserRole } from '@prisma/client';

// Mock do serviço
jest.mock('../../services/advancedMetrics.service');
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AdvancedMetricsController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      query: {},
      userId: 'test-user-id',
      userRole: UserRole.ADMIN,
    };

    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };

    jest.clearAllMocks();
  });

  describe('getTicketSummary', () => {
    it('deve retornar métricas sem filtros', async () => {
      const mockMetrics = {
        ticketsByStatus: [],
        ticketsByPriority: [],
        ticketsByTeam: [],
        avgResolutionTimeByTeam: [],
      };

      (advancedMetricsService.getTicketSummary as jest.Mock).mockResolvedValue(mockMetrics);

      await advancedMetricsController.getTicketSummary(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(advancedMetricsService.getTicketSummary).toHaveBeenCalledWith({});
      expect(jsonMock).toHaveBeenCalledWith(mockMetrics);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('deve aplicar filtro de data from', async () => {
      const fromDate = '2024-01-01';
      mockRequest.query = { from: fromDate };

      const mockMetrics = {
        ticketsByStatus: [],
        ticketsByPriority: [],
        ticketsByTeam: [],
        avgResolutionTimeByTeam: [],
      };

      (advancedMetricsService.getTicketSummary as jest.Mock).mockResolvedValue(mockMetrics);

      await advancedMetricsController.getTicketSummary(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(advancedMetricsService.getTicketSummary).toHaveBeenCalledWith({
        from: new Date(fromDate),
      });
      expect(jsonMock).toHaveBeenCalledWith(mockMetrics);
    });

    it('deve aplicar filtro de data to', async () => {
      const toDate = '2024-12-31';
      mockRequest.query = { to: toDate };

      const mockMetrics = {
        ticketsByStatus: [],
        ticketsByPriority: [],
        ticketsByTeam: [],
        avgResolutionTimeByTeam: [],
      };

      (advancedMetricsService.getTicketSummary as jest.Mock).mockResolvedValue(mockMetrics);

      await advancedMetricsController.getTicketSummary(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(advancedMetricsService.getTicketSummary).toHaveBeenCalledWith({
        to: new Date(toDate),
      });
      expect(jsonMock).toHaveBeenCalledWith(mockMetrics);
    });

    it('deve aplicar filtro de tipo', async () => {
      mockRequest.query = { tipo: 'INCIDENT' };

      const mockMetrics = {
        ticketsByStatus: [],
        ticketsByPriority: [],
        ticketsByTeam: [],
        avgResolutionTimeByTeam: [],
      };

      (advancedMetricsService.getTicketSummary as jest.Mock).mockResolvedValue(mockMetrics);

      await advancedMetricsController.getTicketSummary(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(advancedMetricsService.getTicketSummary).toHaveBeenCalledWith({
        tipo: 'INCIDENT',
      });
      expect(jsonMock).toHaveBeenCalledWith(mockMetrics);
    });

    it('deve aplicar múltiplos filtros', async () => {
      mockRequest.query = {
        from: '2024-01-01',
        to: '2024-12-31',
        tipo: 'INCIDENT',
        teamResponsavelId: 'team-123',
        categoryId: 'cat-456',
      };

      const mockMetrics = {
        ticketsByStatus: [],
        ticketsByPriority: [],
        ticketsByTeam: [],
        avgResolutionTimeByTeam: [],
      };

      (advancedMetricsService.getTicketSummary as jest.Mock).mockResolvedValue(mockMetrics);

      await advancedMetricsController.getTicketSummary(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(advancedMetricsService.getTicketSummary).toHaveBeenCalledWith({
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31'),
        tipo: 'INCIDENT',
        teamResponsavelId: 'team-123',
        categoryId: 'cat-456',
      });
      expect(jsonMock).toHaveBeenCalledWith(mockMetrics);
    });

    it('deve aplicar filtros de tags', async () => {
      mockRequest.query = {
        featureTag: 'tag-feature-123',
        infraTag: 'tag-infra-456',
        rcTag: 'tag-rc-789',
      };

      const mockMetrics = {
        ticketsByStatus: [],
        ticketsByPriority: [],
        ticketsByTeam: [],
        avgResolutionTimeByTeam: [],
      };

      (advancedMetricsService.getTicketSummary as jest.Mock).mockResolvedValue(mockMetrics);

      await advancedMetricsController.getTicketSummary(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(advancedMetricsService.getTicketSummary).toHaveBeenCalledWith({
        featureTag: 'tag-feature-123',
        infraTag: 'tag-infra-456',
        rcTag: 'tag-rc-789',
      });
      expect(jsonMock).toHaveBeenCalledWith(mockMetrics);
    });

    it('deve retornar erro 500 quando o serviço falhar', async () => {
      const errorMessage = 'Erro ao calcular métricas';
      (advancedMetricsService.getTicketSummary as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      await advancedMetricsController.getTicketSummary(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Erro ao calcular métricas' });
    });
  });
});

