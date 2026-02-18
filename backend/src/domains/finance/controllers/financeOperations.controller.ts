import { ApprovalEntityType, AssetMovementType, DepreciationMethod } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { financeOperationsService } from '../services/financeOperations.service';

const createCostCenterSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  ownerUserId: z.string().uuid().optional(),
});

const createVendorSchema = z.object({
  name: z.string().min(2),
  taxId: z.string().optional(),
  contactEmail: z.string().email().optional(),
});

const createPurchaseRequestSchema = z.object({
  costCenterId: z.string().uuid(),
  description: z.string().min(3),
  items: z
    .array(
      z.object({
        description: z.string().min(2),
        qty: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().positive(),
        assetCategory: z.string().optional(),
      })
    )
    .min(1),
});

const approvalDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().optional(),
});

const createPurchaseOrderSchema = z.object({
  prId: z.string().uuid().optional(),
  vendorId: z.string().uuid(),
});

const createInvoiceSchema = z.object({
  poId: z.string().uuid().optional(),
  vendorId: z.string().uuid(),
  number: z.string().min(1),
  issueDate: z.coerce.date(),
  totalAmount: z.coerce.number().positive(),
});

const createAssetLedgerSchema = z.object({
  equipmentId: z.string().uuid(),
  costCenterId: z.string().uuid(),
  acquisitionDate: z.coerce.date(),
  acquisitionValue: z.coerce.number().positive(),
  depreciationMethod: z.nativeEnum(DepreciationMethod).optional(),
  usefulLifeMonths: z.coerce.number().int().positive(),
  residualValue: z.coerce.number().min(0).optional(),
});

const assetMovementSchema = z.object({
  equipmentId: z.string().uuid(),
  type: z.nativeEnum(AssetMovementType),
  fromCostCenterId: z.string().uuid().optional(),
  toCostCenterId: z.string().uuid().optional(),
  reason: z.string().min(3),
  metadataJson: z.any().optional(),
});

export const financeOperationsController = {
  async listCostCenters(_req: Request, res: Response) {
    const data = await financeOperationsService.listCostCenters();
    res.json(data);
  },

  async createCostCenter(req: Request, res: Response) {
    const payload = createCostCenterSchema.parse(req.body);
    const data = await financeOperationsService.createCostCenter(payload);
    res.status(201).json(data);
  },

  async listVendors(_req: Request, res: Response) {
    const data = await financeOperationsService.listVendors();
    res.json(data);
  },

  async createVendor(req: Request, res: Response) {
    const payload = createVendorSchema.parse(req.body);
    const data = await financeOperationsService.createVendor(payload);
    res.status(201).json(data);
  },

  async createPurchaseRequest(req: Request, res: Response) {
    const payload = createPurchaseRequestSchema.parse(req.body);
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
    const data = await financeOperationsService.createPurchaseRequest(
      req.userId as string,
      payload,
      idempotencyKey
    );
    res.status(201).json(data);
  },

  async getPurchaseRequest(req: Request, res: Response) {
    const data = await financeOperationsService.getPurchaseRequest(req.params.prId);
    res.json(data);
  },

  async decidePrApproval(req: Request, res: Response) {
    const payload = approvalDecisionSchema.parse(req.body);
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
    const data = await financeOperationsService.decideApproval(
      req.userId as string,
      {
        entityType: ApprovalEntityType.PR,
        entityId: req.params.prId,
        decision: payload.decision,
        notes: payload.notes,
      },
      idempotencyKey
    );
    res.json(data);
  },

  async createPurchaseOrder(req: Request, res: Response) {
    const payload = createPurchaseOrderSchema.parse(req.body);
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
    const data = await financeOperationsService.createPurchaseOrder(
      req.userId as string,
      payload,
      idempotencyKey
    );
    res.status(201).json(data);
  },

  async decidePoApproval(req: Request, res: Response) {
    const payload = approvalDecisionSchema.parse(req.body);
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
    const data = await financeOperationsService.decideApproval(
      req.userId as string,
      {
        entityType: ApprovalEntityType.PO,
        entityId: req.params.poId,
        decision: payload.decision,
        notes: payload.notes,
      },
      idempotencyKey
    );
    res.json(data);
  },

  async createInvoice(req: Request, res: Response) {
    const payload = createInvoiceSchema.parse(req.body);
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
    const data = await financeOperationsService.createInvoice(
      req.userId as string,
      payload,
      idempotencyKey
    );
    res.status(201).json(data);
  },

  async decideInvoiceApproval(req: Request, res: Response) {
    const payload = approvalDecisionSchema.parse(req.body);
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
    const data = await financeOperationsService.decideApproval(
      req.userId as string,
      {
        entityType: ApprovalEntityType.INVOICE,
        entityId: req.params.invoiceId,
        decision: payload.decision,
        notes: payload.notes,
      },
      idempotencyKey
    );
    res.json(data);
  },

  async listApprovals(req: Request, res: Response) {
    const entityType = z.nativeEnum(ApprovalEntityType).parse(req.query.entityType);
    const entityId = z.string().uuid().parse(req.query.entityId);
    const data = await financeOperationsService.listApprovals(entityType, entityId);
    res.json(data);
  },

  async createAssetLedger(req: Request, res: Response) {
    const payload = createAssetLedgerSchema.parse(req.body);
    const data = await financeOperationsService.createAssetLedger(payload);
    res.status(201).json(data);
  },

  async listAssetLedgers(_req: Request, res: Response) {
    const data = await financeOperationsService.listAssetLedgers();
    res.json(data);
  },

  async registerAssetMovement(req: Request, res: Response) {
    const payload = assetMovementSchema.parse(req.body);
    const data = await financeOperationsService.registerAssetMovement(req.userId as string, payload);
    res.status(201).json(data);
  },

  async depreciationReport(_req: Request, res: Response) {
    const data = await financeOperationsService.getDepreciationReport();
    res.json(data);
  },
};
