import {
  HrCaseStatus,
  HrCaseType,
  HrTaskStatus,
} from '@prisma/client';
import prisma from '../../../lib/prisma';
import { hrWorkflowQueue } from '../../../lib/queue';
import { AppError } from '../../../middleware/errorHandler';
import { requestContextStore } from '../../../shared/http/requestContext.store';

type CreateOnboardingInput = {
  employeeId: string;
  ownerUserId?: string;
  startAt?: Date;
  dueAt?: Date;
  metadataJson?: unknown;
  idempotencyKey?: string;
};

type CreateOffboardingInput = {
  employeeId: string;
  ownerUserId?: string;
  startAt?: Date;
  dueAt?: Date;
  terminationDate: Date;
  metadataJson?: unknown;
  idempotencyKey?: string;
};

type UpdateTaskInput = {
  status?: HrTaskStatus;
  assigneeUserId?: string | null;
  dueAt?: Date | null;
  completedAt?: Date | null;
  evidenceUrl?: string | null;
  notes?: string | null;
};

const ONBOARDING_TEMPLATE_TASKS = [
  'Provisionar conta corporativa e acessos iniciais',
  'Entregar kit de equipamentos e registrar aceite',
  'Aplicar treinamentos obrigatórios e políticas',
];

export const hrOperationsService = {
  async listCases(filters: { type?: HrCaseType; status?: HrCaseStatus; employeeId?: string }) {
    if (!filters.type || filters.type === HrCaseType.ONBOARDING) {
      const onboarding = await prisma.onboardingCase.findMany({
        where: {
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        },
        include: {
          employee: { select: { id: true, name: true, roleTitle: true } },
          owner: { select: { id: true, name: true, email: true } },
          tasks: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (filters.type === HrCaseType.ONBOARDING) {
        return onboarding.map((item) => ({ ...item, type: HrCaseType.ONBOARDING }));
      }

      const offboarding = await prisma.offboardingCase.findMany({
        where: {
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        },
        include: {
          employee: { select: { id: true, name: true, roleTitle: true } },
          owner: { select: { id: true, name: true, email: true } },
          tasks: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return [
        ...onboarding.map((item) => ({ ...item, type: HrCaseType.ONBOARDING })),
        ...offboarding.map((item) => ({ ...item, type: HrCaseType.OFFBOARDING })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const offboarding = await prisma.offboardingCase.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      },
      include: {
        employee: { select: { id: true, name: true, roleTitle: true } },
        owner: { select: { id: true, name: true, email: true } },
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return offboarding.map((item) => ({ ...item, type: HrCaseType.OFFBOARDING }));
  },

  async getCaseDetails(type: HrCaseType, caseId: string) {
    if (type === HrCaseType.ONBOARDING) {
      const item = await prisma.onboardingCase.findUnique({
        where: { id: caseId },
        include: {
          employee: true,
          owner: { select: { id: true, name: true, email: true } },
          tasks: { include: { assignee: { select: { id: true, name: true, email: true } } } },
        },
      });
      if (!item) throw new AppError('Onboarding case não encontrado', 404);
      return { ...item, type };
    }

    const item = await prisma.offboardingCase.findUnique({
      where: { id: caseId },
      include: {
        employee: true,
        owner: { select: { id: true, name: true, email: true } },
        tasks: { include: { assignee: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!item) throw new AppError('Offboarding case não encontrado', 404);
    return { ...item, type };
  },

  async createOnboardingCase(input: CreateOnboardingInput) {
    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) throw new AppError('Funcionário não encontrado', 404);

    if (input.idempotencyKey) {
      const existing = await prisma.onboardingCase.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { tasks: true },
      });
      if (existing) return existing;
    }

    return prisma.$transaction(async (tx) => {
      const onboardingCase = await tx.onboardingCase.create({
        data: {
          employeeId: input.employeeId,
          ownerUserId: input.ownerUserId || null,
          startAt: input.startAt || new Date(),
          dueAt: input.dueAt || null,
          metadataJson: (input.metadataJson as any) || null,
          idempotencyKey: input.idempotencyKey,
        },
      });

      for (const title of ONBOARDING_TEMPLATE_TASKS) {
        await tx.caseTask.create({
          data: {
            caseType: HrCaseType.ONBOARDING,
            caseId: onboardingCase.id,
            onboardingCaseId: onboardingCase.id,
            title,
            status: HrTaskStatus.TODO,
            assigneeUserId: onboardingCase.ownerUserId,
            dueAt: onboardingCase.dueAt,
          },
        });
      }

      return tx.onboardingCase.findUnique({
        where: { id: onboardingCase.id },
        include: { tasks: true },
      });
    });
  },

  async createOffboardingCase(input: CreateOffboardingInput, actorUserId?: string) {
    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) throw new AppError('Funcionário não encontrado', 404);

    if (input.idempotencyKey) {
      const existing = await prisma.offboardingCase.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { tasks: true },
      });
      if (existing) return existing;
    }

    const offboardingCase = await prisma.offboardingCase.create({
      data: {
        employeeId: input.employeeId,
        ownerUserId: input.ownerUserId || null,
        startAt: input.startAt || new Date(),
        dueAt: input.dueAt || null,
        terminationDate: input.terminationDate,
        metadataJson: (input.metadataJson as any) || null,
        idempotencyKey: input.idempotencyKey,
      },
      include: { tasks: true },
    });

    if (hrWorkflowQueue) {
      const context = requestContextStore.get();
      await hrWorkflowQueue.add(
        'offboarding-initialize',
        {
          kind: 'OFFBOARDING_INITIALIZE',
          caseId: offboardingCase.id,
          actorUserId: actorUserId || input.ownerUserId,
          requestId: context?.requestId,
          correlationId: context?.correlationId,
        },
        {
          jobId: `offboarding_init_${offboardingCase.id}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
        }
      );
    }

    return offboardingCase;
  },

  async updateTask(taskId: string, data: UpdateTaskInput) {
    const current = await prisma.caseTask.findUnique({ where: { id: taskId } });
    if (!current) throw new AppError('Task não encontrada', 404);

    return prisma.caseTask.update({
      where: { id: taskId },
      data: {
        ...data,
        completedAt:
          data.status === HrTaskStatus.DONE
            ? data.completedAt || new Date()
            : data.status
              ? null
              : data.completedAt,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async listPolicies(activeOnly = true) {
    return prisma.policy.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  },

  async createPolicy(input: { key: string; title: string; version: string; contentUrl: string; active?: boolean }) {
    return prisma.policy.upsert({
      where: { key: input.key },
      update: {
        title: input.title,
        version: input.version,
        contentUrl: input.contentUrl,
        active: input.active ?? true,
      },
      create: {
        key: input.key,
        title: input.title,
        version: input.version,
        contentUrl: input.contentUrl,
        active: input.active ?? true,
      },
    });
  },

  async acknowledgePolicy(input: {
    policyId: string;
    employeeId: string;
    acknowledgedByUserId?: string;
    metadataJson?: unknown;
  }) {
    const policy = await prisma.policy.findUnique({ where: { id: input.policyId } });
    if (!policy) throw new AppError('Política não encontrada', 404);

    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) throw new AppError('Funcionário não encontrado', 404);

    return prisma.policyAcknowledgement.upsert({
      where: {
        policyId_employeeId: {
          policyId: input.policyId,
          employeeId: input.employeeId,
        },
      },
      update: {
        acknowledgedAt: new Date(),
        acknowledgedByUserId: input.acknowledgedByUserId || null,
        metadataJson: (input.metadataJson as any) || null,
      },
      create: {
        policyId: input.policyId,
        employeeId: input.employeeId,
        acknowledgedByUserId: input.acknowledgedByUserId || null,
        metadataJson: (input.metadataJson as any) || null,
      },
    });
  },
};
