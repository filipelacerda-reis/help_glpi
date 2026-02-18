import { Worker, Job } from 'bullmq';
import { redisConnection, isRedisAvailable } from '../lib/queue';
import { logger } from '../utils/logger';
import { automationService } from '../services/automation.service';
import { registerWorkerTelemetry } from '../shared/observability/queueTelemetry';

// Tipos de jobs de automação
interface AutomationJobData {
  event: string; // ON_TICKET_CREATED, ON_TICKET_UPDATED, etc.
  ticketId: string;
  ticketData: any;
  changes?: any;
}

// Criar worker de automação (Redis é obrigatório)
if (!redisConnection || !isRedisAvailable()) {
  throw new Error('Redis não disponível. Worker de automação não pode ser criado.');
}

export const automationWorker = new Worker<AutomationJobData>(
    'automation',
    async (job: Job<AutomationJobData>) => {
    const { event, ticketId, ticketData, changes } = job.data;

    logger.debug('Processando job de automação', {
      jobId: job.id,
      event,
      ticketId,
    });

    try {
      // Processar automações para o evento
      const results = await automationService.processAutomations(
        event as any,
        ticketData
      );

      logger.info('Automações processadas via worker', {
        ticketId,
        event,
        rulesTriggered: results.filter((r: any) => r.triggered).length,
        totalRules: results.length,
      });

      return {
        success: true,
        results,
        processedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Erro ao processar job de automação', {
        jobId: job.id,
        ticketId,
        event,
        error: error.message,
      });
      throw error;
    }
  },
    {
      connection: redisConnection,
      concurrency: 5, // Processar até 5 jobs simultaneamente
      limiter: {
        max: 20, // Máximo 20 jobs
        duration: 1000, // por segundo
      },
    }
  );

// Event listeners
automationWorker.on('completed', (job) => {
  logger.debug('Job de automação completado', {
    jobId: job.id,
    event: job.data.event,
    ticketId: job.data.ticketId,
  });
});

automationWorker.on('failed', (job, err) => {
  logger.error('Job de automação falhou', {
    jobId: job?.id,
    ticketId: job?.data.ticketId,
    event: job?.data.event,
    error: err.message,
  });
});

automationWorker.on('error', (err) => {
  logger.error('Erro no worker de automação', err);
});

registerWorkerTelemetry('automation', automationWorker);

logger.info('✅ Worker de automação inicializado');
