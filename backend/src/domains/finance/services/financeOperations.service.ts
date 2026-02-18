import {
  Prisma,
  ApprovalEntityType,
  ApprovalStatus,
  AssetLedgerStatus,
  AssetMovementType,
  DepreciationMethod,
  InvoiceStatus,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
} from '@prisma/client';
import prisma from '../../../lib/prisma';
import { AppError } from '../../../middleware/errorHandler';

const toNumber = (value: unknown) => Number(value || 0);

const getFinanceApproverId = async (db: Prisma.TransactionClient | typeof prisma = prisma) => {
  const financeUser = await db.user.findFirst({
    where: {
      roleAssignments: {
        some: {
          role: {
            name: 'FINANCE',
          },
        },
      },
    },
    select: { id: true },
  });
  if (financeUser) return financeUser.id;

  const admin = await db.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  return admin?.id || null;
};

const createApprovalChain = async (input: {
  db: Prisma.TransactionClient | typeof prisma;
  entityType: ApprovalEntityType;
  entityId: string;
  requesterUserId: string;
  idempotencyPrefix: string;
}) => {
  const requesterAttributes = await input.db.userAttribute.findUnique({
    where: { userId: input.requesterUserId },
    select: { managerUserId: true },
  });

  const financeApproverId = await getFinanceApproverId(input.db);
  const approvers: string[] = [];

  if (
    requesterAttributes?.managerUserId &&
    requesterAttributes.managerUserId !== input.requesterUserId
  ) {
    approvers.push(requesterAttributes.managerUserId);
  }

  if (financeApproverId && !approvers.includes(financeApproverId)) {
    approvers.push(financeApproverId);
  }

  if (approvers.length === 0) {
    throw new AppError('Não foi possível determinar aprovadores para o fluxo', 400);
  }

  let step = 1;
  for (const approverUserId of approvers) {
    await input.db.approval.upsert({
      where: { idempotencyKey: `${input.idempotencyPrefix}:step:${step}` },
      update: {},
      create: {
        entityType: input.entityType,
        entityId: input.entityId,
        step,
        approverUserId,
        status: ApprovalStatus.PENDING,
        idempotencyKey: `${input.idempotencyPrefix}:step:${step}`,
      },
    });
    step += 1;
  }
};

const getPendingApprovalForActor = async (
  db: Prisma.TransactionClient | typeof prisma,
  entityType: ApprovalEntityType,
  entityId: string,
  actorUserId: string
) => {
  const pending = await db.approval.findMany({
    where: {
      entityType,
      entityId,
      status: ApprovalStatus.PENDING,
    },
    orderBy: { step: 'asc' },
  });

  if (pending.length === 0) {
    throw new AppError('Não há aprovações pendentes para este item', 400);
  }

  const currentStep = pending[0].step;
  const actorApproval = pending.find(
    (item) => item.step === currentStep && item.approverUserId === actorUserId
  );

  if (!actorApproval) {
    throw new AppError('Usuário não é aprovador da etapa atual', 403);
  }

  return actorApproval;
};

const concludeEntityByApprovals = async (
  db: Prisma.TransactionClient | typeof prisma,
  entityType: ApprovalEntityType,
  entityId: string,
  actorUserId: string
) => {
  const pendingCount = await db.approval.count({
    where: {
      entityType,
      entityId,
      status: ApprovalStatus.PENDING,
    },
  });

  if (pendingCount > 0) return;

  if (entityType === ApprovalEntityType.PR) {
    await db.purchaseRequest.update({
      where: { id: entityId },
      data: { status: PurchaseRequestStatus.APPROVED },
    });
    return;
  }

  if (entityType === ApprovalEntityType.PO) {
    await db.purchaseOrder.update({
      where: { id: entityId },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: actorUserId,
      },
    });
    return;
  }

  if (entityType === ApprovalEntityType.INVOICE) {
    await db.invoice.update({
      where: { id: entityId },
      data: { status: InvoiceStatus.APPROVED },
    });
  }
};

