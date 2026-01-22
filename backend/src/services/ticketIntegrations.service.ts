/**
 * Serviço auxiliar para integrar eventos, SLA e automações com tickets
 * Agora usa filas assíncronas para melhor performance
 */
import { TicketEventType, EventOrigin, TicketStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { ticketEventService } from './ticketEvent.service';
import { slaService } from './sla.service';
import { automationService } from './automation.service';
import { logger } from '../utils/logger';
import { slaQueue, automationQueue, emailQueue, isRedisAvailable } from '../lib/queue';
import { env } from '../config/env';
import axios from 'axios';

// Função auxiliar para adicionar job na fila
// Redis é obrigatório - se não estiver disponível, lança erro
async function safeAddToQueue(queue: any, jobName: string, data: any): Promise<void> {
  if (!queue || !isRedisAvailable()) {
    logger.error(`Redis não disponível. Não é possível adicionar job: ${jobName}`, { ticketId: data.ticketId });
    throw new Error(`Redis não disponível. Não é possível processar ${jobName}`);
  }

  try {
    await queue.add(jobName, data);
    logger.debug(`Job adicionado na fila: ${jobName}`, { ticketId: data.ticketId });
  } catch (error: any) {
    logger.error(`Erro ao adicionar job na fila: ${jobName}`, { 
      error: error.message,
      ticketId: data.ticketId 
    });
    throw error;
  }
}

/**
 * Registra evento de criação de ticket
 * Agora usa filas assíncronas para SLA e automações
 */
export async function recordTicketCreated(ticketId: string, userId: string, ticketData: any) {
  try {
    // Registrar evento de criação (síncrono - importante para auditoria)
    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.CREATED,
      actorUserId: userId,
      origin: EventOrigin.PORTAL,
      newValue: {
        title: ticketData.title,
        status: ticketData.status,
        priority: ticketData.priority,
        tipo: ticketData.tipo,
        teamId: ticketData.teamId,
        categoryId: ticketData.categoryId,
      },
    });

    // Adicionar jobs nas filas (assíncrono) - apenas se Redis estiver disponível
    await Promise.all([
      // Iniciar SLA via fila
      safeAddToQueue(slaQueue, 'start-sla', {
        type: 'START_SLA',
        ticketId,
        actorUserId: userId,
      }),
      // Processar automações via fila
      safeAddToQueue(automationQueue, 'process-automations', {
        event: 'ON_TICKET_CREATED',
        ticketId,
        ticketData,
      }),
      // Enviar notificações por email via fila
      safeAddToQueue(emailQueue, 'ticket-created', {
        type: 'TICKET_CREATED',
        ticketId,
        userId,
        data: {
          teamMembers: ticketData.team?.users || [],
        },
      }),
    ]);

    logger.debug('Jobs adicionados nas filas para ticket criado', { ticketId });

    // Webhook global N8N (se configurado)
    if (process.env.N8N_WEBHOOK_URL) {
      try {
        const fullTicket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: {
            requester: { select: { id: true, name: true, email: true } },
            assignedTechnician: { select: { id: true, name: true, email: true } },
            category: true,
            team: true,
            tags: { include: { tag: true } },
          },
        });

        if (fullTicket) {
          await axios.post(process.env.N8N_WEBHOOK_URL, {
            event: 'ticket_created',
            ticketId: fullTicket.id,
            ticket: fullTicket,
            timestamp: new Date().toISOString(),
          }, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' },
          }).catch((err) => {
            // Não quebrar o fluxo se o webhook falhar
            logger.warn('Erro ao chamar webhook N8N (criação)', { ticketId, error: err.message });
          });
        }
      } catch (error: any) {
        logger.warn('Erro ao enviar webhook N8N (criação)', { ticketId, error: error.message });
      }
    }
  } catch (error: any) {
    logger.error('Erro ao registrar criação de ticket', { ticketId, error: error.message });
  }
}

/**
 * Registra evento de atualização de ticket
 */
