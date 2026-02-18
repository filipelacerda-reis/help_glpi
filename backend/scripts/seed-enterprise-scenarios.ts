import {
  EquipmentCondition,
  EquipmentStatus,
  EquipmentType,
  PrismaClient,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();

const TEAM_NAMES = [
  'Suporte Técnico',
  'Desenvolvimento',
  'Infraestrutura',
  'People Ops',
  'Financeiro',
  'Marketing',
  'Compras',
];

const EQUIPMENT_TYPES: EquipmentType[] = [
  'NOTEBOOK',
  'MONITOR',
  'KEYBOARD',
  'MOUSE',
  'HUB_USB',
  'DOCK',
  'HEADSET',
  'PHONE',
  'TABLET',
];

const TYPE_BASE_VALUE: Record<EquipmentType, number> = {
  NOTEBOOK: 6900,
  DESKTOP: 5400,
  MONITOR: 1350,
  KEYBOARD: 260,
  MOUSE: 190,
  HEADSET: 430,
  HUB_USB: 320,
  DOCK: 1190,
  PHONE: 3600,
  TABLET: 2900,
  CHARGER: 190,
  OTHER: 250,
};

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function monthsAgo(months: number, day = 10) {
  const date = new Date();
  date.setDate(day);
  date.setMonth(date.getMonth() - months);
  date.setHours(10, 0, 0, 0);
  return date;
}

function formatMonthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

function employeeCpf(index: number) {
  return String(70000000000 + index).padStart(11, '0');
}

async function ensureBaseUsers() {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
  if (!existing) {
    const { hashPassword } = await import('../src/utils/password');
    const passwordHash = await hashPassword('admin123');
    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        department: 'TI',
        passwordHash,
      },
    });
  }
}

async function ensureTeams() {
  const teamByName = new Map<string, string>();
  for (const name of TEAM_NAMES) {
    const team = await prisma.team.upsert({
      where: { name },
      update: { description: `Time ${name} para cenários corporativos` },
      create: { name, description: `Time ${name} para cenários corporativos` },
    });
    teamByName.set(name, team.id);
  }
  return teamByName;
}

async function seedEmployees(teamByName: Map<string, string>) {
  const activeEmployeeIds: string[] = [];
  let inactiveCount = 0;

  for (let i = 1; i <= 36; i += 1) {
    const teamName = TEAM_NAMES[(i - 1) % TEAM_NAMES.length];
    const inactive = i % 7 === 0 || i % 11 === 0;
    const hireDate = monthsAgo(30 - (i % 24), (i % 20) + 5);

    const employee = await prisma.employee.upsert({
      where: { cpf: employeeCpf(i) },
      update: {
        name: `Colaborador ${String(i).padStart(2, '0')}`,
        roleTitle: inactive ? 'Analista (Desligado)' : `Analista ${teamName}`,
        teamId: teamByName.get(teamName) || null,
        hireDate,
        active: !inactive,
      },
      create: {
        name: `Colaborador ${String(i).padStart(2, '0')}`,
        cpf: employeeCpf(i),
        roleTitle: inactive ? 'Analista (Desligado)' : `Analista ${teamName}`,
        teamId: teamByName.get(teamName) || null,
        hireDate,
        active: !inactive,
      },
    });

    if (!inactive) {
      activeEmployeeIds.push(employee.id);
    } else {
      inactiveCount += 1;
      await prisma.platformAuditLog.create({
        data: {
          actorUserId: null,
          action: 'EMPLOYEE_TERMINATED',
          resource: 'employee',
          detailsJson: {
            employeeId: employee.id,
            cpf: employee.cpf,
            terminatedAt: daysFromNow(-20 - i).toISOString(),
            reason: 'Seed de cenário corporativo',
          },
        },
      });
    }
  }

  return { activeEmployeeIds, inactiveCount };
}

type EquipmentSeedItem = {
  assetTag: string;
  invoiceNumber: string;
  purchaseDate: Date;
  equipmentType: EquipmentType;
  value: number;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  serialNumber: string;
  brand: string;
  model: string;
  warrantyEndDate: Date;
};

function generateEquipments(): EquipmentSeedItem[] {
  const items: EquipmentSeedItem[] = [];
  let index = 1;
  for (let m = 0; m < 18; m += 1) {
    const purchaseDate = monthsAgo(m, 8 + (m % 18));
    for (let j = 0; j < 6; j += 1) {
      const type = EQUIPMENT_TYPES[(m + j) % EQUIPMENT_TYPES.length];
      const status: EquipmentStatus =
        j === 0 ? 'ASSIGNED' :
        j === 1 ? 'ASSIGNED' :
        j === 2 ? 'IN_STOCK' :
        j === 3 ? 'MAINTENANCE' :
        j === 4 ? 'RETIRED' : 'LOST';
      const value = TYPE_BASE_VALUE[type] + ((index % 5) * 97);
      const warrantyEndDate = new Date(purchaseDate);
      warrantyEndDate.setMonth(warrantyEndDate.getMonth() + 30);
      items.push({
        assetTag: `ENT-${formatMonthKey(purchaseDate)}-${String(index).padStart(4, '0')}`,
        invoiceNumber: `NF-ENT-${formatMonthKey(purchaseDate)}-${String(index).padStart(4, '0')}`,
        purchaseDate,
        equipmentType: type,
        value,
        status,
        condition: status === 'LOST' ? 'DAMAGED' : status === 'RETIRED' ? 'FAIR' : 'GOOD',
        serialNumber: `SN-ENT-${String(index).padStart(6, '0')}`,
        brand: ['Dell', 'Lenovo', 'HP', 'Logitech', 'Samsung'][index % 5],
        model: `Modelo-${index}`,
        warrantyEndDate,
      });
      index += 1;
    }
  }
  return items;
}

