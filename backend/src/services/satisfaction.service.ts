import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { TicketStatus } from '@prisma/client';

export interface CreateSatisfactionDto {
  score: number; // 1 a 5
  comment?: string;
}

export const satisfactionService = {
  /**
   * Cria ou atualiza avaliação de satisfação
   */
  async createOrUpdateSatisfaction(ticketId: string, userId: string, data: CreateSatisfactionDto) {
    // Validar score
    if (data.score < 1 || data.score > 5) {
      throw new AppError('Score deve estar entre 1 e 5', 400);
    }

    // Verificar se o ticket existe e está fechado
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404);
    }

    if (ticket.status !== TicketStatus.CLOSED) {
      throw new AppError('Apenas tickets fechados podem ser avaliados', 400);
    }

    // Verificar se o usuário é o solicitante
    if (ticket.requesterId !== userId) {
      throw new AppError('Apenas o solicitante pode avaliar o ticket', 403);
    }

    // Verificar se já existe avaliação
    const existing = await prisma.ticketSatisfaction.findUnique({
      where: { ticketId },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
      },
    });

    if (existing) {
      // Atualizar avaliação existente
      const updated = await prisma.ticketSatisfaction.update({
        where: { ticketId },
        data: {
          score: data.score,
          comment: data.comment,
          answeredBy: userId,
        },
      });

      logger.info('Avaliação de satisfação atualizada', { ticketId, score: data.score });
      return updated;
    }

    // Criar nova avaliação
    const satisfaction = await prisma.ticketSatisfaction.create({
      data: {
        ticketId,
        score: data.score,
        comment: data.comment,
        answeredBy: userId,
      },
    });

    logger.info('Avaliação de satisfação criada', { ticketId, score: data.score });
    return satisfaction;
  },

  /**
   * Busca avaliação de um ticket
   */
  async getTicketSatisfaction(ticketId: string) {
    return prisma.ticketSatisfaction.findUnique({
      where: { ticketId },
    });
  },

  /**
   * Calcula CSAT médio
   */
  async getAverageCsat(filters?: {
    from?: Date;
    to?: Date;
    teamId?: string;
    agentId?: string;
  }) {
    const where: any = {};

    if (filters?.from || filters?.to) {
      where.answeredAt = {};
      if (filters.from) where.answeredAt.gte = filters.from;
      if (filters.to) where.answeredAt.lte = filters.to;
    }

    if (filters?.teamId || filters?.agentId) {
      where.ticket = {};
      if (filters.teamId) {
        where.ticket.teamId = filters.teamId;
      }
      if (filters.agentId) {
        where.ticket.assignedTechnicianId = filters.agentId;
      }
    }

    const result = await prisma.ticketSatisfaction.aggregate({
      where,
      _avg: {
        score: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      average: result._avg.score || 0,
      count: result._count.id || 0,
    };
  },
};

