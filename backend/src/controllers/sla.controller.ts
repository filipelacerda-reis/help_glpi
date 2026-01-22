import { Request, Response } from 'express';
import { slaService } from '../services/sla.service';
import { businessCalendarService } from '../services/businessCalendar.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const createSlaPolicySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  appliesTo: z.object({
    teamId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    priority: z.string().optional(),
    ticketType: z.string().optional(),
    requesterTeamId: z.string().uuid().optional(),
  }),
  targetFirstResponseBusinessMinutes: z.number().int().positive().optional(),
  targetResolutionBusinessMinutes: z.number().int().positive('Tempo de resolução é obrigatório'),
  calendarId: z.string().uuid('ID do calendário inválido'),
  active: z.boolean().optional(),
});

export const slaController = {
  /**
   * GET /api/sla/policies
   * Lista políticas de SLA
   */
  async getAllPolicies(req: Request, res: Response) {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const policies = await slaService.getAllPolicies(activeOnly);
      res.json(policies);
    } catch (error: any) {
      logger.error('Erro ao buscar políticas de SLA', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar políticas de SLA' });
    }
  },

  /**
   * GET /api/sla/policies/:id
   * Busca política por ID
   */
  async getPolicyById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const policy = await slaService.getPolicyById(id);
      res.json(policy);
    } catch (error: any) {
      if (error.statusCode === 404) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('Erro ao buscar política de SLA', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar política de SLA' });
      }
    }
  },

  /**
   * POST /api/sla/policies
   * Cria política de SLA (apenas ADMIN)
   */
  async createPolicy(req: Request, res: Response) {
    try {
      const data = createSlaPolicySchema.parse(req.body);
      const policy = await slaService.createPolicy(data);
      res.status(201).json(policy);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao criar política de SLA', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar política de SLA' });
      }
    }
  },

  /**
   * PUT /api/sla/policies/:id
   * Atualiza política de SLA (apenas ADMIN)
   */
  async updatePolicy(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = createSlaPolicySchema.partial().parse(req.body);
      const policy = await slaService.updatePolicy(id, data);
      res.json(policy);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao atualizar política de SLA', { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar política de SLA' });
      }
    }
  },

  /**
   * DELETE /api/sla/policies/:id
   * Remove política de SLA (apenas ADMIN)
   */
  async deletePolicy(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await slaService.deletePolicy(id);
      res.status(204).send();
    } catch (error: any) {
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao excluir política de SLA', { error: error.message });
        res.status(500).json({ error: 'Erro ao excluir política de SLA' });
      }
    }
  },
};

export const businessCalendarController = {
  /**
   * GET /api/sla/calendars
   * Lista calendários de negócio
   */
  async getAllCalendars(_req: Request, res: Response) {
    try {
      const calendars = await businessCalendarService.getAllCalendars();
      res.json(calendars);
    } catch (error: any) {
      logger.error('Erro ao buscar calendários', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar calendários' });
    }
  },

  /**
   * GET /api/sla/calendars/:id
   * Busca calendário por ID
   */
  async getCalendarById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const calendar = await businessCalendarService.getCalendarById(id);
      res.json(calendar);
    } catch (error: any) {
      if (error.statusCode === 404) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('Erro ao buscar calendário', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar calendário' });
      }
    }
  },

  /**
   * POST /api/sla/calendars
   * Cria calendário (apenas ADMIN)
   */
  async createCalendar(req: Request, res: Response) {
    try {
      const calendar = await businessCalendarService.createCalendar(req.body);
      res.status(201).json(calendar);
    } catch (error: any) {
      logger.error('Erro ao criar calendário', { error: error.message });
      res.status(500).json({ error: 'Erro ao criar calendário' });
    }
  },

  /**
   * PUT /api/sla/calendars/:id
   * Atualiza calendário (apenas ADMIN)
   */
  async updateCalendar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const calendar = await businessCalendarService.updateCalendar(id, req.body);
      res.json(calendar);
    } catch (error: any) {
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao atualizar calendário', { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar calendário' });
      }
    }
  },
};