async function seedEquipments(activeEmployeeIds: string[]) {
  const records = generateEquipments();
  const equipmentIds: string[] = [];

  for (const item of records) {
    const saved = await prisma.equipment.upsert({
      where: { assetTag: item.assetTag },
      update: {
        invoiceNumber: item.invoiceNumber,
        purchaseDate: item.purchaseDate,
        equipmentType: item.equipmentType,
        value: item.value,
        status: item.status,
        condition: item.condition,
        serialNumber: item.serialNumber,
        brand: item.brand,
        model: item.model,
        warrantyEndDate: item.warrantyEndDate,
        notes: 'enterprise-seed',
      },
      create: {
        invoiceNumber: item.invoiceNumber,
        purchaseDate: item.purchaseDate,
        equipmentType: item.equipmentType,
        assetTag: item.assetTag,
        value: item.value,
        status: item.status,
        condition: item.condition,
        serialNumber: item.serialNumber,
        brand: item.brand,
        model: item.model,
        warrantyEndDate: item.warrantyEndDate,
        notes: 'enterprise-seed',
      },
    });
    equipmentIds.push(saved.id);
  }

  await prisma.equipmentAssignment.deleteMany({
    where: { equipmentId: { in: equipmentIds } },
  });

  const assignedEquipments = await prisma.equipment.findMany({
    where: { id: { in: equipmentIds }, status: EquipmentStatus.ASSIGNED },
    orderBy: { purchaseDate: 'asc' },
  });

  for (let i = 0; i < assignedEquipments.length; i += 1) {
    const equipment = assignedEquipments[i];
    const employeeId = activeEmployeeIds[i % activeEmployeeIds.length];
    const assignedAt = new Date(equipment.purchaseDate);
    assignedAt.setDate(assignedAt.getDate() + 5);

    const overdue = i % 5 === 0;
    const expectedReturnAt = overdue ? daysFromNow(-(10 + i)) : daysFromNow(120 + i);

    await prisma.equipmentAssignment.create({
      data: {
        equipmentId: equipment.id,
        employeeId,
        assignedAt,
        expectedReturnAt,
        deliveryCondition: equipment.condition,
        deliveryTermNumber: `TERM-ENT-${String(i + 1).padStart(4, '0')}`,
        notes: overdue ? 'Entrega ativa com devolução em atraso (seed)' : 'Entrega ativa (seed)',
      },
    });
  }

  const inactiveEmployee = await prisma.employee.findFirst({ where: { active: false } });
  if (inactiveEmployee) {
    const stockEquipment = await prisma.equipment.findFirst({
      where: { id: { in: equipmentIds }, status: EquipmentStatus.IN_STOCK },
    });
    if (stockEquipment) {
      const assignedAt = daysFromNow(-180);
      const returnedAt = daysFromNow(-45);
      await prisma.equipmentAssignment.create({
        data: {
          equipmentId: stockEquipment.id,
          employeeId: inactiveEmployee.id,
          assignedAt,
          expectedReturnAt: daysFromNow(-60),
          returnedAt,
          deliveryCondition: 'GOOD',
          returnCondition: 'GOOD',
          deliveryTermNumber: 'TERM-ENT-HISTORY-0001',
          notes: 'Histórico de colaborador desligado (seed)',
        },
      });
    }
  }
}

async function main() {
  console.log('🏢 Iniciando seed enterprise (admissão/demissão/compras/ativos)...');
  await ensureBaseUsers();
  const teamByName = await ensureTeams();
  const { activeEmployeeIds, inactiveCount } = await seedEmployees(teamByName);
  await seedEquipments(activeEmployeeIds);

  const [employees, equipments, assignmentsActive, assignmentsReturned] = await Promise.all([
    prisma.employee.count(),
    prisma.equipment.count({ where: { notes: 'enterprise-seed' } }),
    prisma.equipmentAssignment.count({
      where: {
        equipment: { notes: 'enterprise-seed' },
        returnedAt: null,
      },
    }),
    prisma.equipmentAssignment.count({
      where: {
        equipment: { notes: 'enterprise-seed' },
        returnedAt: { not: null },
      },
    }),
  ]);

  console.log('✅ Seed enterprise concluído.');
  console.log(
    `Resumo enterprise: employees=${employees}, inativos=${inactiveCount}, equipamentosSeed=${equipments}, entregasAtivas=${assignmentsActive}, historicoDevolucao=${assignmentsReturned}`
  );
}

main()
  .catch((error) => {
    console.error('❌ Erro no seed enterprise:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

