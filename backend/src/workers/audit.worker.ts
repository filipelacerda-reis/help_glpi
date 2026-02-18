import { Job, Worker } from 'bullmq';
import prisma from '../lib/prisma';
import { auditDlqQueue, isRedisAvailable, redisConnection } from '../lib/queue';
import { logger } from '../utils/logger';
import { registerWorkerTelemetry } from '../shared/observability/queueTelemetry';

type AuditJobData = {
  id: string;
  ts: string;
  actorUserId?: string;
  actorEmail?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  domain: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadataJson?: unknown;
  correlationId?: string;
};

if (!redisConnection || !isRedisAvailable()) {
  throw new Error('Redis não disponível. Worker de auditoria não pode ser criado.');
}

export const auditWorker = new Worker<AuditJobData>(
  'audit-log',
  async (job: Job<AuditJobData>) => {
    await prisma.auditEvent.create({
      data: {
        id: job.data.id,
        ts: new Date(job.data.ts),
        actorUserId: job.data.actorUserId || null,
        actorEmail: job.data.actorEmail || null,
        ip: job.data.ip || null,
        userAgent: job.data.userAgent || null,
        requestId: job.data.requestId || null,
        domain: job.data.domain,
        action: job.data.action,
        resourceType: job.data.resourceType,
        resourceId: job.data.resourceId || null,
        beforeJson: (job.data.beforeJson as any) ?? null,
        afterJson: (job.data.afterJson as any) ?? null,
        metadataJson: {
          ...(typeof job.data.metadataJson === 'object' && job.data.metadataJson ? job.data.metadataJson as Record<string, unknown> : {}),
          correlationId: job.data.correlationId || job.data.requestId || null,
          jobId: job.id,
        },
      },
    });

    return { ok: true };
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

auditWorker.on('completed', (job) => {
  logger.debug('Audit job concluído', {
    jobId: job.id,
    requestId: job.data.requestId,
    domain: job.data.domain,
    action: job.data.action,
  });
});

auditWorker.on('failed', async (job, err) => {
  logger.error('Audit job falhou', {
    jobId: job?.id,
    error: err.message,
    domain: job?.data.domain,
    action: job?.data.action,
    requestId: job?.data.requestId,
  });

  if (!job || !auditDlqQueue) return;
  const maxAttempts = Number(job.opts.attempts || 1);
  if (job.attemptsMade < maxAttempts) return;

  await auditDlqQueue.add(
    'audit-log-failed',
    {
      failedAt: new Date().toISOString(),
      error: err.message,
      originalJobId: job.id,
      payload: job.data,
    },
    {
      jobId: `audit-dlq:${job.id}`,
      removeOnComplete: false,
      removeOnFail: false,
    }
  );
});

auditWorker.on('error', (err) => {
  logger.error('Erro no worker de auditoria', err);
});

registerWorkerTelemetry('audit-log', auditWorker);

logger.info('✅ Worker de auditoria inicializado');
