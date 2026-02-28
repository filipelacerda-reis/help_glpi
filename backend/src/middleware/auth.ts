import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UserRole } from '@prisma/client';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { PlatformModule, getEffectiveModules } from '../config/modules';
import { authorizationService } from '../domains/iam/services/authorization.service';
import { requestContextStore } from '../shared/http/requestContext.store';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    const authz = await authorizationService.resolveContext(payload.userId);
    req.userPermissions = authz?.permissions || [];
    req.userEntitlements = authz?.entitlements || [];
    req.userAttributes = authz?.attributes || {};
    req.auth = {
      userId: payload.userId,
      role: payload.role as UserRole,
      permissions: req.userPermissions,
      entitlements: req.userEntitlements,
      attributes: req.userAttributes,
    };

    const authUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { active: true },
    });
    if (!authUser || !authUser.active) {
      logger.warn('Token válido para usuário desativado/inexistente', { userId: payload.userId, path: req.path });
      res.status(401).json({ error: 'Usuário desativado' });
      return;
    }

    requestContextStore.patch({
      userId: payload.userId,
      userEmail: payload.email,
    });

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

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const permissions = req.userPermissions || [];
    if (!permissions.includes(permission)) {
      logger.warn('Acesso negado por permissão', {
        userId: req.userId,
        permission,
        path: req.path,
        method: req.method,
      });
      res.status(403).json({ error: `Permissão insuficiente: ${permission}` });
      return;
    }
    next();
  };
};

export const requireAnyPermission = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const currentPermissions = req.userPermissions || [];
    if (!permissions.some((permission) => currentPermissions.includes(permission))) {
      logger.warn('Acesso negado por permissão (any)', {
        userId: req.userId,
        requiredPermissions: permissions,
        path: req.path,
        method: req.method,
      });
      res.status(403).json({ error: 'Permissões insuficientes' });
      return;
    }
    next();
  };
};

type AbacPolicy = (req: Request) => boolean | Promise<boolean>;

export const requireAbac = (policy: AbacPolicy, errorMessage = 'Acesso negado pela política ABAC') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const allowed = await policy(req);
    if (!allowed) {
      logger.warn('Acesso negado por ABAC', {
        userId: req.userId,
        path: req.path,
        method: req.method,
      });
      res.status(403).json({ error: errorMessage });
      return;
    }
    next();
  };
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

export const requireModuleAccess = (requiredModule: PlatformModule) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId || !req.userRole) {
      logger.warn('Tentativa de acesso sem autenticação (módulo)', { path: req.path, module: requiredModule });
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    if (req.userRole === UserRole.ADMIN) {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        role: true,
        enabledModules: true,
      },
    });

    if (!user) {
      logger.warn('Usuário não encontrado para autorização por módulo', { userId: req.userId, module: requiredModule });
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }

    const effectiveModules = getEffectiveModules(user.role, user.enabledModules);
    req.userEffectiveModules = effectiveModules;

    if (!effectiveModules.includes(requiredModule)) {
      logger.warn('Acesso negado por módulo', {
        userId: req.userId,
        role: user.role,
        module: requiredModule,
        path: req.path,
      });
      res.status(403).json({ error: `Acesso negado ao módulo ${requiredModule}` });
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
