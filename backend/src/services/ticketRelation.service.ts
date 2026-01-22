import prisma from '../lib/prisma';
import { TicketRelationType, TicketEventType, EventOrigin } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { ticketEventService } from './ticketEvent.service';

export interface CreateTicketRelationDto {
  relatedTicketId: string;
  relationType: TicketRelationType;
}

export const ticketRelationService = {
  /**
   * Cria uma relação entre tickets
   */
  async createRelation(ticketId: string, data: CreateTicketRelationDto, actorUserId?: string) {
    // Verificar se os tickets existem
    const [ticket, relatedTicket] = await Promise.all([
      prisma.ticket.findUnique({ where: { id: ticketId } }),
      prisma.ticket.findUnique({ where: { id: data.relatedTicketId } }),
    ]);

    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404);
    }

    if (!relatedTicket) {
      throw new AppError('Ticket relacionado não encontrado', 404);
    }

    if (ticketId === data.relatedTicketId) {
      throw new AppError('Um ticket não pode ser relacionado a si mesmo', 400);
    }

    // Verificar se a relação já existe
    const existing = await prisma.ticketRelation.findUnique({
      where: {
        ticketId_relatedTicketId_relationType: {
          ticketId,
          relatedTicketId: data.relatedTicketId,
          relationType: data.relationType,
        },
      },
    });

    if (existing) {
      throw new AppError('Esta relação já existe', 400);
    }

    // Criar relação
    const relation = await prisma.ticketRelation.create({
      data: {
        ticketId,
        relatedTicketId: data.relatedTicketId,
        relationType: data.relationType,
      },
      include: {
        relatedTicket: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    // Registrar evento
    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.RELATION_ADDED,
      actorUserId,
      origin: EventOrigin.PORTAL,
      newValue: {
        relatedTicketId: data.relatedTicketId,
        relationType: data.relationType,
        relatedTicketTitle: relatedTicket.title,
      },
    });

    logger.info('Relação de ticket criada', { ticketId, relatedTicketId: data.relatedTicketId, relationType: data.relationType });
    return relation;
  },

  /**
   * Lista relações de um ticket
   */
  async getTicketRelations(ticketId: string) {
    const [outgoing, incoming] = await Promise.all([
      prisma.ticketRelation.findMany({
        where: { ticketId },
        include: {
          relatedTicket: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.ticketRelation.findMany({
        where: { relatedTicketId: ticketId },
        include: {
          ticket: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      outgoing: outgoing.map((r) => ({
        ...r,
        direction: 'outgoing' as const,
      })),
      incoming: incoming.map((r) => ({
        ...r,
        direction: 'incoming' as const,
        relatedTicket: r.ticket,
      })),
    };
  },

  /**
   * Remove uma relação
   */
  async removeRelation(
    ticketId: string,
    relatedTicketId: string,
    relationType: TicketRelationType,
    actorUserId?: string
  ) {
    const relation = await prisma.ticketRelation.findUnique({
      where: {
        ticketId_relatedTicketId_relationType: {
          ticketId,
          relatedTicketId,
          relationType,
        },
      },
    });

    if (!relation) {
      throw new AppError('Relação não encontrada', 404);
    }

    await prisma.ticketRelation.delete({
      where: {
        ticketId_relatedTicketId_relationType: {
          ticketId,
          relatedTicketId,
          relationType,
        },
      },
    });

    // Registrar evento
    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.RELATION_REMOVED,
      actorUserId,
      origin: EventOrigin.PORTAL,
      oldValue: {
        relatedTicketId,
        relationType,
      },
    });

    logger.info('Relação de ticket removida', { ticketId, relatedTicketId, relationType });
  },
};

