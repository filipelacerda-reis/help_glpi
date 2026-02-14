import {
  EquipmentCondition,
  EquipmentStatus,
  EquipmentType,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function ensureDefaultAdmin() {
  const adminPassword = await hashPassword('admin123');
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Administrador',
      role: UserRole.ADMIN,
      department: 'TI',
      passwordHash: adminPassword,
    },
    create: {
      name: 'Administrador',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      department: 'TI',
      passwordHash: adminPassword,
    },
  });
}

type EmployeeSeed = {
  name: string;
  cpf: string;
  roleTitle: string;
  teamName: string;
  hireDate: string;
};

type EquipmentSeed = {
  assetTag: string;
  invoiceNumber: string;
  purchaseDate: string;
  equipmentType: EquipmentType;
  value: number;
  serialNumber: string;
  brand: string;
  model: string;
  condition: EquipmentCondition;
  status?: EquipmentStatus;
  warrantyEndDate?: string;
  notes?: string;
};

const TEAM_NAMES = [
  'Suporte Técnico',
  'Desenvolvimento',
  'Infraestrutura',
  'People Ops',
  'Financeiro',
  'Marketing',
];

const EMPLOYEES: EmployeeSeed[] = [
  {
    name: 'Ana Paula Ribeiro',
    cpf: '45810392011',
    roleTitle: 'Analista de Marketing',
    teamName: 'Marketing',
    hireDate: '2025-02-10',
  },
  {
    name: 'Bruno Tavares',
    cpf: '78123544076',
    roleTitle: 'Desenvolvedor Backend',
    teamName: 'Desenvolvimento',
    hireDate: '2024-08-01',
  },
  {
    name: 'Carla Nunes',
    cpf: '90344122065',
    roleTitle: 'People Partner',
    teamName: 'People Ops',
    hireDate: '2024-10-12',
  },
  {
    name: 'Diego Almeida',
    cpf: '64211988003',
    roleTitle: 'Analista Financeiro',
    teamName: 'Financeiro',
    hireDate: '2023-03-06',
  },
  {
    name: 'Eduarda Freitas',
    cpf: '27488319022',
    roleTitle: 'Analista de Infraestrutura',
    teamName: 'Infraestrutura',
    hireDate: '2024-01-18',
  },
  {
    name: 'Felipe Costa',
    cpf: '12033498058',
    roleTitle: 'Técnico de Suporte N2',
    teamName: 'Suporte Técnico',
    hireDate: '2023-11-21',
  },
  {
    name: 'Gabriela Souza',
    cpf: '51377264009',
    roleTitle: 'UX Designer',
    teamName: 'Desenvolvimento',
    hireDate: '2025-01-08',
  },
  {
    name: 'Henrique Barbosa',
    cpf: '34781099041',
    roleTitle: 'Coordenador de TI',
    teamName: 'Infraestrutura',
    hireDate: '2022-09-14',
  },
  {
    name: 'Isabela Mendes',
    cpf: '96155432038',
    roleTitle: 'Analista de CRM',
    teamName: 'Marketing',
    hireDate: '2024-06-03',
  },
  {
    name: 'João Pedro Matos',
    cpf: '88564321067',
    roleTitle: 'Assistente Financeiro',
    teamName: 'Financeiro',
    hireDate: '2025-04-22',
  },
];

