import { EquipmentCondition, EquipmentStatus, EquipmentType } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { equipmentService } from '../services/equipment.service';
import { buildSimplePdfFromLines } from '../utils/simplePdf';

const createEquipmentSchema = z.object({
  invoiceNumber: z.string().min(1, 'Nota fiscal é obrigatória'),
  purchaseDate: z.preprocess((value) => new Date(String(value)), z.date()),
  equipmentType: z.nativeEnum(EquipmentType),
  assetTag: z.string().min(1, 'Patrimônio é obrigatório'),
  value: z.coerce.number().positive('Valor deve ser maior que zero'),
  serialNumber: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  status: z.nativeEnum(EquipmentStatus).optional(),
  condition: z.nativeEnum(EquipmentCondition).optional(),
  warrantyEndDate: z
    .preprocess((value) => (value ? new Date(String(value)) : undefined), z.date())
    .nullable()
    .optional(),
  notes: z.string().optional(),
});

const updateEquipmentSchema = z.object({
  invoiceNumber: z.string().min(1).optional(),
  purchaseDate: z.preprocess((value) => (value ? new Date(String(value)) : undefined), z.date()).optional(),
  equipmentType: z.nativeEnum(EquipmentType).optional(),
  assetTag: z.string().min(1).optional(),
  value: z.coerce.number().positive().optional(),
  serialNumber: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  status: z.nativeEnum(EquipmentStatus).optional(),
  condition: z.nativeEnum(EquipmentCondition).optional(),
  warrantyEndDate: z
    .preprocess((value) => (value === null ? null : value ? new Date(String(value)) : undefined), z.date().nullable())
    .optional(),
  notes: z.string().nullable().optional(),
});

const assignEquipmentSchema = z.object({
  employeeId: z.string().uuid('Funcionário inválido'),
  assignedAt: z
    .preprocess((value) => (value ? new Date(String(value)) : undefined), z.date())
    .optional(),
  expectedReturnAt: z
    .preprocess((value) => (value === null ? null : value ? new Date(String(value)) : undefined), z.date().nullable())
    .optional(),
  deliveryCondition: z.nativeEnum(EquipmentCondition).optional(),
  deliveryTermNumber: z.string().optional(),
  notes: z.string().optional(),
});

const returnAssignmentSchema = z.object({
  returnedAt: z
    .preprocess((value) => (value ? new Date(String(value)) : undefined), z.date())
    .optional(),
  returnCondition: z.nativeEnum(EquipmentCondition).optional(),
  finalStatus: z.nativeEnum(EquipmentStatus).optional(),
  notes: z.string().optional(),
});

const alertsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(180).optional(),
});

export const equipmentController = {
  async getAll(req: Request, res: Response) {
    const filters: any = {};
    if (req.query.status) {
      filters.status = req.query.status as EquipmentStatus;
    }
    if (req.query.equipmentType) {
      filters.equipmentType = req.query.equipmentType as EquipmentType;
    }
    if (req.query.query) {
      filters.query = String(req.query.query);
    }
    const equipments = await equipmentService.getAll(filters);
    res.json(equipments);
  },

  async getById(req: Request, res: Response) {
    const equipment = await equipmentService.getById(req.params.id);
    res.json(equipment);
  },

  async create(req: Request, res: Response) {
    const data = createEquipmentSchema.parse(req.body) as any;
    const equipment = await equipmentService.create(data);
    res.status(201).json(equipment);
  },

  async update(req: Request, res: Response) {
    const data = updateEquipmentSchema.parse(req.body) as any;
    const equipment = await equipmentService.update(req.params.id, data);
    res.json(equipment);
  },

  async delete(req: Request, res: Response) {
    await equipmentService.delete(req.params.id);
    res.status(204).send();
  },

  async assign(req: Request, res: Response) {
    const data = assignEquipmentSchema.parse(req.body) as any;
    const assignment = await equipmentService.assignEquipment(req.params.id, data);
    res.status(201).json(assignment);
  },

  async returnAssignment(req: Request, res: Response) {
    const data = returnAssignmentSchema.parse(req.body) as any;
    const assignment = await equipmentService.returnAssignment(
      req.params.assignmentId,
      data
    );
    res.json(assignment);
  },

  async getAssignments(req: Request, res: Response) {
    const filters: any = {};
    if (req.query.employeeId) {
      filters.employeeId = String(req.query.employeeId);
    }
    if (req.query.equipmentId) {
      filters.equipmentId = String(req.query.equipmentId);
    }
    if (req.query.activeOnly !== undefined) {
      filters.activeOnly = String(req.query.activeOnly) === 'true';
    }
    const assignments = await equipmentService.getAssignments(filters);
    res.json(assignments);
  },

  async getDashboard(req: Request, res: Response) {
    const days = alertsQuerySchema.parse(req.query).days;
    const data = await equipmentService.getDashboard(days);
    res.json(data);
  },

  async getAlerts(req: Request, res: Response) {
    const days = alertsQuerySchema.parse(req.query).days;
    const data = await equipmentService.getAlerts(days);
    res.json(data);
  },

  async downloadDeliveryTermPdf(req: Request, res: Response) {
    const assignment = await equipmentService.getAssignmentForDeliveryTerm(
      req.params.assignmentId
    );

    const lines = [
      'TERMO DE ENTREGA DE EQUIPAMENTO',
      '',
      `Data de emissao: ${new Date().toISOString().slice(0, 10)}`,
      `Numero do termo: ${assignment.deliveryTermNumber || assignment.id}`,
      '',
      'COLABORADOR',
      `Nome: ${assignment.employee.name}`,
      `CPF: ${assignment.employee.cpf}`,
      `Time: ${assignment.employee.team?.name || '-'}`,
      `Funcao: ${assignment.employee.roleTitle}`,
      '',
      'EQUIPAMENTO',
      `Patrimonio: ${assignment.equipment.assetTag}`,
      `Tipo: ${assignment.equipment.equipmentType}`,
      `Nota Fiscal: ${assignment.equipment.invoiceNumber}`,
      `Data da compra: ${assignment.equipment.purchaseDate.toISOString().slice(0, 10)}`,
      `Valor: R$ ${Number(assignment.equipment.value).toFixed(2)}`,
      `Condicao na entrega: ${assignment.deliveryCondition}`,
      `Data da entrega: ${assignment.assignedAt.toISOString().slice(0, 10)}`,
      assignment.expectedReturnAt
        ? `Previsao de devolucao: ${assignment.expectedReturnAt.toISOString().slice(0, 10)}`
        : 'Previsao de devolucao: -',
      '',
      'DECLARACAO',
      'Declaro que recebi o equipamento acima e me comprometo com o uso adequado.',
      '',
      'Assinatura colaborador: ___________________________',
      'Assinatura empresa: ________________________________',
    ];

    const pdf = buildSimplePdfFromLines(lines);
    const filename = `termo-entrega-${assignment.equipment.assetTag}-${assignment.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.status(200).send(pdf);
  },
};