export const financeOperationsService = {
  async listCostCenters() {
    return prisma.costCenter.findMany({ orderBy: { code: 'asc' } });
  },

  async createCostCenter(input: { code: string; name: string; ownerUserId?: string }) {
    return prisma.costCenter.create({
      data: {
        code: input.code,
        name: input.name,
        ownerUserId: input.ownerUserId || null,
      },
    });
  },

  async listVendors() {
    return prisma.vendor.findMany({ orderBy: { name: 'asc' } });
  },

  async createVendor(input: { name: string; taxId?: string; contactEmail?: string }) {
    return prisma.vendor.create({
      data: {
        name: input.name,
        taxId: input.taxId || null,
        contactEmail: input.contactEmail || null,
      },
    });
  },

  async createPurchaseRequest(
    requesterUserId: string,
    input: {
      costCenterId: string;
      description: string;
      items: Array<{ description: string; qty: number; unitPrice: number; assetCategory?: string }>;
    },
    idempotencyKey?: string
  ) {
    if (!input.items?.length) {
      throw new AppError('Purchase Request deve conter pelo menos um item', 400);
    }

    if (idempotencyKey) {
      const existing = await prisma.purchaseRequest.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      });
      if (existing) return existing;
    }

    const costCenter = await prisma.costCenter.findUnique({ where: { id: input.costCenterId } });
    if (!costCenter) throw new AppError('Centro de custo não encontrado', 404);

    const totalAmount = input.items.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);

    return prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequest.create({
        data: {
          requesterUserId,
          costCenterId: input.costCenterId,
          description: input.description,
          status: PurchaseRequestStatus.SUBMITTED,
          totalAmount,
          idempotencyKey,
        },
      });

      for (const item of input.items) {
        await tx.purchaseRequestItem.create({
          data: {
            prId: pr.id,
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            assetCategory: item.assetCategory || null,
          },
        });
      }

      await createApprovalChain({
        db: tx,
        entityType: ApprovalEntityType.PR,
        entityId: pr.id,
        requesterUserId,
        idempotencyPrefix: `approval:pr:${pr.id}`,
      });

      return tx.purchaseRequest.findUnique({
        where: { id: pr.id },
        include: { items: true },
      });
    });
  },

  async getPurchaseRequest(id: string) {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        costCenter: true,
        items: true,
      },
    });
    if (!pr) throw new AppError('Purchase Request não encontrado', 404);
    return pr;
  },

  async decideApproval(
    actorUserId: string,
    input: {
      entityType: ApprovalEntityType;
      entityId: string;
      decision: 'APPROVE' | 'REJECT';
      notes?: string;
    },
    idempotencyKey?: string
  ) {
    if (idempotencyKey) {
      const existing = await prisma.approval.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    return prisma.$transaction(async (tx) => {
      const pendingApproval = await getPendingApprovalForActor(
        tx,
        input.entityType,
        input.entityId,
        actorUserId
      );

      const updated = await tx.approval.update({
        where: { id: pendingApproval.id },
        data: {
          status: input.decision === 'APPROVE' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
          decidedAt: new Date(),
          decisionNotes: input.notes || null,
          idempotencyKey,
        },
      });

      if (input.decision === 'REJECT') {
        if (input.entityType === ApprovalEntityType.PR) {
          await tx.purchaseRequest.update({
            where: { id: input.entityId },
            data: { status: PurchaseRequestStatus.REJECTED },
          });
        } else if (input.entityType === ApprovalEntityType.PO) {
          await tx.purchaseOrder.update({
            where: { id: input.entityId },
            data: { status: PurchaseOrderStatus.REJECTED },
          });
        } else if (input.entityType === ApprovalEntityType.INVOICE) {
          await tx.invoice.update({
            where: { id: input.entityId },
            data: { status: InvoiceStatus.REJECTED },
          });
        }

        await tx.approval.updateMany({
          where: {
            entityType: input.entityType,
            entityId: input.entityId,
            status: ApprovalStatus.PENDING,
          },
          data: {
            status: ApprovalStatus.REJECTED,
            decidedAt: new Date(),
            decisionNotes: 'Auto-rejeitado após rejeição em etapa anterior',
          },
        });

        return updated;
      }

      await concludeEntityByApprovals(tx, input.entityType, input.entityId, actorUserId);
      return updated;
    });
  },

  async createPurchaseOrder(
    actorUserId: string,
    input: { prId?: string; vendorId: string },
    idempotencyKey?: string
  ) {
    if (idempotencyKey) {
      const existing = await prisma.purchaseOrder.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId } });
    if (!vendor) throw new AppError('Fornecedor não encontrado', 404);

    let pr = null as any;
    if (input.prId) {
      pr = await prisma.purchaseRequest.findUnique({
        where: { id: input.prId },
        include: { requester: true },
      });
      if (!pr) throw new AppError('Purchase Request não encontrado', 404);
      if (pr.status !== PurchaseRequestStatus.APPROVED) {
        throw new AppError('Purchase Request precisa estar aprovada para gerar PO', 400);
      }
    }

    const requesterUserId = pr?.requesterUserId || actorUserId;
    const totalAmount = pr ? toNumber(pr.totalAmount) : 0;

    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          prId: input.prId || null,
          vendorId: input.vendorId,
          status: PurchaseOrderStatus.DRAFT,
          totalAmount,
          idempotencyKey,
        },
      });

      if (input.prId) {
        await tx.purchaseRequest.update({
          where: { id: input.prId },
          data: { status: PurchaseRequestStatus.CONVERTED_TO_PO },
        });
      }

      await createApprovalChain({
        db: tx,
        entityType: ApprovalEntityType.PO,
        entityId: po.id,
        requesterUserId,
        idempotencyPrefix: `approval:po:${po.id}`,
      });

      return tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: { vendor: true, purchaseRequest: true },
      });
    });
  },

  async createInvoice(
    actorUserId: string,
    input: {
      poId?: string;
      vendorId: string;
      number: string;
      issueDate: Date;
      totalAmount: number;
    },
    idempotencyKey?: string
  ) {
    if (idempotencyKey) {
      const existing = await prisma.invoice.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId } });
    if (!vendor) throw new AppError('Fornecedor não encontrado', 404);

    let requesterUserId = actorUserId;
    if (input.poId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: input.poId },
        include: { purchaseRequest: true },
      });
      if (!po) throw new AppError('PO não encontrada', 404);
      if (po.purchaseRequest?.requesterUserId) requesterUserId = po.purchaseRequest.requesterUserId;
    }

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          poId: input.poId || null,
          vendorId: input.vendorId,
          number: input.number,
          issueDate: input.issueDate,
          totalAmount: input.totalAmount,
          status: InvoiceStatus.REGISTERED,
          idempotencyKey,
        },
      });

      await createApprovalChain({
        db: tx,
        entityType: ApprovalEntityType.INVOICE,
        entityId: invoice.id,
        requesterUserId,
        idempotencyPrefix: `approval:invoice:${invoice.id}`,
      });

      return invoice;
    });
  },

  async listApprovals(entityType: ApprovalEntityType, entityId: string) {
    return prisma.approval.findMany({
      where: { entityType, entityId },
      orderBy: { step: 'asc' },
      include: { approver: { select: { id: true, name: true, email: true } } },
    });
  },

  async createAssetLedger(input: {
    equipmentId: string;
    costCenterId: string;
    acquisitionDate: Date;
    acquisitionValue: number;
    depreciationMethod?: DepreciationMethod;
    usefulLifeMonths: number;
    residualValue?: number;
  }) {
    const equipment = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
    if (!equipment) throw new AppError('Equipamento não encontrado', 404);

    const costCenter = await prisma.costCenter.findUnique({ where: { id: input.costCenterId } });
    if (!costCenter) throw new AppError('Centro de custo não encontrado', 404);

    return prisma.assetLedger.upsert({
      where: { equipmentId: input.equipmentId },
      update: {
        acquisitionDate: input.acquisitionDate,
        acquisitionValue: input.acquisitionValue,
        depreciationMethod: input.depreciationMethod || DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: input.usefulLifeMonths,
        residualValue: input.residualValue || 0,
        costCenterId: input.costCenterId,
      },
      create: {
        equipmentId: input.equipmentId,
        acquisitionDate: input.acquisitionDate,
        acquisitionValue: input.acquisitionValue,
        depreciationMethod: input.depreciationMethod || DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: input.usefulLifeMonths,
        residualValue: input.residualValue || 0,
        costCenterId: input.costCenterId,
      },
    });
  },

  async registerAssetMovement(
    actorUserId: string,
    input: {
      equipmentId: string;
      type: AssetMovementType;
      fromCostCenterId?: string;
      toCostCenterId?: string;
      reason: string;
      metadataJson?: unknown;
    }
  ) {
    const ledger = await prisma.assetLedger.findUnique({ where: { equipmentId: input.equipmentId } });
    if (!ledger) throw new AppError('Ledger do ativo não encontrado', 404);

    return prisma.$transaction(async (tx) => {
      const movement = await tx.assetMovement.create({
        data: {
          equipmentId: input.equipmentId,
          assetLedgerId: ledger.id,
          type: input.type,
          fromCostCenterId: input.fromCostCenterId || null,
          toCostCenterId: input.toCostCenterId || null,
          reason: input.reason,
          actorUserId,
          metadataJson: (input.metadataJson as any) || null,
        },
      });

      if (input.type === AssetMovementType.TRANSFER && input.toCostCenterId) {
        await tx.assetLedger.update({
          where: { id: ledger.id },
          data: {
            costCenterId: input.toCostCenterId,
            status: AssetLedgerStatus.TRANSFERRED,
          },
        });
      }

      if (input.type === AssetMovementType.WRITE_OFF) {
        await tx.assetLedger.update({
          where: { id: ledger.id },
          data: { status: AssetLedgerStatus.WRITTEN_OFF },
        });
      }

      if (input.type === AssetMovementType.LOSS) {
        await tx.assetLedger.update({
          where: { id: ledger.id },
          data: { status: AssetLedgerStatus.LOST },
        });
      }

      return movement;
    });
  },

  async listAssetLedgers() {
    return prisma.assetLedger.findMany({
      include: {
        equipment: true,
        costCenter: true,
        movements: {
          orderBy: { ts: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getDepreciationReport() {
    const ledgers = await prisma.assetLedger.findMany({
      include: { equipment: true, costCenter: true },
      orderBy: { acquisitionDate: 'asc' },
    });

    const now = new Date();

    return ledgers.map((ledger) => {
      const acquisitionValue = toNumber(ledger.acquisitionValue);
      const residualValue = toNumber(ledger.residualValue);
      const depreciableBase = Math.max(0, acquisitionValue - residualValue);
      const monthlyDepreciation =
        ledger.usefulLifeMonths > 0 ? depreciableBase / ledger.usefulLifeMonths : 0;

      const monthsElapsed = Math.max(
        0,
        (now.getFullYear() - ledger.acquisitionDate.getFullYear()) * 12 +
          (now.getMonth() - ledger.acquisitionDate.getMonth())
      );
      const accumulatedDepreciation = Math.min(
        depreciableBase,
        monthlyDepreciation * monthsElapsed
      );
      const bookValue = acquisitionValue - accumulatedDepreciation;

      return {
        ledgerId: ledger.id,
        equipmentId: ledger.equipmentId,
        assetTag: ledger.equipment.assetTag,
        costCenter: {
          id: ledger.costCenter.id,
          code: ledger.costCenter.code,
          name: ledger.costCenter.name,
        },
        acquisitionDate: ledger.acquisitionDate,
        acquisitionValue,
        residualValue,
        usefulLifeMonths: ledger.usefulLifeMonths,
        depreciationMethod: ledger.depreciationMethod,
        monthlyDepreciation,
        monthsElapsed,
        accumulatedDepreciation,
        bookValue,
        status: ledger.status,
      };
    });
  },
};
