import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export interface CreateEmployeeDto {
  name: string;
  cpf: string;
  roleTitle: string;
  teamId?: string | null;
  hireDate?: Date | null;
  active?: boolean;
}

export interface UpdateEmployeeDto {
  name?: string;
  cpf?: string;
  roleTitle?: string;
  teamId?: string | null;
  hireDate?: Date | null;
  active?: boolean;
}

export type EmployeeEquipmentsFilter = 'ACTIVE' | 'RETURNED' | 'ALL';
export type EmployeeEquipmentsSortBy = 'ASSIGNED_AT' | 'RETURNED_AT' | 'ASSET_TAG' | 'EQUIPMENT_TYPE';
export type EmployeeEquipmentsSortDir = 'asc' | 'desc';

function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, '');
}

export const employeeService = {
  async getAll(filters?: { teamId?: string; active?: boolean; query?: string }) {
    const where: any = {};

    if (filters?.teamId) {
      where.teamId = filters.teamId;
    }
    if (filters?.active !== undefined) {
      where.active = filters.active;
    }
    if (filters?.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { cpf: { contains: filters.query } },
        { roleTitle: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        team: {
          select: { id: true, name: true },
        },
        assignments: {
          where: { returnedAt: null },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return employees.map((employee) => ({
      ...employee,
      activeAssignmentsCount: employee.assignments.length,
    }));
  },

  async getById(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        team: {
          select: { id: true, name: true },
        },
        assignments: {
          include: {
            equipment: true,
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!employee) {
      throw new AppError('Funcionário não encontrado', 404);
    }

    return employee;
  },

  async getEmployeeWithActiveAssets(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        team: {
          select: { id: true, name: true },
        },
        assignments: {
          where: { returnedAt: null },
          include: {
            equipment: true,
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!employee) {
      throw new AppError('Funcionário não encontrado', 404);
    }

    return employee;
  },

  async getEmployeeWithAssets(
    id: string,
    options: {
      filter: EmployeeEquipmentsFilter;
      sortBy: EmployeeEquipmentsSortBy;
      sortDir: EmployeeEquipmentsSortDir;
      query?: string;
    }
  ) {
    const where =
      options.filter === 'ACTIVE'
        ? { returnedAt: null }
        : options.filter === 'RETURNED'
          ? { returnedAt: { not: null as Date | null } }
          : {};

    const orderBy =
      options.sortBy === 'ASSET_TAG'
        ? { equipment: { assetTag: options.sortDir } }
        : options.sortBy === 'EQUIPMENT_TYPE'
          ? { equipment: { equipmentType: options.sortDir } }
          : options.sortBy === 'RETURNED_AT'
            ? { returnedAt: options.sortDir }
            : { assignedAt: options.sortDir };

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        team: {
          select: { id: true, name: true },
        },
        assignments: {
          where,
          include: {
            equipment: true,
          },
          orderBy,
        },
      },
    });

    if (!employee) {
      throw new AppError('Funcionário não encontrado', 404);
    }

    const query = options.query?.trim().toLowerCase();
    if (!query) {
      return employee;
    }

    const filteredAssignments = employee.assignments.filter((assignment) => {
      const equipment = assignment.equipment;
      return (
        equipment.assetTag.toLowerCase().includes(query) ||
        equipment.invoiceNumber.toLowerCase().includes(query) ||
        equipment.equipmentType.toLowerCase().includes(query) ||
        (equipment.serialNumber || '').toLowerCase().includes(query) ||
        (equipment.brand || '').toLowerCase().includes(query) ||
        (equipment.model || '').toLowerCase().includes(query)
      );
    });

    return {
      ...employee,
      assignments: filteredAssignments,
    };
  },

  async create(data: CreateEmployeeDto) {
    const cpf = normalizeCpf(data.cpf);
    if (cpf.length !== 11) {
      throw new AppError('CPF deve conter 11 dígitos', 400);
    }

    if (data.teamId) {
      const team = await prisma.team.findUnique({ where: { id: data.teamId } });
      if (!team) {
        throw new AppError('Time não encontrado', 404);
      }
    }

    const existing = await prisma.employee.findUnique({
      where: { cpf },
    });
    if (existing) {
      throw new AppError('Já existe um funcionário com este CPF', 400);
    }

    return prisma.employee.create({
      data: {
        name: data.name,
        cpf,
        roleTitle: data.roleTitle,
        teamId: data.teamId || null,
        hireDate: data.hireDate || null,
        active: data.active ?? true,
      },
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
    });
  },

  async update(id: string, data: UpdateEmployeeDto) {
    const current = await prisma.employee.findUnique({ where: { id } });
    if (!current) {
      throw new AppError('Funcionário não encontrado', 404);
    }

    const updateData: any = { ...data };

    if (data.cpf !== undefined) {
      const cpf = normalizeCpf(data.cpf);
      if (cpf.length !== 11) {
        throw new AppError('CPF deve conter 11 dígitos', 400);
      }

      const existing = await prisma.employee.findUnique({ where: { cpf } });
      if (existing && existing.id !== id) {
        throw new AppError('Já existe um funcionário com este CPF', 400);
      }
      updateData.cpf = cpf;
    }

    if (data.teamId) {
      const team = await prisma.team.findUnique({ where: { id: data.teamId } });
      if (!team) {
        throw new AppError('Time não encontrado', 404);
      }
    }

    return prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
    });
  },

  async delete(id: string) {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      throw new AppError('Funcionário não encontrado', 404);
    }

    const activeAssignments = await prisma.equipmentAssignment.count({
      where: { employeeId: id, returnedAt: null },
    });
    if (activeAssignments > 0) {
      throw new AppError(
        'Não é possível remover funcionário com equipamentos ainda não devolvidos',
        400
      );
    }

    await prisma.employee.delete({ where: { id } });
  },
};
