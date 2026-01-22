import { Request, Response } from 'express';
import { worklogService } from '../services/worklog.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const createWorklogSchema = z.object({
  durationMinutes: z.number().int().positive('Duração deve ser um número positivo'),
  description: z.string().optional(),
});

export const worklogController = {
  /**
   * POST /api/tickets/:ticketId/worklogs
   * Cria um worklog
   */
  async createWorklog(req: Request, res: Response) {
    try {
      const { ticketId } = req.params;
      const userId = req.userId!;
      const data = createWorklogSchema.parse(req.body);

      const worklog = await worklogService.createWorklog(ticketId, userId, data);
      res.status(201).json(worklog);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao criar worklog', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar worklog' });
      }
    }
  },

  /**
   * GET /api/tickets/:ticketId/worklogs
   * Lista worklogs de um ticket
   */
  async getTicketWorklogs(req: Request, res: Response) {
    try {
      const { ticketId } = req.params;
      const worklogs = await worklogService.getTicketWorklogs(ticketId);
      res.json(worklogs);
    } catch (error: any) {
      logger.error('Erro ao buscar worklogs', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar worklogs' });
    }
  },
};

