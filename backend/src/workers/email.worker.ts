import { Worker, Job } from 'bullmq';
import { redisConnection, isRedisAvailable } from '../lib/queue';
import { logger } from '../utils/logger';
import { notificationService } from '../services/notification.service';
import { registerWorkerTelemetry } from '../shared/observability/queueTelemetry';

// Tipos de jobs de email
interface EmailJobData {
  type: 'NOTIFICATION' | 'TICKET_CREATED' | 'TICKET_UPDATED' | 'COMMENT_ADDED';
  ticketId?: string;
  userId?: string;
  notificationId?: string;
  data?: any;
}

// Criar worker de email (Redis é obrigatório)
if (!redisConnection || !isRedisAvailable()) {
  throw new Error('Redis não disponível. Worker de email não pode ser criado.');
}

export const emailWorker = new Worker<EmailJobData>(
    'email',
    async (job: Job<EmailJobData>) => {
    const { type, ticketId, userId, notificationId, data } = job.data;

    logger.debug('Processando job de email', {
      jobId: job.id,
      type,
      ticketId,
      userId,
    });

    try {
      switch (type) {
        case 'NOTIFICATION':
          // Enviar notificação específica
          if (notificationId) {
            // Aqui você pode integrar com serviço de email real (SendGrid, AWS SES, etc.)
            // Por enquanto, apenas logamos
            logger.info('Enviando notificação por email', { notificationId });
            // TODO: Implementar envio real de email
          }
          break;

        case 'TICKET_CREATED':
          // Enviar emails para time responsável quando ticket é criado
          if (ticketId && data?.teamMembers) {
            logger.info('Enviando emails de ticket criado', {
              ticketId,
              recipients: data.teamMembers.length,
            });
            // TODO: Implementar envio de emails para membros do time
          }
          break;

        case 'TICKET_UPDATED':
          // Enviar emails quando ticket é atualizado
          if (ticketId && data?.recipients) {
            logger.info('Enviando emails de atualização de ticket', {
              ticketId,
              recipients: data.recipients.length,
            });
            // TODO: Implementar envio de emails
          }
          break;

        case 'COMMENT_ADDED':
          // Enviar emails quando comentário é adicionado
          if (ticketId && data?.recipients) {
            logger.info('Enviando emails de novo comentário', {
              ticketId,
              recipients: data.recipients.length,
            });
            // TODO: Implementar envio de emails
          }
          break;

        default:
          logger.warn('Tipo de job de email desconhecido', { type });
      }

      return { success: true, processedAt: new Date().toISOString() };
    } catch (error: any) {
      logger.error('Erro ao processar job de email', {
        jobId: job.id,
        error: error.message,
      });
      throw error; // Re-throw para que BullMQ tente novamente
    }
  },
    {
      connection: redisConnection,
      concurrency: 5, // Processar até 5 jobs simultaneamente
      limiter: {
        max: 10, // Máximo 10 jobs
        duration: 1000, // por segundo
      },
    }
  );

// Event listeners
emailWorker.on('completed', (job) => {
  logger.debug('Job de email completado', {
    jobId: job.id,
    type: job.data.type,
  });
});

emailWorker.on('failed', (job, err) => {
  logger.error('Job de email falhou', {
    jobId: job?.id,
    type: job?.data.type,
    error: err.message,
  });
});

emailWorker.on('error', (err) => {
  logger.error('Erro no worker de email', err);
});

registerWorkerTelemetry('email', emailWorker);

logger.info('✅ Worker de email inicializado');
