import { Request, Response } from 'express';
import { ticketRelationService } from '../services/ticketRelation.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const createRelationSchema = z.object({
  relatedTicketId: z.string().uuid('ID do ticket relacionado inválido'),
  relationType: z.enum(['DUPLICATE_OF', 'CHILD_OF', 'PARENT_OF', 'CAUSED_BY', 'BLOCKED_BY']),
});

export const ticketRelationController = {
  /**
   * POST /api/tickets/:ticketId/relations
   * Cria uma relação entre tickets
   */
  async createRelation(req: Request, res: Response) {
    try {
      const { ticketId } = req.params;
      const userId = (req as any).user?.id;
      const data = createRelationSchema.parse(req.body);

      const relation = await ticketRelationService.createRelation(ticketId, data, userId);
      res.status(201).json(relation);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao criar relação de ticket', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar relação de ticket' });
      }
    }
  },

  /**
   * GET /api/tickets/:ticketId/relations
   * Lista relações de um ticket
   */
  async getTicketRelations(req: Request, res: Response) {
    try {
      const { ticketId } = req.params;
      const relations = await ticketRelationService.getTicketRelations(ticketId);
      res.json(relations);
    } catch (error: any) {
      logger.error('Erro ao buscar relações de ticket', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar relações de ticket' });
    }
  },

  /**
   * DELETE /api/tickets/:ticketId/relations/:relatedTicketId
   * Remove uma relação
   */
  async removeRelation(req: Request, res: Response) {
    try {
      const { ticketId, relatedTicketId } = req.params;
      const relationType = req.query.type as string;
      const userId = (req as any).user?.id;

      if (!relationType) {
        return res.status(400).json({ error: 'Tipo de relação é obrigatório' });
      }

      await ticketRelationService.removeRelation(
        ticketId,
        relatedTicketId,
        relationType as any,
        userId
      );
      return res.status(204).send();
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao remover relação de ticket', { error: error.message });
        return res.status(500).json({ error: 'Erro ao remover relação de ticket' });
      }
    }
  },
};