const EQUIPMENTS: EquipmentSeed[] = [
  {
    assetTag: 'PAT-NB-1001',
    invoiceNumber: 'NF-CHAT-2025-0001',
    purchaseDate: '2025-01-15',
    equipmentType: 'NOTEBOOK',
    value: 6499.9,
    serialNumber: 'SN-NB-1001',
    brand: 'Dell',
    model: 'Latitude 5440',
    condition: 'NEW',
    warrantyEndDate: '2028-01-15',
    notes: 'Notebook padrão onboarding marketing',
  },
  {
    assetTag: 'PAT-NB-1002',
    invoiceNumber: 'NF-CHAT-2025-0002',
    purchaseDate: '2025-01-15',
    equipmentType: 'NOTEBOOK',
    value: 6999.0,
    serialNumber: 'SN-NB-1002',
    brand: 'Lenovo',
    model: 'ThinkPad T14',
    condition: 'NEW',
    warrantyEndDate: '2028-01-15',
    notes: 'Notebook engenharia backend',
  },
  {
    assetTag: 'PAT-NB-1003',
    invoiceNumber: 'NF-CHAT-2025-0003',
    purchaseDate: '2025-01-18',
    equipmentType: 'NOTEBOOK',
    value: 7199.99,
    serialNumber: 'SN-NB-1003',
    brand: 'HP',
    model: 'EliteBook 840',
    condition: 'GOOD',
    warrantyEndDate: '2027-01-18',
  },
  {
    assetTag: 'PAT-MON-2001',
    invoiceNumber: 'NF-CHAT-2025-0101',
    purchaseDate: '2025-02-03',
    equipmentType: 'MONITOR',
    value: 1299.5,
    serialNumber: 'SN-MON-2001',
    brand: 'LG',
    model: '27UL500',
    condition: 'NEW',
    warrantyEndDate: '2027-02-03',
  },
  {
    assetTag: 'PAT-MON-2002',
    invoiceNumber: 'NF-CHAT-2025-0102',
    purchaseDate: '2025-02-03',
    equipmentType: 'MONITOR',
    value: 1390,
    serialNumber: 'SN-MON-2002',
    brand: 'Dell',
    model: 'P2422H',
    condition: 'GOOD',
    warrantyEndDate: '2027-02-03',
  },
  {
    assetTag: 'PAT-KB-3001',
    invoiceNumber: 'NF-CHAT-2025-0201',
    purchaseDate: '2025-02-10',
    equipmentType: 'KEYBOARD',
    value: 249.9,
    serialNumber: 'SN-KB-3001',
    brand: 'Logitech',
    model: 'K835',
    condition: 'NEW',
  },
  {
    assetTag: 'PAT-MS-4001',
    invoiceNumber: 'NF-CHAT-2025-0301',
    purchaseDate: '2025-02-10',
    equipmentType: 'MOUSE',
    value: 189.9,
    serialNumber: 'SN-MS-4001',
    brand: 'Logitech',
    model: 'M720',
    condition: 'NEW',
  },
  {
    assetTag: 'PAT-HUB-5001',
    invoiceNumber: 'NF-CHAT-2025-0401',
    purchaseDate: '2025-02-11',
    equipmentType: 'HUB_USB',
    value: 319.9,
    serialNumber: 'SN-HUB-5001',
    brand: 'Anker',
    model: 'PowerExpand 8-in-1',
    condition: 'NEW',
  },
  {
    assetTag: 'PAT-DK-6001',
    invoiceNumber: 'NF-CHAT-2025-0501',
    purchaseDate: '2025-02-11',
    equipmentType: 'DOCK',
    value: 1250,
    serialNumber: 'SN-DK-6001',
    brand: 'Dell',
    model: 'WD19S',
    condition: 'GOOD',
  },
  {
    assetTag: 'PAT-HS-7001',
    invoiceNumber: 'NF-CHAT-2025-0601',
    purchaseDate: '2025-02-12',
    equipmentType: 'HEADSET',
    value: 420,
    serialNumber: 'SN-HS-7001',
    brand: 'Jabra',
    model: 'Evolve2 40',
    condition: 'GOOD',
  },
  {
    assetTag: 'PAT-PH-8001',
    invoiceNumber: 'NF-CHAT-2024-0901',
    purchaseDate: '2024-09-20',
    equipmentType: 'PHONE',
    value: 3899,
    serialNumber: 'SN-PH-8001',
    brand: 'Samsung',
    model: 'Galaxy S23',
    condition: 'GOOD',
    status: 'ASSIGNED',
    warrantyEndDate: '2026-09-20',
  },
  {
    assetTag: 'PAT-TB-9001',
    invoiceNumber: 'NF-CHAT-2024-1101',
    purchaseDate: '2024-11-03',
    equipmentType: 'TABLET',
    value: 2999,
    serialNumber: 'SN-TB-9001',
    brand: 'Apple',
    model: 'iPad 10th',
    condition: 'GOOD',
    status: 'IN_STOCK',
    warrantyEndDate: '2026-11-03',
  },
  {
    assetTag: 'PAT-NB-1010',
    invoiceNumber: 'NF-CHAT-2023-0301',
    purchaseDate: '2023-03-02',
    equipmentType: 'NOTEBOOK',
    value: 4800,
    serialNumber: 'SN-NB-1010',
    brand: 'Acer',
    model: 'TravelMate P2',
    condition: 'FAIR',
    status: 'MAINTENANCE',
    warrantyEndDate: '2026-03-02',
    notes: 'Em manutenção por problema na bateria',
  },
  {
    assetTag: 'PAT-MS-4010',
    invoiceNumber: 'NF-CHAT-2023-0702',
    purchaseDate: '2023-07-09',
    equipmentType: 'MOUSE',
    value: 129.9,
    serialNumber: 'SN-MS-4010',
    brand: 'Logitech',
    model: 'M585',
    condition: 'DAMAGED',
    status: 'RETIRED',
    notes: 'Mouse com clique duplo recorrente',
  },
  {
    assetTag: 'PAT-NB-1015',
    invoiceNumber: 'NF-CHAT-2022-1207',
    purchaseDate: '2022-12-19',
    equipmentType: 'NOTEBOOK',
    value: 5200,
    serialNumber: 'SN-NB-1015',
    brand: 'Dell',
    model: 'Latitude 5420',
    condition: 'DAMAGED',
    status: 'LOST',
    notes: 'Extraviado em deslocamento externo',
  },
];

