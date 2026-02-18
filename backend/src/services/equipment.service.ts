import {
  DeliveryStatus,
  EquipmentCondition,
  EquipmentStatus,
  EquipmentType,
  Prisma,
  StockMovementType,
} from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export interface CreateEquipmentDto {
  invoiceNumber: string;
  purchaseDate: Date;
  equipmentType: EquipmentType;
  assetTag: string;
  value: number;
  serialNumber?: string;
  brand?: string;
  model?: string;
  status?: EquipmentStatus;
  condition?: EquipmentCondition;
  warrantyEndDate?: Date | null;
  notes?: string;
}

export interface UpdateEquipmentDto {
  invoiceNumber?: string;
  purchaseDate?: Date;
  equipmentType?: EquipmentType;
  assetTag?: string;
  value?: number;
  serialNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  status?: EquipmentStatus;
  condition?: EquipmentCondition;
  warrantyEndDate?: Date | null;
  notes?: string | null;
}

export interface AssignEquipmentDto {
  employeeId: string;
  assignedAt?: Date;
  expectedReturnAt?: Date | null;
  deliveryCondition?: EquipmentCondition;
  deliveryTermNumber?: string;
  createDelivery?: boolean;
  deliveryScheduledAt?: Date | null;
  deliveryCourier?: string;
  deliveryTracking?: string;
  deliveryProofUrl?: string;
  notes?: string;
}

export interface ReturnAssignmentDto {
  returnedAt?: Date;
  returnCondition?: EquipmentCondition;
  finalStatus?: EquipmentStatus;
  stockLocationId?: string;
  notes?: string;
}

export interface CreateStockLocationDto {
  name: string;
  active?: boolean;
}

export interface CreateStockMovementDto {
  equipmentId: string;
  type: StockMovementType;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  notes?: string;
  metadataJson?: unknown;
}

export interface UpdateDeliveryDto {
  status?: DeliveryStatus;
  scheduledAt?: Date | null;
  deliveredAt?: Date | null;
  courier?: string | null;
  tracking?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
}

export interface EquipmentDashboardData {
  totalEquipments: number;
  totalValue: number;
  assignedCount: number;
  inStockCount: number;
  maintenanceCount: number;
  retiredOrLostCount: number;
  expiringWarrantyCount: number;
  overdueReturnCount: number;
  byType: Array<{
    equipmentType: EquipmentType;
    count: number;
    totalValue: number;
  }>;
}

export interface EquipmentAlertsData {
  generatedAt: string;
  warrantyExpiring: Array<{
    id: string;
    assetTag: string;
    equipmentType: EquipmentType;
    warrantyEndDate: Date;
    daysToExpire: number;
    assignedTo?: string;
  }>;
  overdueReturns: Array<{
    assignmentId: string;
    assetTag: string;
    equipmentType: EquipmentType;
    employeeName: string;
    expectedReturnAt: Date;
    daysOverdue: number;
  }>;
}

const ensureDefaultStockLocation = async (tx: Prisma.TransactionClient | typeof prisma) => {
  return tx.stockLocation.upsert({
    where: { name: 'Estoque Principal' },
    update: {},
    create: {
      name: 'Estoque Principal',
      active: true,
    },
  });
};