export async function recordTicketUpdated(
  ticketId: string,
  userId: string,
  oldTicket: any,
  newTicket: any,
  changes: {
    status?: { old: TicketStatus; new: TicketStatus };
    priority?: { old: string; new: string };
    assignedTechnicianId?: { old: string | null; new: string | null };
    teamId?: { old: string | null; new: string | null };
  }
) {
  try {
    // Registrar evento de atualização geral
    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.UPDATED,
      actorUserId: userId,
      origin: EventOrigin.PORTAL,
      oldValue: oldTicket,
      newValue: newTicket,
    });

    // Registrar eventos específicos
    if (changes.status) {
      await ticketEventService.createEvent({
        ticketId,
        eventType: TicketEventType.STATUS_CHANGED,
        actorUserId: userId,
        origin: EventOrigin.PORTAL,
        oldValue: { status: changes.status.old },
        newValue: { status: changes.status.new },
      });

      // Processar automações de mudança de status via fila
      await safeAddToQueue(automationQueue, 'process-status-automations', {
        event: 'ON_STATUS_CHANGED',
        ticketId,
        ticketData: newTicket,
      });

      // Se foi resolvido, calcular SLA via fila
      if (changes.status.new === TicketStatus.RESOLVED || changes.status.new === TicketStatus.CLOSED) {
        // Buscar ticket atualizado para pegar a data de resolução
        const updatedTicket = await prisma.ticket.findUnique({
          where: { id: ticketId },
        });
        const resolvedAt = updatedTicket?.resolvedAt || new Date();
        
        await safeAddToQueue(slaQueue, 'update-sla-resolution', {
          type: 'UPDATE_SLA',
          ticketId,
          actorUserId: userId,
          data: { resolvedAt },
        });
      }
    }

    if (changes.priority) {
      await ticketEventService.createEvent({
        ticketId,
        eventType: TicketEventType.PRIORITY_CHANGED,
        actorUserId: userId,
        origin: EventOrigin.PORTAL,
        oldValue: { priority: changes.priority.old },
        newValue: { priority: changes.priority.new },
      });

      // Processar automações de mudança de prioridade via fila
      await safeAddToQueue(automationQueue, 'process-priority-automations', {
        event: 'ON_PRIORITY_CHANGED',
        ticketId,
        ticketData: newTicket,
      });
    }

    if (changes.assignedTechnicianId) {
      if (changes.assignedTechnicianId.new) {
        await ticketEventService.createEvent({
          ticketId,
          eventType: TicketEventType.ASSIGNED,
          actorUserId: userId,
          origin: EventOrigin.PORTAL,
          oldValue: { assignedTechnicianId: changes.assignedTechnicianId.old },
          newValue: { assignedTechnicianId: changes.assignedTechnicianId.new },
        });
      } else {
        await ticketEventService.createEvent({
          ticketId,
          eventType: TicketEventType.UNASSIGNED,
          actorUserId: userId,
          origin: EventOrigin.PORTAL,
          oldValue: { assignedTechnicianId: changes.assignedTechnicianId.old },
          newValue: { assignedTechnicianId: null },
        });
      }
    }

    if (changes.teamId) {
      await ticketEventService.createEvent({
        ticketId,
        eventType: TicketEventType.TEAM_CHANGED,
        actorUserId: userId,
        origin: EventOrigin.PORTAL,
        oldValue: { teamId: changes.teamId.old },
        newValue: { teamId: changes.teamId.new },
      });

      // Processar automações de mudança de time via fila
      await safeAddToQueue(automationQueue, 'process-team-automations', {
        event: 'ON_TEAM_CHANGED',
        ticketId,
        ticketData: newTicket,
      });
    }

    // Processar automações de atualização geral via fila
    await safeAddToQueue(automationQueue, 'process-update-automations', {
      event: 'ON_TICKET_UPDATED',
      ticketId,
      ticketData: newTicket,
    });

    // Enviar notificações de atualização via fila
    await safeAddToQueue(emailQueue, 'ticket-updated', {
      type: 'TICKET_UPDATED',
      ticketId,
      userId,
      data: {
        recipients: [], // TODO: Calcular destinatários
        changes,
      },
    });

    // Webhook global N8N (se configurado)
    if (process.env.N8N_WEBHOOK_URL) {
      try {
        const fullTicket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: {
            requester: { select: { id: true, name: true, email: true } },
            assignedTechnician: { select: { id: true, name: true, email: true } },
            category: true,
            team: true,
            tags: { include: { tag: true } },
          },
        });

        if (fullTicket) {
          await axios.post(process.env.N8N_WEBHOOK_URL, {
            event: 'ticket_updated',
            ticketId: fullTicket.id,
            ticket: fullTicket,
            changes,
            timestamp: new Date().toISOString(),
          }, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' },
          }).catch((err) => {
            // Não quebrar o fluxo se o webhook falhar
            logger.warn('Erro ao chamar webhook N8N (atualização)', { ticketId, error: err.message });
          });
        }
      } catch (error: any) {
        logger.warn('Erro ao enviar webhook N8N (atualização)', { ticketId, error: error.message });
      }
    }
  } catch (error: any) {
    logger.error('Erro ao registrar atualização de ticket', { ticketId, error: error.message });
  }
}