const ACTIVE_ASSIGNMENTS = [
  {
    employeeCpf: '45810392011',
    assetTag: 'PAT-NB-1001',
    assignedAt: '2025-02-17',
    expectedReturnAt: '2026-12-31',
    deliveryCondition: 'NEW' as EquipmentCondition,
    deliveryTermNumber: 'TERM-ONB-0001',
    notes: 'Kit onboarding completo',
  },
  {
    employeeCpf: '45810392011',
    assetTag: 'PAT-MON-2001',
    assignedAt: '2025-02-17',
    expectedReturnAt: '2026-12-31',
    deliveryCondition: 'NEW' as EquipmentCondition,
    deliveryTermNumber: 'TERM-ONB-0001',
    notes: 'Monitor home office',
  },
  {
    employeeCpf: '45810392011',
    assetTag: 'PAT-KB-3001',
    assignedAt: '2025-02-17',
    expectedReturnAt: '2026-12-31',
    deliveryCondition: 'NEW' as EquipmentCondition,
    deliveryTermNumber: 'TERM-ONB-0001',
  },
  {
    employeeCpf: '45810392011',
    assetTag: 'PAT-MS-4001',
    assignedAt: '2025-02-17',
    expectedReturnAt: '2026-12-31',
    deliveryCondition: 'NEW' as EquipmentCondition,
    deliveryTermNumber: 'TERM-ONB-0001',
  },
  {
    employeeCpf: '78123544076',
    assetTag: 'PAT-NB-1002',
    assignedAt: '2025-02-20',
    expectedReturnAt: '2026-12-31',
    deliveryCondition: 'NEW' as EquipmentCondition,
    deliveryTermNumber: 'TERM-ENG-0007',
    notes: 'Notebook principal backend',
  },
  {
    employeeCpf: '78123544076',
    assetTag: 'PAT-DK-6001',
    assignedAt: '2025-02-20',
    expectedReturnAt: '2026-12-31',
    deliveryCondition: 'GOOD' as EquipmentCondition,
    deliveryTermNumber: 'TERM-ENG-0007',
  },
  {
    employeeCpf: '90344122065',
    assetTag: 'PAT-HUB-5001',
    assignedAt: '2025-03-01',
    expectedReturnAt: '2026-12-31',
    deliveryCondition: 'NEW' as EquipmentCondition,
    deliveryTermNumber: 'TERM-HR-0021',
  },
  {
    employeeCpf: '64211988003',
    assetTag: 'PAT-PH-8001',
    assignedAt: '2025-03-04',
    expectedReturnAt: '2026-03-04',
    deliveryCondition: 'GOOD' as EquipmentCondition,
    deliveryTermNumber: 'TERM-FIN-0042',
    notes: 'Uso financeiro para autenticações bancárias',
  },
  {
    employeeCpf: '34781099041',
    assetTag: 'PAT-NB-1003',
    assignedAt: '2025-02-28',
    expectedReturnAt: '2025-09-30',
    deliveryCondition: 'GOOD' as EquipmentCondition,
    deliveryTermNumber: 'TERM-INF-0009',
    notes: 'Entrega com previsão já vencida para teste de alertas',
  },
  {
    employeeCpf: '34781099041',
    assetTag: 'PAT-HS-7001',
    assignedAt: '2025-02-28',
    expectedReturnAt: '2026-12-31',
    deliveryCondition: 'GOOD' as EquipmentCondition,
    deliveryTermNumber: 'TERM-INF-0009',
  },
];

