import { Job, Worker } from 'bullmq';
import { HrCaseType, HrTaskStatus, TicketPriority, TicketStatus, TicketType } from '@prisma/client';
import prisma from '../lib/prisma';
import { hrWorkflowDlqQueue, isRedisAvailable, redisConnection } from '../lib/queue';
import { logger } from '../utils/logger';
import { registerWorkerTelemetry } from '../shared/observability/queueTelemetry';

type HrWorkflowJobData = {
  kind: 'OFFBOARDING_INITIALIZE';
  caseId: string;
  actorUserId?: string;
  requestId?: string;
  correlationId?: string;
};

if (!redisConnection || !isRedisAvailable()) {
  throw new Error('Redis não disponível. Worker HR workflow não pode ser criado.');
}

const createOffboardingTasks = async (caseId: string, actorUserId?: string) => {
  const offboardingCase = await prisma.offboardingCase.findUnique({
    where: { id: caseId },
    include: {
      employee: true,
    },
  });

  if (!offboardingCase) {
    throw new Error(`OffboardingCase ${caseId} não encontrado`);
  }

  const existingTasks = await prisma.caseTask.count({
    where: {
      caseType: HrCaseType.OFFBOARDING,
      caseId,
    },
  });

  if (existingTasks === 0) {
    const baseTasks = [
      'Revogar acessos corporativos (SSO, email, VPN)',
      'Encerrar pendências administrativas e financeiras',
      'Coletar evidências/documentos do desligamento',
    ];

    for (const title of baseTasks) {
      await prisma.caseTask.create({
        data: {
          caseType: HrCaseType.OFFBOARDING,
          caseId,
          offboardingCaseId: caseId,
          title,
          status: HrTaskStatus.TODO,
          assigneeUserId: offboardingCase.ownerUserId || actorUserId || null,
          dueAt: offboardingCase.dueAt,
        },
      });
    }
  }

  const activeAssignments = await prisma.equipmentAssignment.findMany({
    where: {
      employeeId: offboardingCase.employeeId,
      returnedAt: null,
    },
    include: { equipment: true },
  });

  for (const assignment of activeAssignments) {
    const taskTitle = `Recolher ativo ${assignment.equipment.assetTag} (${assignment.equipment.equipmentType})`;
    const exists = await prisma.caseTask.findFirst({
      where: {
        caseType: HrCaseType.OFFBOARDING,
        caseId,
        title: taskTitle,
      },
      select: { id: true },
    });

    if (!exists) {
      await prisma.caseTask.create({
        data: {
          caseType: HrCaseType.OFFBOARDING,
          caseId,
          offboardingCaseId: caseId,
          title: taskTitle,
          status: HrTaskStatus.TODO,
          assigneeUserId: offboardingCase.ownerUserId || actorUserId || null,
          dueAt: offboardingCase.dueAt,
          metadataJson: {
            equipmentId: assignment.equipmentId,
            assignmentId: assignment.id,
            employeeId: offboardingCase.employeeId,
          },
        },
      });
    }
  }

  if (!offboardingCase.itsmTicketId) {
    const supportTeam = await prisma.team.findFirst({
      where: {
        OR: [
          { name: { contains: 'suporte', mode: 'insensitive' } },
          { name: { contains: 'it', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (supportTeam) {
      const requesterId =
        actorUserId ||
        offboardingCase.ownerUserId ||
        (
          await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            select: { id: true },
          })
        )?.id;

      if (!requesterId) return;

      const ticket = await prisma.ticket.create({
        data: {
          title: `Offboarding: ${offboardingCase.employee.name}`,
          description: `Fluxo de desligamento iniciado para ${offboardingCase.employee.name}.\nData de desligamento: ${offboardingCase.terminationDate.toISOString()}`,
          status: TicketStatus.OPEN,
          priority: TicketPriority.HIGH,
          tipo: TicketType.TASK,
          requesterId,
          teamId: supportTeam.id,
        },
      });

      await prisma.offboardingCase.update({
        where: { id: caseId },
        data: { itsmTicketId: ticket.id },
      });
    }
  }
};

export const hrWorkflowWorker = new Worker<HrWorkflowJobData>(
  'hr-workflow',
  async (job: Job<HrWorkflowJobData>) => {
    if (job.data.kind === 'OFFBOARDING_INITIALIZE') {
      await createOffboardingTasks(job.data.caseId, job.data.actorUserId);
    }
    return { ok: true };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

hrWorkflowWorker.on('failed', async (job, err) => {
  logger.error('Job HR workflow falhou', {
    jobId: job?.id,
    kind: job?.data.kind,
    caseId: job?.data.caseId,
    error: err.message,
  });

  if (!job || !hrWorkflowDlqQueue) return;
  const maxAttempts = Number(job.opts.attempts || 1);
  if (job.attemptsMade < maxAttempts) return;

  await hrWorkflowDlqQueue.add(
    'hr-workflow-failed',
    {
      failedAt: new Date().toISOString(),
      error: err.message,
      originalJobId: job.id,
      payload: job.data,
    },
    {
      jobId: `hr-workflow-dlq-${job.id}`,
      removeOnComplete: false,
      removeOnFail: false,
    }
  );
});

hrWorkflowWorker.on('error', (err) => {
  logger.error('Erro no worker HR workflow', err);
});

registerWorkerTelemetry('hr-workflow', hrWorkflowWorker);

logger.info('✅ Worker HR workflow inicializado');
