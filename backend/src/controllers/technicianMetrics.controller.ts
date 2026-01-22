import { Request, Response } from 'express';
import { enterpriseMetricsService } from '../services/enterpriseMetrics.service';
import { logger } from '../utils/logger';

export const technicianMetricsController = {
  /**
   * GET /api/me/metrics
   * Retorna métricas pessoais do técnico autenticado
   */
  async getMyMetrics(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;
      const businessHours = req.query.businessHours === 'true';

      const metrics = await enterpriseMetricsService.getTechnicianMetrics(req.userId, {
        from,
        to,
        businessHours,
      });

      res.json(metrics);
    } catch (error: any) {
      logger.error('Erro ao buscar métricas pessoais', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar métricas' });
    }
  },
};