const RETURNED_ASSIGNMENTS = [
  {
    employeeCpf: '12033498058',
    assetTag: 'PAT-MON-2002',
    assignedAt: '2024-04-10',
    expectedReturnAt: '2025-01-15',
    returnedAt: '2025-01-10',
    deliveryCondition: 'GOOD' as EquipmentCondition,
    returnCondition: 'GOOD' as EquipmentCondition,
    deliveryTermNumber: 'TERM-SUP-0010',
    notes: 'Devolução após troca de estação',
  },
  {
    employeeCpf: '96155432038',
    assetTag: 'PAT-TB-9001',
    assignedAt: '2024-12-01',
    expectedReturnAt: '2025-04-01',
    returnedAt: '2025-03-20',
    deliveryCondition: 'GOOD' as EquipmentCondition,
    returnCondition: 'GOOD' as EquipmentCondition,
    deliveryTermNumber: 'TERM-MKT-0033',
    notes: 'Tablet devolvido após campanha',
  },
];

async function ensureTeams() {
  const teams: Record<string, string> = {};
  for (const name of TEAM_NAMES) {
    const team = await prisma.team.upsert({
      where: { name },
      update: {},
      create: { name, description: `Time ${name} para seed de ativos/chat` },
    });
    teams[name] = team.id;
  }
  return teams;
}

async function upsertEmployees(teamIdsByName: Record<string, string>) {
  const employeeByCpf: Record<string, string> = {};

  for (const employee of EMPLOYEES) {
    const saved = await prisma.employee.upsert({
      where: { cpf: employee.cpf },
      update: {
        name: employee.name,
        roleTitle: employee.roleTitle,
        teamId: teamIdsByName[employee.teamName],
        hireDate: new Date(employee.hireDate),
        active: true,
      },
      create: {
        name: employee.name,
        cpf: employee.cpf,
        roleTitle: employee.roleTitle,
        teamId: teamIdsByName[employee.teamName],
        hireDate: new Date(employee.hireDate),
        active: true,
      },
    });
    employeeByCpf[employee.cpf] = saved.id;
  }

  return employeeByCpf;
}

async function upsertEquipments() {
  const equipmentByAssetTag: Record<string, string> = {};

  for (const equipment of EQUIPMENTS) {
    const saved = await prisma.equipment.upsert({
      where: { assetTag: equipment.assetTag },
      update: {
        invoiceNumber: equipment.invoiceNumber,
        purchaseDate: new Date(equipment.purchaseDate),
        equipmentType: equipment.equipmentType,
        value: equipment.value,
        serialNumber: equipment.serialNumber,
        brand: equipment.brand,
        model: equipment.model,
        status: equipment.status || EquipmentStatus.IN_STOCK,
        condition: equipment.condition,
        warrantyEndDate: equipment.warrantyEndDate
          ? new Date(equipment.warrantyEndDate)
          : null,
        notes: equipment.notes,
      },
      create: {
        invoiceNumber: equipment.invoiceNumber,
        purchaseDate: new Date(equipment.purchaseDate),
        equipmentType: equipment.equipmentType,
        assetTag: equipment.assetTag,
        value: equipment.value,
        serialNumber: equipment.serialNumber,
        brand: equipment.brand,
        model: equipment.model,
        status: equipment.status || EquipmentStatus.IN_STOCK,
        condition: equipment.condition,
        warrantyEndDate: equipment.warrantyEndDate
          ? new Date(equipment.warrantyEndDate)
          : null,
        notes: equipment.notes,
      },
    });
    equipmentByAssetTag[equipment.assetTag] = saved.id;
  }

  return equipmentByAssetTag;
}

