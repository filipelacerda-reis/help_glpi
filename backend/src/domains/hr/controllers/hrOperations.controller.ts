import { HrCaseStatus, HrCaseType, HrTaskStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { hrOperationsService } from '../services/hrOperations.service';

const caseFiltersSchema = z.object({
  type: z.nativeEnum(HrCaseType).optional(),
  status: z.nativeEnum(HrCaseStatus).optional(),
  employeeId: z.string().uuid().optional(),
});

const createOnboardingSchema = z.object({
  employeeId: z.string().uuid(),
  ownerUserId: z.string().uuid().optional(),
  startAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
  metadataJson: z.any().optional(),
});

const createOffboardingSchema = z.object({
  employeeId: z.string().uuid(),
  ownerUserId: z.string().uuid().optional(),
  startAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
  terminationDate: z.coerce.date(),
  metadataJson: z.any().optional(),
});

const updateTaskSchema = z.object({
  status: z.nativeEnum(HrTaskStatus).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  evidenceUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const createPolicySchema = z.object({
  key: z.string().min(2),
  title: z.string().min(2),
  version: z.string().min(1),
  contentUrl: z.string().url(),
  active: z.boolean().optional(),
});

const acknowledgePolicySchema = z.object({
  employeeId: z.string().uuid().optional(),
  metadataJson: z.any().optional(),
});

export const hrOperationsController = {
  async listCases(req: Request, res: Response) {
    const filters = caseFiltersSchema.parse(req.query);
    const data = await hrOperationsService.listCases(filters);
    res.json(data);
  },

  async getCaseDetails(req: Request, res: Response) {
    const type = z.nativeEnum(HrCaseType).parse(req.params.caseType);
    const caseId = z.string().uuid().parse(req.params.caseId);
    const data = await hrOperationsService.getCaseDetails(type, caseId);
    res.json(data);
  },

  async createOnboardingCase(req: Request, res: Response) {
    const payload = createOnboardingSchema.parse(req.body);
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
    const data = await hrOperationsService.createOnboardingCase({
      ...payload,
      idempotencyKey,
    });
    res.status(201).json(data);
  },

  async createOffboardingCase(req: Request, res: Response) {
    const payload = createOffboardingSchema.parse(req.body);
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
    const data = await hrOperationsService.createOffboardingCase(
      {
        ...payload,
        idempotencyKey,
      },
      req.userId
    );
    res.status(201).json(data);
  },

  async updateTask(req: Request, res: Response) {
    const taskId = z.string().uuid().parse(req.params.taskId);
    const payload = updateTaskSchema.parse(req.body);
    const data = await hrOperationsService.updateTask(taskId, payload);
    res.json(data);
  },

  async listPolicies(req: Request, res: Response) {
    const activeOnly = req.query.activeOnly !== 'false';
    const data = await hrOperationsService.listPolicies(activeOnly);
    res.json(data);
  },

  async createPolicy(req: Request, res: Response) {
    const payload = createPolicySchema.parse(req.body);
    const data = await hrOperationsService.createPolicy(payload);
    res.status(201).json(data);
  },

  async acknowledgePolicy(req: Request, res: Response) {
    const policyId = z.string().uuid().parse(req.params.policyId);
    const payload = acknowledgePolicySchema.parse(req.body || {});

    const employeeId = payload.employeeId || req.userAttributes?.employeeId || undefined;
    if (!employeeId) {
      res.status(400).json({ error: 'employeeId é obrigatório para registrar aceite' });
      return;
    }

    const data = await hrOperationsService.acknowledgePolicy({
      policyId,
      employeeId,
      acknowledgedByUserId: req.userId,
      metadataJson: payload.metadataJson,
    });

    res.status(201).json(data);
  },
};
