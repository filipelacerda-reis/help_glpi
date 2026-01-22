import { Request, Response } from 'express';
import { metricsService } from '../services/metrics.service';
import { enterpriseMetricsService } from '../services/enterpriseMetrics.service';
import { MetricsFilters } from '../types/metrics.types';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';

export const metricsController = {
  async getMetrics(req: Request, res: Response) {
    try {
      let teamId: string | undefined = undefined;

      if (req.userRole === UserRole.ADMIN) {
        // ADMIN pode ver todas as métricas ou filtrar por teamId
        if (req.query.teamId) {
          teamId = req.query.teamId as string;
        }
      } else {
        // Não é ADMIN - verificar se é líder de time
        const leadTeamIds = req.leadTeamIds || [];
        
        if (leadTeamIds.length === 0) {
          return res.status(403).json({
            error: 'Acesso negado. Métricas disponíveis apenas para Admin ou Líder de Time.'
          });
        }

        // Se houver teamId na query, validar se é líder desse time
        if (req.query.teamId) {
          const requestedTeamId = req.query.teamId as string;
          if (!leadTeamIds.includes(requestedTeamId)) {
            return res.status(403).json({
              error: 'Acesso negado. Você só pode visualizar métricas dos times onde é líder.'
            });
          }
          teamId = requestedTeamId;
        } else {
          // Não há teamId na query
          if (leadTeamIds.length === 1) {
            // Líder de um único time - usar automaticamente
            teamId = leadTeamIds[0];
          } else {
            // Líder de múltiplos times - exigir teamId
            return res.status(400).json({
              error: 'Você é líder de mais de um time, informe o parâmetro teamId para filtrar as métricas.'
            });
          }
        }
      }

      const metrics = await metricsService.getMetrics(teamId ? { teamId } : undefined);
      res.json(metrics);
    } catch (error: any) {
      logger.error('Erro ao calcular métricas', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Erro ao calcular métricas', message: error.message });
    }
  },

  /**
   * Nova rota enterprise para métricas avançadas
   */
  async getEnterpriseMetrics(req: Request, res: Response) {
    try {
      // Parsear query params
      const filters: MetricsFilters = {};

      if (req.query.startDate) {
        filters.startDate = req.query.startDate as string;
      }
      if (req.query.endDate) {
        filters.endDate = req.query.endDate as string;
      }
      
      // Lógica de acesso e filtro por time
      if (req.userRole === UserRole.ADMIN) {
        // ADMIN pode ver todas as métricas ou filtrar por teamId
        if (req.query.teamId) {
          filters.teamId = req.query.teamId as string;
        }
      } else {
        // Não é ADMIN - verificar se é líder de time
        const leadTeamIds = req.leadTeamIds || [];
        
        if (leadTeamIds.length === 0) {
          return res.status(403).json({
            error: 'Acesso negado. Métricas disponíveis apenas para Admin ou Líder de Time.'
          });
        }

        // Se houver teamId na query, validar se é líder desse time
        if (req.query.teamId) {
          const requestedTeamId = req.query.teamId as string;
          if (!leadTeamIds.includes(requestedTeamId)) {
            return res.status(403).json({
              error: 'Acesso negado. Você só pode visualizar métricas dos times onde é líder.'
            });
          }
          filters.teamId = requestedTeamId;
        } else {
          // Não há teamId na query
          if (leadTeamIds.length === 1) {
            // Líder de um único time - usar automaticamente
            filters.teamId = leadTeamIds[0];
          } else {
            // Líder de múltiplos times - exigir teamId
            return res.status(400).json({
              error: 'Você é líder de mais de um time, informe o parâmetro teamId para filtrar as métricas.'
            });
          }
        }
      }
      if (req.query.technicianId) {
        filters.technicianId = req.query.technicianId as string;
      }
      if (req.query.categoryId) {
        filters.categoryId = req.query.categoryId as string;
      }
      if (req.query.tags) {
        const tags = Array.isArray(req.query.tags)
          ? (req.query.tags as string[])
          : [req.query.tags as string];
        filters.tags = tags;
      }
      if (req.query.priority) {
        filters.priority = req.query.priority as string;
      }
      if (req.query.status) {
        const status = Array.isArray(req.query.status)
          ? (req.query.status as string[])
          : [req.query.status as string];
        filters.status = status.length === 1 ? status[0] : status;
      }
      if (req.query.slaStatus) {
        filters.slaStatus = req.query.slaStatus as string;
      }
      if (req.query.businessHours !== undefined) {
        const businessHoursValue = String(req.query.businessHours);
        filters.businessHours = businessHoursValue === 'true' || businessHoursValue === '1';
      }
      if (req.query.comparePreviousPeriod !== undefined) {
        const compareValue = String(req.query.comparePreviousPeriod);
        filters.comparePreviousPeriod = compareValue === 'true' || compareValue === '1';
      }

      // Validar datas
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ error: 'startDate inválida' });
        }
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ error: 'endDate inválida' });
        }
      }

      const metrics = await enterpriseMetricsService.getMetrics(filters);
      res.json(metrics);
    } catch (error: any) {
      logger.error('Erro ao calcular métricas enterprise', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Erro ao calcular métricas', message: error.message });
    }
  },
};

