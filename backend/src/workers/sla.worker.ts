import { Worker, Job } from 'bullmq';
import { redisConnection, isRedisAvailable } from '../lib/queue';
import { logger } from '../utils/logger';
import { slaService } from '../services/sla.service';

// Tipos de jobs de SLA
interface SlaJobData {
  type: 'START_SLA' | 'UPDATE_SLA' | 'RECALCULATE_SLA' | 'CHECK_BREACH';
  ticketId: string;
  actorUserId?: string;
  data?: any;
}

// Criar worker de SLA (Redis é obrigatório)
if (!redisConnection || !isRedisAvailable()) {
  throw new Error('Redis não disponível. Worker de SLA não pode ser criado.');
}

export const slaWorker = new Worker<SlaJobData>(
    'sla',
    async (job: Job<SlaJobData>) => {
    const { type, ticketId, actorUserId, data } = job.data;

    logger.debug('Processando job de SLA', {
      jobId: job.id,
      type,
      ticketId,
    });

    try {
      switch (type) {
        case 'START_SLA':
          // Iniciar SLA para um ticket
          await slaService.startSlaForTicket(ticketId, actorUserId);
          logger.info('SLA iniciado via worker', { ticketId });
          break;

        case 'UPDATE_SLA':
          // Atualizar SLA (ex: quando há primeira resposta ou resolução)
          if (data?.firstResponseAt) {
            await slaService.recordFirstResponse(ticketId, data.firstResponseAt);
            logger.info('SLA atualizado com primeira resposta via worker', { ticketId });
          } else if (data?.resolvedAt) {
            await slaService.recordResolution(ticketId, data.resolvedAt);
            logger.info('SLA atualizado com resolução via worker', { ticketId });
          }
          break;

        case 'RECALCULATE_SLA':
          // Recalcular SLA (útil para correções ou mudanças de política)
          // TODO: Implementar recálculo completo de SLA
          logger.info('Recálculo de SLA solicitado', { ticketId });
          break;

        case 'CHECK_BREACH':
          // Verificar se SLA foi violado
          // TODO: Implementar verificação de violação
          logger.info('Verificação de violação de SLA solicitada', { ticketId });
          break;

        default:
          logger.warn('Tipo de job de SLA desconhecido', { type });
      }

      return { success: true, processedAt: new Date().toISOString() };
    } catch (error: any) {
      logger.error('Erro ao processar job de SLA', {
        jobId: job.id,
        ticketId,
        error: error.message,
      });
      throw error;
    }
  },
    {
      connection: redisConnection,
      concurrency: 3, // Processar até 3 jobs simultaneamente (SLA pode ser pesado)
      limiter: {
        max: 5, // Máximo 5 jobs
        duration: 1000, // por segundo
      },
    }
  );

// Event listeners
slaWorker.on('completed', (job) => {
  logger.debug('Job de SLA completado', {
    jobId: job.id,
    type: job.data.type,
    ticketId: job.data.ticketId,
  });
});

slaWorker.on('failed', (job, err) => {
  logger.error('Job de SLA falhou', {
    jobId: job?.id,
    ticketId: job?.data.ticketId,
    type: job?.data.type,
    error: err.message,
  });
});

slaWorker.on('error', (err) => {
  logger.error('Erro no worker de SLA', err);
});

logger.info('✅ Worker de SLA inicializado');

