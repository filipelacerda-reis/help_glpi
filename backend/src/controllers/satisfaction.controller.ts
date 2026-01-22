import { Request, Response } from 'express';
import { satisfactionService } from '../services/satisfaction.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const createSatisfactionSchema = z.object({
  score: z.number().int().min(1).max(5, 'Score deve estar entre 1 e 5'),
  comment: z.string().optional(),
});

export const satisfactionController = {
  /**
   * POST /api/tickets/:ticketId/satisfaction
   * Cria ou atualiza avaliação de satisfação
   */
  async createOrUpdateSatisfaction(req: Request, res: Response) {
    try {
      const { ticketId } = req.params;
      const userId = (req as any).user?.id;
      const data = createSatisfactionSchema.parse(req.body);

      const satisfaction = await satisfactionService.createOrUpdateSatisfaction(ticketId, userId, data);
      return res.json(satisfaction);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao criar avaliação de satisfação', { error: error.message });
        return res.status(500).json({ error: 'Erro ao criar avaliação de satisfação' });
      }
    }
  },

  /**
   * GET /api/tickets/:ticketId/satisfaction
   * Busca avaliação de um ticket
   */
  async getTicketSatisfaction(req: Request, res: Response) {
    try {
      const { ticketId } = req.params;
      const satisfaction = await satisfactionService.getTicketSatisfaction(ticketId);
      
      if (!satisfaction) {
        return res.status(404).json({ error: 'Avaliação não encontrada' });
      }

      res.json(satisfaction);
    } catch (error: any) {
      logger.error('Erro ao buscar avaliação de satisfação', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar avaliação de satisfação' });
    }
  },
};

