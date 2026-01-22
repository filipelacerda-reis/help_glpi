import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UserRole } from '@prisma/client';
import { logger } from '../utils/logger';

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Tentativa de acesso sem token', { path: req.path, method: req.method });
      res.status(401).json({ error: 'Token não fornecido' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    req.userId = payload.userId;
    req.userRole = payload.role as UserRole;

    logger.debug('Autenticação bem-sucedida', {
      userId: payload.userId,
      role: payload.role,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.warn('Falha na autenticação', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
    });
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      logger.warn('Tentativa de acesso sem autenticação', { path: req.path });
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    if (!roles.includes(req.userRole)) {
      logger.warn('Tentativa de acesso com papel insuficiente', {
        userId: req.userId,
        userRole: req.userRole,
        requiredRoles: roles,
        path: req.path,
      });
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    next();
  };
};

export const requireAdmin = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    if (req.userRole !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    next();
  };
};

/**
 * Middleware que permite acesso a ADMIN ou líderes de time
 * Para líderes de time, adiciona os IDs dos times onde são líderes ao req.leadTeamIds
 */
export const authorizeAdminOrTeamLead = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userRole || !req.userId) {
      logger.warn('Tentativa de acesso sem autenticação', { path: req.path });
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    // ADMIN tem acesso total
    if (req.userRole === UserRole.ADMIN) {
      next();
      return;
    }

    // Verificar se é líder de algum time
    const { getUserLeadTeams } = await import('../utils/team.utils');
    const leadTeamIds = await getUserLeadTeams(req.userId);

    if (leadTeamIds.length === 0) {
      logger.warn('Tentativa de acesso sem permissão (não é ADMIN nem líder de time)', {
        userId: req.userId,
        userRole: req.userRole,
        path: req.path,
      });
      res.status(403).json({ error: 'Acesso negado. Apenas administradores ou líderes de time podem acessar esta funcionalidade.' });
      return;
    }

    // Adicionar os IDs dos times ao request para uso nos controllers
    (req as any).leadTeamIds = leadTeamIds;
    next();
  };
};

