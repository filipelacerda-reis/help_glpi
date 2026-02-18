import { randomUUID } from 'crypto';
import { auditQueue } from '../../../lib/queue';
import { logger } from '../../../utils/logger';

export type EnqueueAuditEventInput = {
  actorUserId?: string;
  actorEmail?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  correlationId?: string;
  domain: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadataJson?: unknown;
  idempotencyKey?: string;
};

const toSerializable = (value: unknown): unknown => {
  if (value === undefined) return null;
  return JSON.parse(
    JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') return val.toString();
      if (val instanceof Date) return val.toISOString();
      return val;
    })
  );
};

export const auditEventPipelineService = {
  async enqueue(input: EnqueueAuditEventInput) {
    if (!auditQueue) {
      logger.warn('Fila audit-log indisponível; evento não enfileirado', {
        domain: input.domain,
        action: input.action,
        requestId: input.requestId,
      });
      return;
    }

    const id = randomUUID();
    const rawJobId = input.idempotencyKey || `audit_${id}`;
    const jobId = rawJobId.replace(/[^a-zA-Z0-9_-]/g, '_');

    await auditQueue.add(
      'audit-event',
      {
        id,
        ts: new Date().toISOString(),
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
        ip: input.ip,
        userAgent: input.userAgent,
        requestId: input.requestId,
        correlationId: input.correlationId || input.requestId,
        domain: input.domain,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        beforeJson: toSerializable(input.beforeJson),
        afterJson: toSerializable(input.afterJson),
        metadataJson: toSerializable(input.metadataJson),
      },
      {
        jobId,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
  },
};
