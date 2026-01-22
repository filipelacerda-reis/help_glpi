import { Request, Response } from 'express';
import { automationService } from '../services/automation.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { AutomationEvent } from '@prisma/client';

const createAutomationRuleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  event: z.nativeEnum(AutomationEvent),
  conditions: z.record(z.any()),
  actions: z.array(z.object({
    type: z.string(),
  }).passthrough()),
});

export const automationController = {
  /**
   * GET /api/automation-rules
   * Lista regras de automação
   */
  async getAllRules(req: Request, res: Response) {
    try {
      const enabledOnly = req.query.enabledOnly === 'true';
      const rules = await automationService.getAllRules(enabledOnly);
      res.json(rules);
    } catch (error: any) {
      logger.error('Erro ao buscar regras de automação', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar regras de automação' });
    }
  },

  /**
   * GET /api/automation-rules/:id
   * Busca regra por ID
   */
  async getRuleById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const rule = await automationService.getRuleById(id);
      res.json(rule);
    } catch (error: any) {
      if (error.statusCode === 404) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('Erro ao buscar regra de automação', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar regra de automação' });
      }
    }
  },

  /**
   * POST /api/automation-rules
   * Cria regra de automação (apenas ADMIN)
   */
  async createRule(req: Request, res: Response) {
    try {
      const data = createAutomationRuleSchema.parse(req.body);
      const rule = await automationService.createRule(data);
      res.status(201).json(rule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao criar regra de automação', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar regra de automação' });
      }
    }
  },

  /**
   * PUT /api/automation-rules/:id
   * Atualiza regra de automação (apenas ADMIN)
   */
  async updateRule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = createAutomationRuleSchema.partial().parse(req.body);
      const rule = await automationService.updateRule(id, data);
      res.json(rule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao atualizar regra de automação', { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar regra de automação' });
      }
    }
  },

  /**
   * DELETE /api/automation-rules/:id
   * Deleta regra de automação (apenas ADMIN)
   */
  async deleteRule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await automationService.deleteRule(id);
      res.status(204).send();
    } catch (error: any) {
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao deletar regra de automação', { error: error.message });
        res.status(500).json({ error: 'Erro ao deletar regra de automação' });
      }
    }
  },
};

