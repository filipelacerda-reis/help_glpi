import {
  EquipmentCondition,
  EquipmentStatus,
  EquipmentType,
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
  notes?: string;
}

export interface ReturnAssignmentDto {
  returnedAt?: Date;
  returnCondition?: EquipmentCondition;
  finalStatus?: EquipmentStatus;
  notes?: string;
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

  async assignEquipment(equipmentId: string, data: AssignEquipmentDto) {
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

      return assignment;
    });
  },

  async returnAssignment(assignmentId: string, data: ReturnAssignmentDto) {
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
};