export const equipmentService = {
  async getAll(filters?: {
    status?: EquipmentStatus;
    equipmentType?: EquipmentType;
    query?: string;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.equipmentType) {
      where.equipmentType = filters.equipmentType;
    }
    if (filters?.query) {
      where.OR = [
        { assetTag: { contains: filters.query, mode: 'insensitive' } },
        { invoiceNumber: { contains: filters.query, mode: 'insensitive' } },
        { serialNumber: { contains: filters.query, mode: 'insensitive' } },
        { brand: { contains: filters.query, mode: 'insensitive' } },
        { model: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    return prisma.equipment.findMany({
      where,
      include: {
        assignments: {
          where: { returnedAt: null },
          include: {
            employee: {
              include: {
                team: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string) {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            employee: {
              include: {
                team: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!equipment) {
      throw new AppError('Equipamento não encontrado', 404);
    }

    return equipment;
  },

  async create(data: CreateEquipmentDto) {
    const existing = await prisma.equipment.findUnique({
      where: { assetTag: data.assetTag },
    });
    if (existing) {
      throw new AppError('Já existe um equipamento com este patrimônio', 400);
    }

    return prisma.equipment.create({
      data: {
        ...data,
      },
    });
  },

  async update(id: string, data: UpdateEquipmentDto) {
    const current = await prisma.equipment.findUnique({ where: { id } });
    if (!current) {
      throw new AppError('Equipamento não encontrado', 404);
    }

    if (data.assetTag && data.assetTag !== current.assetTag) {
      const existing = await prisma.equipment.findUnique({
        where: { assetTag: data.assetTag },
      });
      if (existing && existing.id !== id) {
        throw new AppError('Já existe um equipamento com este patrimônio', 400);
      }
    }

    if (data.status === EquipmentStatus.ASSIGNED) {
      throw new AppError(
        'Para atribuir equipamento, use a funcionalidade de entrega',
        400
      );
    }

    return prisma.equipment.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    const equipment = await prisma.equipment.findUnique({ where: { id } });
    if (!equipment) {
      throw new AppError('Equipamento não encontrado', 404);
    }

    const activeAssignment = await prisma.equipmentAssignment.findFirst({
      where: { equipmentId: id, returnedAt: null },
    });
    if (activeAssignment) {
      throw new AppError(
        'Não é possível remover equipamento com entrega ativa',
        400
      );
    }

    await prisma.equipment.delete({ where: { id } });
  },

  async assignEquipment(equipmentId: string, data: AssignEquipmentDto, actorUserId?: string) {
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
    });
    if (!equipment) {
      throw new AppError('Equipamento não encontrado', 404);
    }

    if (
      equipment.status === EquipmentStatus.LOST ||
      equipment.status === EquipmentStatus.RETIRED
    ) {
      throw new AppError('Equipamento indisponível para entrega', 400);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    });
    if (!employee) {
      throw new AppError('Funcionário não encontrado', 404);
    }
    if (!employee.active) {
      throw new AppError('Funcionário inativo não pode receber equipamentos', 400);
    }

    const activeAssignment = await prisma.equipmentAssignment.findFirst({
      where: { equipmentId, returnedAt: null },
    });
    if (activeAssignment) {
      throw new AppError('Equipamento já está entregue para outro funcionário', 400);
    }

    const assignedAt = data.assignedAt || new Date();

    return prisma.$transaction(async (tx) => {
      const stockLocation = await ensureDefaultStockLocation(tx);
      const assignment = await tx.equipmentAssignment.create({
        data: {
          equipmentId,
          employeeId: data.employeeId,
          assignedAt,
          expectedReturnAt: data.expectedReturnAt || null,
          deliveryCondition: data.deliveryCondition || equipment.condition,
          deliveryTermNumber: data.deliveryTermNumber,
          notes: data.notes,
        },
        include: {
          equipment: true,
          employee: {
            include: {
              team: { select: { id: true, name: true } },
            },
          },
        },
      });

      await tx.equipment.update({
        where: { id: equipmentId },
        data: {
          status: EquipmentStatus.ASSIGNED,
          condition: data.deliveryCondition || equipment.condition,
        },
      });

      let deliveryId: string | undefined;
      if (data.createDelivery || data.deliveryScheduledAt || data.deliveryCourier || data.deliveryTracking || data.deliveryProofUrl) {
        const delivery = await tx.delivery.create({
          data: {
            employeeId: data.employeeId,
            assignmentId: assignment.id,
            status: data.deliveryProofUrl ? DeliveryStatus.DELIVERED : DeliveryStatus.SCHEDULED,
            scheduledAt: data.deliveryScheduledAt || assignedAt,
            deliveredAt: data.deliveryProofUrl ? assignedAt : null,
            courier: data.deliveryCourier || null,
            tracking: data.deliveryTracking || null,
            proofUrl: data.deliveryProofUrl || null,
            notes: data.notes || null,
          },
        });
        deliveryId = delivery.id;

        await tx.deliveryItem.create({
          data: {
            deliveryId: delivery.id,
            equipmentId,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          equipmentId,
          fromLocationId: stockLocation.id,
          toLocationId: null,
          type: StockMovementType.OUT,
          actorUserId: actorUserId || null,
          deliveryId: deliveryId || null,
          notes: data.notes || 'Saída para entrega de equipamento',
          metadataJson: {
            assignmentId: assignment.id,
            employeeId: data.employeeId,
          },
        },
      });

      return assignment;
    });
  },

  async returnAssignment(assignmentId: string, data: ReturnAssignmentDto, actorUserId?: string) {
    const assignment = await prisma.equipmentAssignment.findUnique({
      where: { id: assignmentId },
      include: { equipment: true },
    });
    if (!assignment) {
      throw new AppError('Entrega não encontrada', 404);
    }
    if (assignment.returnedAt) {
      throw new AppError('Este equipamento já foi devolvido', 400);
    }

    const returnedAt = data.returnedAt || new Date();
    const finalStatus =
      data.finalStatus && data.finalStatus !== EquipmentStatus.ASSIGNED
        ? data.finalStatus
        : EquipmentStatus.IN_STOCK;

    return prisma.$transaction(async (tx) => {
      const defaultStock = await ensureDefaultStockLocation(tx);
      const targetStockLocationId = data.stockLocationId || defaultStock.id;

      const updatedAssignment = await tx.equipmentAssignment.update({
        where: { id: assignmentId },
        data: {
          returnedAt,
          returnCondition: data.returnCondition,
          notes: data.notes ?? assignment.notes,
        },
        include: {
          equipment: true,
          employee: {
            include: {
              team: { select: { id: true, name: true } },
            },
          },
        },
      });

      await tx.equipment.update({
        where: { id: assignment.equipmentId },
        data: {
          status: finalStatus,
          condition: data.returnCondition || assignment.equipment.condition,
        },
      });

      await tx.stockMovement.create({
        data: {
          equipmentId: assignment.equipmentId,
          fromLocationId: null,
          toLocationId: targetStockLocationId,
          type: StockMovementType.IN,
          actorUserId: actorUserId || null,
          notes: data.notes || 'Entrada por devolução de equipamento',
          metadataJson: {
            assignmentId,
            employeeId: assignment.employeeId,
          },
        },
      });

      const linkedDelivery = await tx.delivery.findFirst({
        where: { assignmentId },
      });
      if (linkedDelivery) {
        await tx.delivery.update({
          where: { id: linkedDelivery.id },
          data: {
            status: DeliveryStatus.RETURNED,
            deliveredAt: linkedDelivery.deliveredAt || returnedAt,
          },
        });
      }

      return updatedAssignment;
    });
  },

  async getAssignments(filters?: {
    employeeId?: string;
    equipmentId?: string;
    activeOnly?: boolean;
  }) {
    const where: any = {};
    if (filters?.employeeId) {
      where.employeeId = filters.employeeId;
    }
    if (filters?.equipmentId) {
      where.equipmentId = filters.equipmentId;
    }
    if (filters?.activeOnly) {
      where.returnedAt = null;
    }

    return prisma.equipmentAssignment.findMany({
      where,
      include: {
        equipment: true,
        employee: {
          include: {
            team: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  },

  async getDashboard(daysToWarrantyAlert = 30): Promise<EquipmentDashboardData> {
    const now = new Date();
    const warrantyLimit = new Date(now);
    warrantyLimit.setDate(warrantyLimit.getDate() + daysToWarrantyAlert);

    const [
      totalEquipments,
      assignedCount,
      inStockCount,
      maintenanceCount,
      retiredOrLostCount,
      expiringWarrantyCount,
      overdueReturnCount,
      byTypeRaw,
      totalValueAgg,
    ] = await Promise.all([
      prisma.equipment.count(),
      prisma.equipment.count({ where: { status: EquipmentStatus.ASSIGNED } }),
      prisma.equipment.count({ where: { status: EquipmentStatus.IN_STOCK } }),
      prisma.equipment.count({ where: { status: EquipmentStatus.MAINTENANCE } }),
      prisma.equipment.count({
        where: { status: { in: [EquipmentStatus.RETIRED, EquipmentStatus.LOST] } },
      }),
      prisma.equipment.count({
        where: {
          warrantyEndDate: {
            gte: now,
            lte: warrantyLimit,
          },
          status: { not: EquipmentStatus.RETIRED },
        },
      }),
      prisma.equipmentAssignment.count({
        where: {
          returnedAt: null,
          expectedReturnAt: { lt: now },
        },
      }),
      prisma.equipment.groupBy({
        by: ['equipmentType'],
        _count: { _all: true },
        _sum: { value: true },
      }),
      prisma.equipment.aggregate({
        _sum: { value: true },
      }),
    ]);

    return {
      totalEquipments,
      totalValue: Number(totalValueAgg._sum.value || 0),
      assignedCount,
      inStockCount,
      maintenanceCount,
      retiredOrLostCount,
      expiringWarrantyCount,
      overdueReturnCount,
      byType: byTypeRaw.map((item) => ({
        equipmentType: item.equipmentType,
        count: item._count._all,
        totalValue: Number(item._sum.value || 0),
      })),
    };
  },

  async getAlerts(daysToWarrantyAlert = 30): Promise<EquipmentAlertsData> {
    const now = new Date();
    const warrantyLimit = new Date(now);
    warrantyLimit.setDate(warrantyLimit.getDate() + daysToWarrantyAlert);

    const [warrantyExpiringRaw, overdueReturnsRaw] = await Promise.all([
      prisma.equipment.findMany({
        where: {
          warrantyEndDate: {
            gte: now,
            lte: warrantyLimit,
          },
          status: { not: EquipmentStatus.RETIRED },
        },
        include: {
          assignments: {
            where: { returnedAt: null },
            include: {
              employee: { select: { name: true } },
            },
            orderBy: { assignedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { warrantyEndDate: 'asc' },
      }),
      prisma.equipmentAssignment.findMany({
        where: {
          returnedAt: null,
          expectedReturnAt: { lt: now },
        },
        include: {
          equipment: true,
          employee: { select: { name: true } },
        },
        orderBy: { expectedReturnAt: 'asc' },
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      warrantyExpiring: warrantyExpiringRaw
        .filter((equipment) => equipment.warrantyEndDate)
        .map((equipment) => {
          const diffMs = equipment.warrantyEndDate!.getTime() - now.getTime();
          const daysToExpire = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          return {
            id: equipment.id,
            assetTag: equipment.assetTag,
            equipmentType: equipment.equipmentType,
            warrantyEndDate: equipment.warrantyEndDate!,
            daysToExpire,
            assignedTo: equipment.assignments[0]?.employee?.name,
          };
        }),
      overdueReturns: overdueReturnsRaw.map((assignment) => {
        const diffMs = now.getTime() - assignment.expectedReturnAt!.getTime();
        const daysOverdue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return {
          assignmentId: assignment.id,
          assetTag: assignment.equipment.assetTag,
          equipmentType: assignment.equipment.equipmentType,
          employeeName: assignment.employee.name,
          expectedReturnAt: assignment.expectedReturnAt!,
          daysOverdue,
        };
      }),
    };
  },

  async getAssignmentForDeliveryTerm(assignmentId: string) {
    const assignment = await prisma.equipmentAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        equipment: true,
        employee: {
          include: {
            team: { select: { name: true } },
          },
        },
      },
    });

    if (!assignment) {
      throw new AppError('Entrega não encontrada', 404);
    }

    return assignment;
  },

  async listStockLocations(activeOnly = false) {
    return prisma.stockLocation.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { name: 'asc' },
    });
  },

  async createStockLocation(data: CreateStockLocationDto) {
    return prisma.stockLocation.create({
      data: {
        name: data.name,
        active: data.active ?? true,
      },
    });
  },

  async getStockMovements(filters?: { equipmentId?: string; type?: StockMovementType }) {
    return prisma.stockMovement.findMany({
      where: {
        equipmentId: filters?.equipmentId,
        type: filters?.type,
      },
      include: {
        equipment: true,
        fromLocation: true,
        toLocation: true,
      },
      orderBy: { ts: 'desc' },
    });
  },

  async createStockMovement(data: CreateStockMovementDto, actorUserId?: string) {
    const equipment = await prisma.equipment.findUnique({ where: { id: data.equipmentId } });
    if (!equipment) throw new AppError('Equipamento não encontrado', 404);

    if (data.fromLocationId) {
      const fromLocation = await prisma.stockLocation.findUnique({ where: { id: data.fromLocationId } });
      if (!fromLocation) throw new AppError('Local de origem não encontrado', 404);
    }
    if (data.toLocationId) {
      const toLocation = await prisma.stockLocation.findUnique({ where: { id: data.toLocationId } });
      if (!toLocation) throw new AppError('Local de destino não encontrado', 404);
    }

    return prisma.stockMovement.create({
      data: {
        equipmentId: data.equipmentId,
        type: data.type,
        fromLocationId: data.fromLocationId || null,
        toLocationId: data.toLocationId || null,
        notes: data.notes || null,
        metadataJson: (data.metadataJson as any) || null,
        actorUserId: actorUserId || null,
      },
      include: {
        equipment: true,
        fromLocation: true,
        toLocation: true,
      },
    });
  },

  async getDeliveries(filters?: { employeeId?: string; status?: DeliveryStatus }) {
    return prisma.delivery.findMany({
      where: {
        employeeId: filters?.employeeId,
        status: filters?.status,
      },
      include: {
        employee: true,
        items: {
          include: {
            equipment: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateDelivery(id: string, data: UpdateDeliveryDto) {
    const current = await prisma.delivery.findUnique({ where: { id } });
    if (!current) throw new AppError('Entrega não encontrada', 404);

    const nextStatus = data.status || current.status;
    const deliveredAt =
      data.deliveredAt !== undefined
        ? data.deliveredAt
        : nextStatus === DeliveryStatus.DELIVERED && !current.deliveredAt
          ? new Date()
          : current.deliveredAt;

    return prisma.delivery.update({
      where: { id },
      data: {
        status: nextStatus,
        scheduledAt: data.scheduledAt !== undefined ? data.scheduledAt : current.scheduledAt,
        deliveredAt,
        courier: data.courier !== undefined ? data.courier : current.courier,
        tracking: data.tracking !== undefined ? data.tracking : current.tracking,
        proofUrl: data.proofUrl !== undefined ? data.proofUrl : current.proofUrl,
        notes: data.notes !== undefined ? data.notes : current.notes,
      },
      include: {
        employee: true,
        items: {
          include: { equipment: true },
        },
      },
    });
  },
};