async function recreateAssignments(
  employeeByCpf: Record<string, string>,
  equipmentByAssetTag: Record<string, string>
) {
  const allAssetTags = [
    ...ACTIVE_ASSIGNMENTS.map((assignment) => assignment.assetTag),
    ...RETURNED_ASSIGNMENTS.map((assignment) => assignment.assetTag),
  ];
  const involvedEquipmentIds = allAssetTags
    .map((assetTag) => equipmentByAssetTag[assetTag])
    .filter(Boolean);

  if (involvedEquipmentIds.length) {
    await prisma.equipmentAssignment.deleteMany({
      where: {
        equipmentId: { in: involvedEquipmentIds },
      },
    });
  }

  for (const assignment of RETURNED_ASSIGNMENTS) {
    const equipmentId = equipmentByAssetTag[assignment.assetTag];
    const employeeId = employeeByCpf[assignment.employeeCpf];
    if (!equipmentId || !employeeId) continue;

    await prisma.equipmentAssignment.create({
      data: {
        equipmentId,
        employeeId,
        assignedAt: new Date(assignment.assignedAt),
        expectedReturnAt: new Date(assignment.expectedReturnAt),
        returnedAt: new Date(assignment.returnedAt),
        deliveryCondition: assignment.deliveryCondition,
        returnCondition: assignment.returnCondition,
        deliveryTermNumber: assignment.deliveryTermNumber,
        notes: assignment.notes,
      },
    });

    await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        status: EquipmentStatus.IN_STOCK,
        condition: assignment.returnCondition,
      },
    });
  }

  for (const assignment of ACTIVE_ASSIGNMENTS) {
    const equipmentId = equipmentByAssetTag[assignment.assetTag];
    const employeeId = employeeByCpf[assignment.employeeCpf];
    if (!equipmentId || !employeeId) continue;

    await prisma.equipmentAssignment.create({
      data: {
        equipmentId,
        employeeId,
        assignedAt: new Date(assignment.assignedAt),
        expectedReturnAt: new Date(assignment.expectedReturnAt),
        deliveryCondition: assignment.deliveryCondition,
        deliveryTermNumber: assignment.deliveryTermNumber,
        notes: assignment.notes,
      },
    });

    await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        status: EquipmentStatus.ASSIGNED,
        condition: assignment.deliveryCondition,
      },
    });
  }
}

async function main() {
  console.log('🌱 Iniciando seed de ativos para testes do chatbot...');
  await ensureDefaultAdmin();

  const teamIdsByName = await ensureTeams();
  const employeeByCpf = await upsertEmployees(teamIdsByName);
  const equipmentByAssetTag = await upsertEquipments();
  await recreateAssignments(employeeByCpf, equipmentByAssetTag);

  const [employeeCount, equipmentCount, activeAssignmentsCount, historyCount] =
    await Promise.all([
      prisma.employee.count(),
      prisma.equipment.count(),
      prisma.equipmentAssignment.count({ where: { returnedAt: null } }),
      prisma.equipmentAssignment.count({ where: { returnedAt: { not: null } } }),
    ]);

  console.log('✅ Seed de ativos/chat finalizado.');
  console.log(
    `Resumo: colaboradores=${employeeCount}, equipamentos=${equipmentCount}, entregasAtivas=${activeAssignmentsCount}, historicoDevolucoes=${historyCount}`
  );
  console.log('Sugestões para teste no chat:');
  console.log('- Com quem está a máquina PAT-NB-1001?');
  console.log('- Quais itens a Ana Paula Ribeiro tem e quando recebeu?');
  console.log('- Quem está com o patrimônio PAT-NB-1003?');
  console.log('- O que o Bruno Tavares recebeu na admissão?');
}

main()
  .catch((error) => {
    console.error('❌ Erro no seed de ativos/chat:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
