import { UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { hashPassword } from '../utils/password';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department?: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  department?: string | null;
}

export const userService = {
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    return user;
  },

  async getAllUsers(filters?: { role?: UserRole; department?: string }) {
    return prisma.user.findMany({
      where: filters,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    return user;
  },

  async createUser(data: CreateUserDto) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Email já cadastrado', 400);
    }

    const passwordHash = await hashPassword(data.password);

    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
        department: data.department,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async updateUser(id: string, data: UpdateUserDto) {
    logger.debug('Atualizando usuário', { userId: id, updates: Object.keys(data) });
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      logger.warn('Tentativa de atualizar usuário inexistente', { userId: id });
      throw new AppError('Usuário não encontrado', 404);
    }

    const updateData: any = { ...data };

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

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info('Usuário atualizado com sucesso', { userId: id, email: updatedUser.email });
    return updatedUser;
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