/**
 * Registra evento de comentário adicionado
 */
export async function recordCommentAdded(ticketId: string, userId: string, commentId: string) {
  try {
    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.COMMENT_ADDED,
      actorUserId: userId,
      origin: EventOrigin.PORTAL,
      newValue: { commentId },
    });

    // Verificar se é primeira resposta (comentário público de um agente)
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (ticket) {
      // Buscar primeiro comentário público de um agente (não solicitante)
      const firstAgentComment = await prisma.ticketComment.findFirst({
        where: {
          ticketId,
          type: 'PUBLIC',
          authorId: { not: ticket.requesterId },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (firstAgentComment && !ticket.firstResponseAt) {
        const firstResponse = firstAgentComment.createdAt;
        
        // Calcular firstResponseBusinessMinutes
        const { businessMinutesBetween } = await import('../utils/businessHours');
        const firstResponseBusinessMinutes = businessMinutesBetween(ticket.createdAt, firstResponse);
        
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { 
            firstResponseAt: firstResponse,
            firstResponseBusinessMinutes,
          },
        });

        // Registrar primeira resposta no SLA via fila
        await safeAddToQueue(slaQueue, 'update-sla-first-response', {
          type: 'UPDATE_SLA',
          ticketId,
          actorUserId: userId,
          data: { firstResponseAt: firstResponse },
        });
      }

      // Processar automações via fila
      await safeAddToQueue(automationQueue, 'process-comment-automations', {
        event: 'ON_COMMENT_ADDED',
        ticketId,
        ticketData: ticket,
      });

      // Enviar notificações de comentário via fila
      await safeAddToQueue(emailQueue, 'comment-added', {
        type: 'COMMENT_ADDED',
        ticketId,
        userId,
        data: {
          recipients: [], // TODO: Calcular destinatários
        },
      });
    }
  } catch (error: any) {
    logger.error('Erro ao registrar comentário', { ticketId, error: error.message });
  }
}

/**
 * Registra evento de anexo adicionado
 */
export async function recordAttachmentAdded(ticketId: string, userId: string, attachmentId: string) {
  try {
    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.ATTACHMENT_ADDED,
      actorUserId: userId,
      origin: EventOrigin.PORTAL,
      newValue: { attachmentId },
    });
  } catch (error: any) {
    logger.error('Erro ao registrar anexo', { ticketId, error: error.message });
  }
}

/**
 * Registra evento de anexo removido
 */
export async function recordAttachmentRemoved(ticketId: string, userId: string, attachmentId: string) {
  try {
    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.ATTACHMENT_REMOVED,
      actorUserId: userId,
      origin: EventOrigin.PORTAL,
      oldValue: { attachmentId },
    });
  } catch (error: any) {
    logger.error('Erro ao registrar remoção de anexo', { ticketId, error: error.message });
  }
}

/**
 * Registra evento de tag adicionada
 */
export async function recordTagAdded(ticketId: string, userId: string, tagId: string) {
  try {
    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.TAG_ADDED,
      actorUserId: userId,
      origin: EventOrigin.PORTAL,
      newValue: { tagId },
    });
  } catch (error: any) {
    logger.error('Erro ao registrar tag adicionada', { ticketId, error: error.message });
  }
}

/**
 * Registra evento de tag removida
 */
export async function recordTagRemoved(ticketId: string, userId: string, tagId: string) {
  try {
    await ticketEventService.createEvent({
      ticketId,
      eventType: TicketEventType.TAG_REMOVED,
      actorUserId: userId,
      origin: EventOrigin.PORTAL,
      oldValue: { tagId },
    });
  } catch (error: any) {
    logger.error('Erro ao registrar tag removida', { ticketId, error: error.message });
  }
}

