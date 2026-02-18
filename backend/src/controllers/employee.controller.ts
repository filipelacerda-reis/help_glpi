import { Request, Response } from 'express';
import { z } from 'zod';
import { employeeService } from '../services/employee.service';
import { buildSimplePdfFromLines } from '../utils/simplePdf';
import { EquipmentCondition } from '@prisma/client';
import { PERMISSIONS } from '../domains/iam/services/authorization.service';

const cpfSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value.length === 11, 'CPF deve conter 11 dígitos');

const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  cpf: cpfSchema,
  roleTitle: z.string().min(2, 'Função deve ter no mínimo 2 caracteres'),
  teamId: z.string().uuid().nullable().optional(),
  hireDate: z
    .preprocess((value) => (value ? new Date(String(value)) : undefined), z.date())
    .nullable()
    .optional(),
  active: z.boolean().optional(),
});

const updateEmployeeSchema = z.object({
  name: z.string().min(2).optional(),
  cpf: cpfSchema.optional(),
  roleTitle: z.string().min(2).optional(),
  teamId: z.string().uuid().nullable().optional(),
  hireDate: z
    .preprocess((value) => (value === null ? null : value ? new Date(String(value)) : undefined), z.date().nullable())
    .optional(),
  active: z.boolean().optional(),
});

const pdfQuerySchema = z.object({
  filter: z.enum(['ACTIVE', 'RETURNED', 'ALL']).default('ACTIVE'),
  sortBy: z.enum(['ASSIGNED_AT', 'RETURNED_AT', 'ASSET_TAG', 'EQUIPMENT_TYPE']).default('ASSIGNED_AT'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  query: z.string().trim().optional(),
});

const conditionToLabel: Record<EquipmentCondition, string> = {
  NEW: 'Novo',
  GOOD: 'Bom',
  FAIR: 'Regular',
  DAMAGED: 'Danificado',
};

export const employeeController = {
  async getAll(req: Request, res: Response) {
    const filters: any = {};
    if (req.query.teamId) {
      filters.teamId = String(req.query.teamId);
    }
    if (req.query.active !== undefined) {
      filters.active = String(req.query.active) === 'true';
    }
    if (req.query.query) {
      filters.query = String(req.query.query);
    }

    const includePii = Boolean(req.userPermissions?.includes(PERMISSIONS.HR_EMPLOYEE_READ_PII));
    const employees = await employeeService.getAll(filters, { includePii });
    res.json(employees);
  },

  async getById(req: Request, res: Response) {
    const includePii = Boolean(req.userPermissions?.includes(PERMISSIONS.HR_EMPLOYEE_READ_PII));
    const employee = await employeeService.getById(req.params.id, { includePii });
    res.json(employee);
  },

  async create(req: Request, res: Response) {
    const data = createEmployeeSchema.parse(req.body);
    const employee = await employeeService.create(data);
    res.status(201).json(employee);
  },

  async update(req: Request, res: Response) {
    const data = updateEmployeeSchema.parse(req.body);
    const employee = await employeeService.update(req.params.id, data);
    res.json(employee);
  },

  async delete(req: Request, res: Response) {
    await employeeService.delete(req.params.id);
    res.status(204).send();
  },

  async downloadEquipmentsPdf(req: Request, res: Response) {
    const query = pdfQuerySchema.parse(req.query);
    const includePii = Boolean(req.userPermissions?.includes(PERMISSIONS.HR_EMPLOYEE_READ_PII));
    const employee = await employeeService.getEmployeeWithAssets(req.params.id, query, { includePii });
    const scopeLabel =
      query.filter === 'ALL'
        ? 'todos'
        : query.filter === 'RETURNED'
          ? 'devolvidos'
          : 'ativos';

    const lines = [
      'RELATORIO DE EQUIPAMENTOS POR COLABORADOR',
      '',
      `Data de emissao: ${new Date().toISOString().slice(0, 10)}`,
      `Escopo: ${scopeLabel}`,
      `Ordenacao: ${query.sortBy} (${query.sortDir})`,
      `Busca: ${query.query || '-'}`,
      '',
      'DADOS DO COLABORADOR',
      `Nome: ${employee.name}`,
      `CPF: ${employee.cpf}`,
      `Time: ${employee.team?.name || '-'}`,
      `Funcao: ${employee.roleTitle}`,
      `Data de admissao: ${employee.hireDate ? employee.hireDate.toISOString().slice(0, 10) : '-'}`,
      '',
      `Total de equipamentos no escopo: ${employee.assignments.length}`,
      '',
      'EQUIPAMENTOS',
      ...(
        employee.assignments.length > 0
          ? employee.assignments.flatMap((assignment, index) => [
              `#${index + 1} Patrimonio: ${assignment.equipment.assetTag}`,
              `   Tipo: ${assignment.equipment.equipmentType}`,
              `   Nota Fiscal: ${assignment.equipment.invoiceNumber}`,
              `   Data da compra: ${assignment.equipment.purchaseDate.toISOString().slice(0, 10)}`,
              `   Valor: R$ ${Number(assignment.equipment.value).toFixed(2)}`,
              `   Data da entrega: ${assignment.assignedAt.toISOString().slice(0, 10)}`,
              `   Data da devolucao: ${assignment.returnedAt ? assignment.returnedAt.toISOString().slice(0, 10) : '-'}`,
              `   Status da posse: ${assignment.returnedAt ? 'Devolvido' : 'Ativo com colaborador'}`,
              `   Condicao na entrega: ${conditionToLabel[assignment.deliveryCondition]}`,
              `   Condicao na devolucao: ${assignment.returnCondition ? conditionToLabel[assignment.returnCondition] : '-'}`,
              `   Termo: ${assignment.deliveryTermNumber || '-'}`,
              `   Observacoes: ${assignment.notes || '-'}`,
              '',
            ])
          : ['Nenhum equipamento encontrado no escopo selecionado.']
      ),
    ];

    const pdf = buildSimplePdfFromLines(lines);
    const sanitizedName = employee.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .toLowerCase();
    const filename = `equipamentos-${sanitizedName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.status(200).send(pdf);
  },
};
