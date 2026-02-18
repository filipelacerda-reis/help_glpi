import prisma from '../../lib/prisma';
import { initializeQueues, closeQueues } from '../../lib/queue';
import { auditEventPipelineService } from '../../domains/compliance/services/auditEventPipeline.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('audit pipeline', () => {
  beforeAll(async () => {
    await initializeQueues();
    await import('../../workers/audit.worker');
  });

  afterAll(async () => {
    await closeQueues();
  });

  it('deve enfileirar e persistir evento de auditoria', async () => {
    const requestId = `test-audit-${Date.now()}`;

    await auditEventPipelineService.enqueue({
      actorEmail: 'audit-test@example.com',
      requestId,
      correlationId: requestId,
      domain: 'hr',
      action: 'Employee.create',
      resourceType: 'Employee',
      resourceId: 'resource-1',
      beforeJson: null,
      afterJson: { id: 'resource-1', name: 'Employee Test' },
      metadataJson: { source: 'test' },
      idempotencyKey: `audit-test:${requestId}`,
    });

    let found = null as any;
    for (let i = 0; i < 30; i += 1) {
      found = await prisma.auditEvent.findFirst({
        where: { requestId, action: 'Employee.create' },
      });
      if (found) break;
      await sleep(200);
    }

    expect(found).toBeTruthy();
    expect(found.requestId).toBe(requestId);
    expect(found.resourceType).toBe('Employee');
    expect(found.resourceId).toBe('resource-1');
    expect(found.actorEmail).toBe('audit-test@example.com');
  });
});
