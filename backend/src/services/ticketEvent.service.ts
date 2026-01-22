import prisma from '../lib/prisma';
import { TicketEventType, EventOrigin } from '@prisma/client';
import { logger } from '../utils/logger';

export interface CreateTicketEventDto {
  ticketId: string;
  eventType: TicketEventType;
  actorUserId?: string | null;
  origin?: EventOrigin;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
}

export const ticketEventService = {
  /**
   * Cria um evento de ticket
   */
  async createEvent(data: CreateTicketEventDto) {
    try {
      const event = await prisma.ticketEvent.create({
        data: {
          ticketId: data.ticketId,
          eventType: data.eventType,
          actorUserId: data.actorUserId || null,
          origin: data.origin || EventOrigin.PORTAL,
          oldValue: data.oldValue ? JSON.parse(JSON.stringify(data.oldValue)) : null,
          newValue: data.newValue ? JSON.parse(JSON.stringify(data.newValue)) : null,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
        },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      logger.debug('Evento de ticket criado', { eventId: event.id, ticketId: data.ticketId, eventType: data.eventType });
      return event;
    } catch (error: any) {
      logger.error('Erro ao criar evento de ticket', { error: error.message, data });
      throw error;
    }
  },

  /**
   * Busca eventos de um ticket com paginação
   */
  async getTicketEvents(
    ticketId: string,
    options?: {
      page?: number;
      pageSize?: number;
      eventType?: TicketEventType;
    }
  ) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const where: any = {
      ticketId,
    };

    if (options?.eventType) {
      where.eventType = options.eventType;
    }

    const [events, total] = await Promise.all([
      prisma.ticketEvent.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        skip,
        take: pageSize,
      }),
      prisma.ticketEvent.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Busca eventos por tipo
   */
  async getEventsByType(eventType: TicketEventType, limit?: number) {
    return prisma.ticketEvent.findMany({
      where: { eventType },
      include: {
        ticket: {
          select: {
            id: true,
            title: true,
          },
        },
        actor: {
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
      take: limit,
    });
  },
};

