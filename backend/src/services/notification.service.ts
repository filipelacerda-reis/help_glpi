import prisma from '../lib/prisma';
import { NotificationType, UserRole } from '@prisma/client';
import { logger } from '../utils/logger';
import { getIo } from '../lib/socket';

export interface CreateNotificationDto {
  userId: string;
  ticketId?: string;
  type: NotificationType;
  title: string;
  message: string;
}

export const notificationService = {
  async createNotification(data: CreateNotificationDto) {
    logger.debug('Criando notificação', { userId: data.userId, type: data.type });
    
    const notification = await prisma.notification.create({
      data,
      include: {
        ticket: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    logger.info('Notificação criada', { notificationId: notification.id, userId: data.userId });

    // Emitir evento em tempo real para o usuário específico (room = userId)
    try {
      const io = getIo();
      if (io) {
        io.to(data.userId).emit('new_notification', notification);
      }
    } catch (error) {
      logger.warn('Falha ao emitir evento Socket.io para nova notificação', {
        error: error instanceof Error ? error.message : String(error),
        userId: data.userId,
      });
    }

    return notification;
  },

  async createSlaRiskNotification(userId: string, ticketId: string, message: string) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        ticketId,
        title: 'Risco de SLA iminente',
      },
      select: { id: true },
    });

    if (existing) {
      return null;
    }

    return this.createNotification({
      userId,
      ticketId,
      type: NotificationType.TEAM_CHANGE,
      title: 'Risco de SLA iminente',
      message,
    });
  },

  async getUserNotifications(userId: string, unreadOnly: boolean = false) {
    logger.debug('Buscando notificações do usuário', { userId, unreadOnly });
    
    const where: any = { userId };
    if (unreadOnly) {
      where.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        ticket: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limitar a 50 notificações mais recentes
    });

    return notifications;
  },

  async getUnreadCount(userId: string): Promise<number> {
    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    return count;
  },

  async markAsRead(notificationId: string, userId: string) {
    logger.debug('Marcando notificação como lida', { notificationId, userId });
    
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notificação não encontrada');
    }

    if (notification.userId !== userId) {
      throw new Error('Acesso negado');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    logger.info('Notificação marcada como lida', { notificationId, userId });
    return updated;
  },

  async markAllAsRead(userId: string) {
    logger.debug('Marcando todas as notificações como lidas', { userId });
    
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    logger.info('Todas as notificações marcadas como lidas', { userId, count: result.count });
    return result;
  },

  async createCommentNotification(
    ticketId: string,
    commentAuthorId: string,
    commentAuthorRole: UserRole,
    ticketRequesterId: string
  ) {
    // Buscar informações do ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        requesterId: true,
        assignedTechnicianId: true,
      },
    });

    if (!ticket) {
      return;
    }

    // Buscar informações do autor do comentário
    const author = await prisma.user.findUnique({
      where: { id: commentAuthorId },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    if (!author) {
      return;
    }

    // Se o comentário for do solicitante
    if (commentAuthorRole === UserRole.REQUESTER) {
      // Notificar o técnico atribuído (se houver e não for o próprio solicitante)
      if (
        ticket.assignedTechnicianId &&
        ticket.assignedTechnicianId !== commentAuthorId
      ) {
        await this.createNotification({
          userId: ticket.assignedTechnicianId,
          ticketId: ticket.id,
          type: NotificationType.COMMENT,
          title: 'Novo comentário do solicitante',
          message: `${author.name} comentou no ticket "${ticket.title}"`,
        });
      }
      return; // Solicitante comentando só notifica o técnico, não precisa notificar a si mesmo
    }

    // Se o comentário for de um técnico/triagista/admin
    // Notificar o solicitante (se não for o próprio autor)
    if (ticket.requesterId !== commentAuthorId) {
      await this.createNotification({
        userId: ticket.requesterId,
        ticketId: ticket.id,
        type: NotificationType.COMMENT,
        title: 'Novo comentário no seu ticket',
        message: `${author.name} comentou no ticket "${ticket.title}"`,
      });
    }

    // Se houver técnico atribuído e for diferente do autor e do solicitante, notificar também
    if (
      ticket.assignedTechnicianId &&
      ticket.assignedTechnicianId !== commentAuthorId &&
      ticket.assignedTechnicianId !== ticket.requesterId
    ) {
      await this.createNotification({
        userId: ticket.assignedTechnicianId,
        ticketId: ticket.id,
        type: NotificationType.COMMENT,
        title: 'Novo comentário no ticket',
        message: `${author.name} comentou no ticket "${ticket.title}"`,
      });
    }
  },

  async createStatusChangeNotification(
    ticketId: string,
    oldStatus: string,
    newStatus: string,
    changedById: string,
    ticketRequesterId: string,
    assignedTechnicianId?: string | null
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        requesterId: true,
      },
    });

    if (!ticket) {
      return;
    }

    const changedBy = await prisma.user.findUnique({
      where: { id: changedById },
      select: {
        id: true,
        name: true,
      },
    });

    if (!changedBy) {
      return;
    }

    const statusLabels: Record<string, string> = {
      OPEN: 'Aberto',
      IN_PROGRESS: 'Em Atendimento',
      WAITING_REQUESTER: 'Aguardando Usuário',
      WAITING_THIRD_PARTY: 'Aguardando Terceiros',
      RESOLVED: 'Resolvido',
      CLOSED: 'Fechado',
    };

    const oldStatusLabel = statusLabels[oldStatus] || oldStatus;
    const newStatusLabel = statusLabels[newStatus] || newStatus;

    // Notificar o solicitante
    if (ticket.requesterId !== changedById) {
      await this.createNotification({
        userId: ticket.requesterId,
        ticketId: ticket.id,
        type: NotificationType.STATUS_CHANGE,
        title: 'Status do ticket alterado',
        message: `${changedBy.name} alterou o status do ticket "${ticket.title}" de ${oldStatusLabel} para ${newStatusLabel}`,
      });
    }

    // Notificar o técnico atribuído (se houver e for diferente de quem mudou)
    if (
      assignedTechnicianId &&
      assignedTechnicianId !== changedById &&
      assignedTechnicianId !== ticket.requesterId
    ) {
      await this.createNotification({
        userId: assignedTechnicianId,
        ticketId: ticket.id,
        type: NotificationType.STATUS_CHANGE,
        title: 'Status do ticket alterado',
        message: `${changedBy.name} alterou o status do ticket "${ticket.title}" de ${oldStatusLabel} para ${newStatusLabel}`,
      });
    }
  },

  async createAssignmentNotification(
    ticketId: string,
    assignedTechnicianId: string | null,
    oldAssignedTechnicianId: string | null,
    assignedById: string,
    ticketRequesterId: string
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        requesterId: true,
      },
    });

    if (!ticket) {
      return;
    }

    const assignedBy = await prisma.user.findUnique({
      where: { id: assignedById },
      select: {
        id: true,
        name: true,
      },
    });

    if (!assignedBy) {
      return;
    }

    // Se foi atribuído a um técnico
    if (assignedTechnicianId) {
      const technician = await prisma.user.findUnique({
        where: { id: assignedTechnicianId },
        select: {
          id: true,
          name: true,
        },
      });

      if (!technician) {
        return;
      }

      // Notificar o técnico atribuído (se não for ele mesmo que se atribuiu)
      if (assignedTechnicianId !== assignedById) {
        await this.createNotification({
          userId: assignedTechnicianId,
          ticketId: ticket.id,
          type: NotificationType.ASSIGNMENT,
          title: 'Ticket atribuído a você',
          message: `${assignedBy.name} atribuiu o ticket "${ticket.title}" para você`,
        });
      }

      // Notificar o solicitante (se não for ele que atribuiu)
      if (ticket.requesterId !== assignedById) {
        await this.createNotification({
          userId: ticket.requesterId,
          ticketId: ticket.id,
          type: NotificationType.ASSIGNMENT,
          title: 'Técnico atribuído ao ticket',
          message: `O ticket "${ticket.title}" foi atribuído para ${technician.name}`,
        });
      }

      // Se havia um técnico anterior e é diferente, notificar ele também
      if (oldAssignedTechnicianId && oldAssignedTechnicianId !== assignedTechnicianId) {
        await this.createNotification({
          userId: oldAssignedTechnicianId,
          ticketId: ticket.id,
          type: NotificationType.ASSIGNMENT,
          title: 'Ticket reatribuído',
          message: `O ticket "${ticket.title}" foi reatribuído para ${technician.name}`,
        });
      }
    } else {
      // Se foi desatribuído (assignedTechnicianId é null)
      // Notificar o técnico anterior se houver
      if (oldAssignedTechnicianId && oldAssignedTechnicianId !== assignedById) {
        await this.createNotification({
          userId: oldAssignedTechnicianId,
          ticketId: ticket.id,
          type: NotificationType.ASSIGNMENT,
          title: 'Atribuição removida',
          message: `A atribuição do ticket "${ticket.title}" foi removida`,
        });
      }

      // Notificar o solicitante
      if (ticket.requesterId !== assignedById) {
        await this.createNotification({
          userId: ticket.requesterId,
          ticketId: ticket.id,
          type: NotificationType.ASSIGNMENT,
          title: 'Atribuição removida',
          message: `A atribuição do ticket "${ticket.title}" foi removida`,
        });
      }
    }
  },

  async createTeamChangeNotification(
    ticketId: string,
    newTeamId: string | null,
    oldTeamId: string | null,
    changedById: string,
    ticketRequesterId: string
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        requesterId: true,
      },
    });

    if (!ticket) {
      return;
    }

    const changedBy = await prisma.user.findUnique({
      where: { id: changedById },
      select: {
        id: true,
        name: true,
      },
    });

    if (!changedBy) {
      return;
    }

    // Buscar informações dos times
    let oldTeamName = 'Nenhum time';
    let newTeamName = 'Nenhum time';

    if (oldTeamId) {
      const oldTeam = await prisma.team.findUnique({
        where: { id: oldTeamId },
        select: { name: true },
      });
      if (oldTeam) {
        oldTeamName = oldTeam.name;
      }
    }

    if (newTeamId) {
      const newTeam = await prisma.team.findUnique({
        where: { id: newTeamId },
        select: { name: true },
      });
      if (newTeam) {
        newTeamName = newTeam.name;
      }
    }

    // Notificar o solicitante
    if (ticket.requesterId !== changedById) {
      await this.createNotification({
        userId: ticket.requesterId,
        ticketId: ticket.id,
        type: NotificationType.TEAM_CHANGE,
        title: 'Time do ticket alterado',
        message: `${changedBy.name} moveu o ticket "${ticket.title}" de ${oldTeamName} para ${newTeamName}`,
      });
    }

    // Notificar membros do time antigo (se houver)
    if (oldTeamId) {
      const oldTeamMembers = await prisma.userTeam.findMany({
        where: { teamId: oldTeamId },
        select: { userId: true },
      });

      for (const member of oldTeamMembers) {
        if (member.userId !== changedById && member.userId !== ticket.requesterId) {
          await this.createNotification({
            userId: member.userId,
            ticketId: ticket.id,
            type: NotificationType.TEAM_CHANGE,
            title: 'Ticket movido para outro time',
            message: `O ticket "${ticket.title}" foi movido de ${oldTeamName} para ${newTeamName}`,
          });
        }
      }
    }

    // Notificar membros do novo time (se houver)
    if (newTeamId) {
      const newTeamMembers = await prisma.userTeam.findMany({
        where: { teamId: newTeamId },
        select: { userId: true },
      });

      for (const member of newTeamMembers) {
        if (member.userId !== changedById && member.userId !== ticket.requesterId) {
          await this.createNotification({
            userId: member.userId,
            ticketId: ticket.id,
            type: NotificationType.TEAM_CHANGE,
            title: 'Novo ticket atribuído ao seu time',
            message: `O ticket "${ticket.title}" foi movido para o time ${newTeamName}`,
          });
        }
      }
    }
  },
};
