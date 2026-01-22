import { Request, Response } from 'express';
import { advancedMetricsService } from '../services/advancedMetrics.service';
import { TicketType, UserRole } from '@prisma/client';
import { logger } from '../utils/logger';

export const advancedMetricsController = {
  async getTicketSummary(req: Request, res: Response) {
    try {
      const filters: any = {};

      if (req.query.from) {
        filters.from = new Date(req.query.from as string);
      }
      if (req.query.to) {
        filters.to = new Date(req.query.to as string);
      }
      if (req.query.tipo) {
        filters.tipo = req.query.tipo as TicketType;
      }
      
      // Lógica de acesso e filtro por time
      if (req.userRole === UserRole.ADMIN) {
        // ADMIN pode ver todas as métricas ou filtrar por teamResponsavelId
        if (req.query.teamResponsavelId) {
          filters.teamResponsavelId = req.query.teamResponsavelId as string;
        }
      } else {
        // Não é ADMIN - verificar se é líder de time
        const leadTeamIds = req.leadTeamIds || [];
        
        if (leadTeamIds.length === 0) {
          return res.status(403).json({
            error: 'Acesso negado. Métricas disponíveis apenas para Admin ou Líder de Time.'
          });
        }

        // Se houver teamResponsavelId na query, validar se é líder desse time
        if (req.query.teamResponsavelId) {
          const requestedTeamId = req.query.teamResponsavelId as string;
          if (!leadTeamIds.includes(requestedTeamId)) {
            return res.status(403).json({
              error: 'Acesso negado. Você só pode visualizar métricas dos times onde é líder.'
            });
          }
          filters.teamResponsavelId = requestedTeamId;
        } else {
          // Não há teamResponsavelId na query
          if (leadTeamIds.length === 1) {
            // Líder de um único time - usar automaticamente
            filters.teamResponsavelId = leadTeamIds[0];
          } else {
            // Líder de múltiplos times - exigir teamResponsavelId
            return res.status(400).json({
              error: 'Você é líder de mais de um time, informe o parâmetro teamResponsavelId para filtrar as métricas.'
            });
          }
        }
      }
      if (req.query.teamSolicitanteId) {
        filters.teamSolicitanteId = req.query.teamSolicitanteId as string;
      }
      if (req.query.categoryId) {
        filters.categoryId = req.query.categoryId as string;
      }
      if (req.query.featureTag) {
        filters.featureTag = req.query.featureTag as string;
      }
      if (req.query.infraTag) {
        filters.infraTag = req.query.infraTag as string;
      }
      if (req.query.rcTag) {
        filters.rcTag = req.query.rcTag as string;
      }

      const metrics = await advancedMetricsService.getTicketSummary(filters);
      res.json(metrics);
    } catch (error: any) {
      logger.error('Erro ao calcular métricas avançadas', { error: error.message });
      res.status(500).json({ error: 'Erro ao calcular métricas' });
    }
  },

  async getExpandedMetrics(req: Request, res: Response) {
    try {
      const filters: any = {};

      if (req.query.from) {
        filters.from = new Date(req.query.from as string);
      }
      if (req.query.to) {
        filters.to = new Date(req.query.to as string);
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
      if (req.query.agentId) {
        filters.agentId = req.query.agentId as string;
      }
      if (req.query.categoryId) {
        filters.categoryId = req.query.categoryId as string;
      }
      if (req.query.priority) {
        filters.priority = req.query.priority as string;
      }
      if (req.query.status) {
        filters.status = req.query.status as string;
      }
      if (req.query.requesterTeamId) {
        filters.requesterTeamId = req.query.requesterTeamId as string;
      }

      const metrics = await advancedMetricsService.getExpandedMetrics(filters);
      res.json(metrics);
    } catch (error: any) {
      logger.error('Erro ao calcular métricas expandidas', { error: error.message });
      res.status(500).json({ error: 'Erro ao calcular métricas expandidas' });
    }
  },
};

