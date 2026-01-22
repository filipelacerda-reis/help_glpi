import { Request, Response } from 'express';
import { ticketEventService } from '../services/ticketEvent.service';
import { logger } from '../utils/logger';
import { TicketEventType } from '@prisma/client';

export const ticketEventController = {
  /**
   * GET /api/tickets/:ticketId/events
   * Lista eventos de um ticket
   */
  async getTicketEvents(req: Request, res: Response) {
    try {
      const { ticketId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const eventType = req.query.eventType as TicketEventType | undefined;

      const result = await ticketEventService.getTicketEvents(ticketId, {
        page,
        pageSize,
        eventType,
      });

      res.json(result);
    } catch (error: any) {
      logger.error('Erro ao buscar eventos de ticket', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar eventos de ticket' });
    }
  },
};

