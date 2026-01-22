import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';

export interface CreateWorklogDto {
  durationMinutes: number;
  description?: string;
}

export const worklogService = {
  /**
   * Cria um worklog para um ticket
   */
  async createWorklog(ticketId: string, userId: string, data: CreateWorklogDto) {
    // Verificar se o ticket existe
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404);
    }

    // Verificar permissões (apenas agentes podem lançar worklogs)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    const canLogWork = user.role === UserRole.ADMIN || user.role === UserRole.TRIAGER || user.role === UserRole.TECHNICIAN;
    if (!canLogWork) {
      throw new AppError('Apenas agentes podem lançar worklogs', 403);
    }

    const worklog = await prisma.ticketWorklog.create({
      data: {
        ticketId,
        userId,
        durationMinutes: data.durationMinutes,
        description: data.description,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info('Worklog criado', { worklogId: worklog.id, ticketId, userId, durationMinutes: data.durationMinutes });

    // Criar entrada automática no diário do técnico
    try {
      const { technicianJournalService } = await import('./technicianJournal.service');
      await technicianJournalService.createAutoEntryForWorklog(worklog, ticket, userId);
    } catch (error) {
      // Não quebrar o fluxo principal se houver erro no diário
      logger.warn('Erro ao criar entrada automática no diário para worklog', {
        error: error instanceof Error ? error.message : String(error),
        worklogId: worklog.id,
      });
    }

    return worklog;
  },

  /**
   * Lista worklogs de um ticket
   */
  async getTicketWorklogs(ticketId: string) {
    return prisma.ticketWorklog.findMany({
      where: { ticketId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  /**
   * Calcula total de horas trabalhadas em um ticket
   */
  async getTotalWorklogMinutes(ticketId: string) {
    const result = await prisma.ticketWorklog.aggregate({
      where: { ticketId },
      _sum: {
        durationMinutes: true,
      },
    });

    return result._sum.durationMinutes || 0;
  },
};

