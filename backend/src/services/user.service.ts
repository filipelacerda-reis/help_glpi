import { AccessLevel, ModuleKey, SubmoduleKey, UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { hashPassword } from '../utils/password';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { getDefaultModulesByRole, getEffectiveModules, PlatformModule, sanitizeModules } from '../config/modules';
import { authorizationService } from '../domains/iam/services/authorization.service';

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department?: string;
  enabledModules?: string[];
  entitlements?: Array<{
    module: ModuleKey;
    submodule: SubmoduleKey;
    level: AccessLevel;
  }>;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  department?: string | null;
  active?: boolean;
  enabledModules?: string[];
  entitlements?: Array<{
    module: ModuleKey;
    submodule: SubmoduleKey;
    level: AccessLevel;
  }>;
}

function selectUserFields() {
  return {
    id: true,
    name: true,
    email: true,
    role: true,
    department: true,
    active: true,
    enabledModules: true,
    entitlements: {
      select: {
        module: true,
        submodule: true,
        level: true,
      },
    },
    createdAt: true,
    updatedAt: true,
  };
}

function withEffectiveModules<T extends { role: UserRole; enabledModules: string[] }>(user: T) {
  return {
    ...user,
    effectiveModules: getEffectiveModules(user.role, user.enabledModules),
  };
}

export const userService = {
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: selectUserFields(),
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    const authz = await authorizationService.resolveContext(userId);
    return {
      ...withEffectiveModules(user),
      effectivePermissions: authz?.permissions || [],
      entitlements: authz?.entitlements || [],
      attributes: authz?.attributes || {},
    };
  },

  async getAllUsers(filters?: { role?: UserRole; department?: string }) {
    const users = await prisma.user.findMany({
      where: filters,
      select: selectUserFields(),
      orderBy: { createdAt: 'desc' },
    });
    return users.map(withEffectiveModules);
  },

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: selectUserFields(),
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    return withEffectiveModules(user);
  },

  async createUser(data: CreateUserDto) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Email já cadastrado', 400);
    }

    const passwordHash = await hashPassword(data.password);
    const enabledModules = sanitizeModules(data.enabledModules);
    const finalModules: PlatformModule[] =
      data.role === UserRole.ADMIN
        ? getDefaultModulesByRole(UserRole.ADMIN)
        : enabledModules.length > 0
          ? enabledModules
          : getDefaultModulesByRole(data.role);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          role: data.role,
          department: data.department,
          enabledModules: finalModules,
        },
        select: selectUserFields(),
      });

      if (data.entitlements?.length) {
        await tx.userEntitlement.createMany({
          data: data.entitlements.map((entitlement) => ({
            userId: created.id,
            module: entitlement.module,
            submodule: entitlement.submodule,
            level: entitlement.level,
          })),
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        select: selectUserFields(),
      });
    });
    return withEffectiveModules(user);
  },

  async updateUser(id: string, data: UpdateUserDto) {
    logger.debug('Atualizando usuário', { userId: id, updates: Object.keys(data) });
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      logger.warn('Tentativa de atualizar usuário inexistente', { userId: id });
      throw new AppError('Usuário não encontrado', 404);
    }

    const updateData: any = { ...data };
    const targetRole = data.role || user.role;

    if (data.email && data.email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        logger.warn('Tentativa de atualizar email para um já existente', { userId: id, email: data.email });
        throw new AppError('Email já cadastrado', 400);
      }
    }

    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password);
      delete updateData.password;
      logger.info('Senha do usuário atualizada', { userId: id });
    }

    if (data.enabledModules !== undefined || data.role !== undefined) {
      if (targetRole === UserRole.ADMIN) {
        updateData.enabledModules = getDefaultModulesByRole(UserRole.ADMIN);
      } else if (data.enabledModules !== undefined) {
        const sanitized = sanitizeModules(data.enabledModules);
        updateData.enabledModules = sanitized.length > 0 ? sanitized : getDefaultModulesByRole(targetRole);
      } else if (data.role !== undefined) {
        updateData.enabledModules = getDefaultModulesByRole(targetRole);
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: selectUserFields(),
      });

      if (data.entitlements !== undefined) {
        await tx.userEntitlement.deleteMany({ where: { userId: id } });
        if (data.entitlements.length > 0) {
          await tx.userEntitlement.createMany({
            data: data.entitlements.map((entitlement) => ({
              userId: id,
              module: entitlement.module,
              submodule: entitlement.submodule,
              level: entitlement.level,
            })),
          });
        }
      }

      return tx.user.findUniqueOrThrow({
        where: { id: updated.id },
        select: selectUserFields(),
      });
    });

    logger.info('Usuário atualizado com sucesso', { userId: id, email: updatedUser.email });
    return withEffectiveModules(updatedUser);
  },

  async deleteUser(id: string) {
    logger.debug('Excluindo usuário', { userId: id });
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      logger.warn('Tentativa de excluir usuário inexistente', { userId: id });
      throw new AppError('Usuário não encontrado', 404);
    }

    // Verificar se o usuário tem tickets associados
    const ticketsCount = await prisma.ticket.count({
      where: {
        OR: [
          { requesterId: id },
          { assignedTechnicianId: id },
        ],
      },
    });

    if (ticketsCount > 0) {
      logger.warn('Tentativa de excluir usuário com tickets associados', { userId: id, ticketsCount });
      throw new AppError(
        'Não é possível excluir usuário com tickets associados. Transfira os tickets antes de excluir.',
        400
      );
    }

    // Verificar se o usuário está em times
    const teamsCount = await prisma.userTeam.count({
      where: { userId: id },
    });

    if (teamsCount > 0) {
      // Remover usuário de todos os times antes de excluir
      await prisma.userTeam.deleteMany({
        where: { userId: id },
      });
      logger.info('Usuário removido de times antes da exclusão', { userId: id, teamsCount });
    }

    await prisma.user.delete({
      where: { id },
    });

    logger.info('Usuário excluído com sucesso', { userId: id, email: user.email });
  },
};
