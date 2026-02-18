import {
  AccessLevel,
  ModuleKey,
  PrismaClient,
  SubmoduleKey,
  UserRole,
  TagGroup,
  TicketStatus,
  TicketPriority,
  TicketType,
  InfraType,
  TeamRole,
  TechnicianJournalEntryType,
} from '@prisma/client';
import { hashPassword } from '../src/utils/password';
import { PERMISSION_CATALOG } from '../src/domains/iam/entitlements/permissionCatalog';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Criar usuários padrão
  const adminPassword = await hashPassword('admin123');
  const triagerPassword = await hashPassword('triager123');
  const technicianPassword = await hashPassword('technician123');
  const requesterPassword = await hashPassword('requester123');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@example.com',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      department: 'TI',
    },
  });

  const triager = await prisma.user.upsert({
    where: { email: 'triager@example.com' },
    update: {},
    create: {
      name: 'Triagista',
      email: 'triager@example.com',
      passwordHash: triagerPassword,
      role: UserRole.TRIAGER,
      department: 'Suporte',
    },
  });

  const technician = await prisma.user.upsert({
    where: { email: 'technician@example.com' },
    update: {},
    create: {
      name: 'Técnico',
      email: 'technician@example.com',
      passwordHash: technicianPassword,
      role: UserRole.TECHNICIAN,
      department: 'Suporte',
    },
  });

  const requester = await prisma.user.upsert({
    where: { email: 'requester@example.com' },
    update: {},
    create: {
      name: 'Solicitante',
      email: 'requester@example.com',
      passwordHash: requesterPassword,
      role: UserRole.REQUESTER,
      department: 'Vendas',
    },
  });

  // RBAC + catálogo enterprise de permissões
  const permissionKeys = PERMISSION_CATALOG.map((key) => ({
    key,
    description: `Permission ${key}`,
  }));

  const permissionsByKey = new Map<string, { id: string }>();
  for (const permission of permissionKeys) {
    const created = await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: { key: permission.key, description: permission.description },
      select: { id: true, key: true },
    });
    permissionsByKey.set(permission.key, { id: created.id });
  }

  const roleNames = [
    { name: 'ADMIN', description: 'Administrador da plataforma' },
    { name: 'SRE_IT', description: 'Operações de ITSM e Ativos' },
    { name: 'RH', description: 'Operações de RH' },
    { name: 'HR_ADMIN', description: 'Operações de RH com PII estendida' },
    { name: 'FINANCE', description: 'Operações de Financeiro' },
    { name: 'FINANCE_APPROVER', description: 'Aprovador financeiro' },
    { name: 'MANAGER', description: 'Gestor de equipe' },
    { name: 'EMPLOYEE', description: 'Colaborador padrão' },
  ] as const;

  const rolesByName = new Map<string, { id: string }>();
  for (const role of roleNames) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
      select: { id: true, name: true },
    });
    rolesByName.set(role.name, { id: created.id });
  }

  const byPrefix = (prefix: string) => permissionKeys.map((p) => p.key).filter((key) => key.startsWith(prefix));
  const without = (items: string[], excluded: string[]) => items.filter((item) => !excluded.includes(item));
  const uniq = (items: string[]) => [...new Set(items)];

  const rolePermissions: Record<string, string[]> = {
    ADMIN: permissionKeys.map((permission) => permission.key),
    SRE_IT: uniq([
      ...byPrefix('itsm.'),
      ...byPrefix('assets.'),
      'audit.read',
      'platform.users.read',
    ]),
    RH: uniq([
      ...without(byPrefix('hr.'), ['hr.employee.write_pii']),
      'assets.assignment.read',
      'assets.equipment.read',
      'itsm.ticket.read',
    ]),
    HR_ADMIN: byPrefix('hr.'),
    FINANCE: uniq([
      ...without(byPrefix('finance.'), ['finance.approval.approve']),
      'assets.equipment.read',
    ]),
    FINANCE_APPROVER: uniq([...byPrefix('finance.'), 'finance.approval.approve', 'assets.equipment.read']),
    MANAGER: uniq(['hr.employee.read', 'assets.assignment.read', 'itsm.ticket.read']),
    EMPLOYEE: uniq(['itsm.view', 'itsm.ticket.read', 'itsm.ticket.write', 'hr.policy.read', 'hr.ack.write', 'assets.assignment.read']),
  };

  for (const [roleName, keys] of Object.entries(rolePermissions)) {
    const role = rolesByName.get(roleName);
    if (!role) continue;
    for (const key of keys) {
      const permission = permissionsByKey.get(key);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: rolesByName.get('ADMIN')!.id } },
    update: {},
    create: { userId: admin.id, roleId: rolesByName.get('ADMIN')!.id },
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: triager.id, roleId: rolesByName.get('SRE_IT')!.id } },
    update: {},
    create: { userId: triager.id, roleId: rolesByName.get('SRE_IT')!.id },
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: technician.id, roleId: rolesByName.get('EMPLOYEE')!.id } },
    update: {},
    create: { userId: technician.id, roleId: rolesByName.get('EMPLOYEE')!.id },
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: requester.id, roleId: rolesByName.get('EMPLOYEE')!.id } },
    update: {},
    create: { userId: requester.id, roleId: rolesByName.get('EMPLOYEE')!.id },
  });

  const setEntitlements = async (
    userId: string,
    entries: Array<{ module: ModuleKey; submodule: SubmoduleKey; level: AccessLevel }>
  ) => {
    await prisma.userEntitlement.deleteMany({ where: { userId } });
    if (entries.length) {
      await prisma.userEntitlement.createMany({
        data: entries.map((entry) => ({
          userId,
          module: entry.module,
          submodule: entry.submodule,
          level: entry.level,
        })),
      });
    }
  };

  const allSubmodules = Object.values(SubmoduleKey);
  const adminEntitlements = allSubmodules.map((submodule) => ({
    module: (submodule.startsWith('ADMIN_')
      ? 'ADMIN'
      : submodule.startsWith('ITSM_')
        ? 'ITSM'
        : submodule.startsWith('HR_')
          ? 'HR'
          : submodule.startsWith('FINANCE_')
            ? 'FINANCE'
            : submodule.startsWith('ASSETS_')
              ? 'ASSETS'
              : 'COMPLIANCE') as ModuleKey,
    submodule,
    level: AccessLevel.WRITE,
  }));

  await setEntitlements(admin.id, adminEntitlements);
  await setEntitlements(
    triager.id,
    Object.values(SubmoduleKey)
      .filter((submodule) => submodule.startsWith('ITSM_') || submodule.startsWith('ASSETS_'))
      .map((submodule) => ({
        module: submodule.startsWith('ITSM_') ? ModuleKey.ITSM : ModuleKey.ASSETS,
        submodule,
        level: AccessLevel.WRITE,
      }))
  );
  await setEntitlements(
    technician.id,
    [
      SubmoduleKey.ITSM_TICKETS,
      SubmoduleKey.ASSETS_ASSIGNMENTS,
      SubmoduleKey.ASSETS_EQUIPMENT,
    ].map((submodule) => ({
      module: submodule.startsWith('ITSM_') ? ModuleKey.ITSM : ModuleKey.ASSETS,
      submodule,
      level: AccessLevel.READ,
    }))
  );
  await setEntitlements(requester.id, [
    { module: ModuleKey.ITSM, submodule: SubmoduleKey.ITSM_TICKETS, level: AccessLevel.WRITE },
    { module: ModuleKey.HR, submodule: SubmoduleKey.HR_POLICIES, level: AccessLevel.READ },
    { module: ModuleKey.ASSETS, submodule: SubmoduleKey.ASSETS_ASSIGNMENTS, level: AccessLevel.READ },
  ]);

  // Dados base de financeiro/procurement
  await prisma.costCenter.upsert({
    where: { code: 'CC-TI-001' },
    update: { name: 'Tecnologia da Informação', ownerUserId: admin.id },
    create: {
      code: 'CC-TI-001',
      name: 'Tecnologia da Informação',
      ownerUserId: admin.id,
    },
  });
  await prisma.costCenter.upsert({
    where: { code: 'CC-RH-001' },
    update: { name: 'Recursos Humanos', ownerUserId: admin.id },
    create: {
      code: 'CC-RH-001',
      name: 'Recursos Humanos',
      ownerUserId: admin.id,
    },
  });
  await prisma.costCenter.upsert({
    where: { code: 'CC-OPS-001' },
    update: { name: 'Operações', ownerUserId: admin.id },
    create: {
      code: 'CC-OPS-001',
      name: 'Operações',
      ownerUserId: admin.id,
    },
  });

  await prisma.vendor.upsert({
    where: { taxId: '12.345.678/0001-90' },
    update: {
      name: 'Tech Distribuidora Ltda',
      contactEmail: 'compras@techdistribuidora.example',
    },
    create: {
      name: 'Tech Distribuidora Ltda',
      taxId: '12.345.678/0001-90',
      contactEmail: 'compras@techdistribuidora.example',
    },
  });
  await prisma.vendor.upsert({
    where: { taxId: '98.765.432/0001-10' },
    update: {
      name: 'Office Solutions SA',
      contactEmail: 'vendas@officesolutions.example',
    },
    create: {
      name: 'Office Solutions SA',
      taxId: '98.765.432/0001-10',
      contactEmail: 'vendas@officesolutions.example',
    },
  });

  await prisma.stockLocation.upsert({
    where: { name: 'Estoque Principal' },
    update: { active: true },
    create: {
      name: 'Estoque Principal',
      active: true,
    },
  });

  // Políticas e templates operacionais de RH (base)
  await prisma.policy.upsert({
    where: { key: 'hr.code-of-conduct' },
    update: {
      title: 'Código de Conduta',
      version: '1.0',
      contentUrl: 'https://intranet.local/policies/code-of-conduct',
      active: true,
    },
    create: {
      key: 'hr.code-of-conduct',
      title: 'Código de Conduta',
      version: '1.0',
      contentUrl: 'https://intranet.local/policies/code-of-conduct',
      active: true,
    },
  });

  await prisma.policy.upsert({
    where: { key: 'hr.security-awareness' },
    update: {
      title: 'Política de Segurança da Informação',
      version: '1.0',
      contentUrl: 'https://intranet.local/policies/security-awareness',
      active: true,
    },
    create: {
      key: 'hr.security-awareness',
      title: 'Política de Segurança da Informação',
      version: '1.0',
      contentUrl: 'https://intranet.local/policies/security-awareness',
      active: true,
    },
  });

  await prisma.platformSetting.upsert({
    where: { key: 'hr.caseTemplates' },
    update: {
      valueJson: {
        onboarding: [
          'Provisionar conta corporativa e acessos iniciais',
          'Entregar kit de equipamentos e registrar aceite',
          'Aplicar treinamentos obrigatórios e políticas',
        ],
        offboarding: [
          'Revogar acessos corporativos (SSO, email, VPN)',
          'Encerrar pendências administrativas e financeiras',
          'Coletar evidências/documentos do desligamento',
          'Recolher todos os equipamentos atribuídos',
        ],
      },
      isSecret: false,
      updatedById: admin.id,
    },
    create: {
      key: 'hr.caseTemplates',
      valueJson: {
        onboarding: [
          'Provisionar conta corporativa e acessos iniciais',
          'Entregar kit de equipamentos e registrar aceite',
          'Aplicar treinamentos obrigatórios e políticas',
        ],
        offboarding: [
          'Revogar acessos corporativos (SSO, email, VPN)',
          'Encerrar pendências administrativas e financeiras',
          'Coletar evidências/documentos do desligamento',
          'Recolher todos os equipamentos atribuídos',
        ],
      },
      isSecret: false,
      updatedById: admin.id,
    },
  });

  // Criar categorias padrão
  const category1 = await prisma.category.upsert({
    where: { name: 'Hardware' },
    update: {},
    create: {
      name: 'Hardware',
      active: true,
    },
  });

  const category2 = await prisma.category.upsert({
    where: { name: 'Software' },
    update: {},
    create: {
      name: 'Software',
      active: true,
    },
  });

  const category3 = await prisma.category.upsert({
    where: { name: 'Rede' },
    update: {},
    create: {
      name: 'Rede',
      active: true,
    },
  });

  // Criar tags iniciais
  console.log('📋 Criando tags iniciais...');

  // Tags de Feature
  const featureTags = [
    'feature:login',
    'feature:relatorios',
    'feature:dashboard',
    'feature:integracao_facebook',
    'feature:api_publica',
    'feature:automacoes',
  ];

  for (const tagName of featureTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.FEATURE,
        isActive: true,
      },
    });
  }

  // Tags de Área
  const areaTags = [
    'area:dados',
    'area:sre',
    'area:marketing',
    'area:criativo',
    'area:produto',
    'area:comercial',
    'area:cs',
  ];

  for (const tagName of areaTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.AREA,
        isActive: true,
      },
    });
  }

  // Tags de Ambiente
  const envTags = ['env:prod', 'env:staging', 'env:homolog', 'env:local'];

  for (const tagName of envTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.ENV,
        isActive: true,
      },
    });
  }

  // Tags de Plataforma
  const platformTags = ['platform:web', 'platform:mobile', 'platform:api'];

  for (const tagName of platformTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.PLATFORM,
        isActive: true,
      },
    });
  }

  // Tags de Origem
  const sourceTags = [
    'source:portal',
    'source:email',
    'source:slack',
    'source:whatsapp',
    'source:interno',
  ];

  for (const tagName of sourceTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.SOURCE,
        isActive: true,
      },
    });
  }

  // Tags de Impacto
  const impactTags = [
    'impact:campanha_ativa',
    'impact:perda_receita',
    'impact:imagem_marca',
    'impact:sla_cliente_enterprise',
    'impact:interno_apenas',
  ];

  for (const tagName of impactTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.IMPACT,
        isActive: true,
      },
    });
  }

  // Tags de Causa Raiz (RC)
  const rcTags = [
    'rc:bug_codigo',
    'rc:regressao',
    'rc:config_errada',
    'rc:deploy_mal_sucedido',
    'rc:terceiro_fornecedor',
    'rc:dado_inconsistente',
    'rc:infra_capacidade',
    'rc:infra_rede',
    'rc:uso_incorreto_produto',
    'rc:documentacao_insuficiente',
    'rc:treinamento_usuario',
  ];

  for (const tagName of rcTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.RC,
        isActive: true,
      },
    });
  }

  // Tags de Status Reason
  const statusReasonTags = [
    'status_reason:aguardando_cliente',
    'status_reason:aguardando_terceiro',
    'status_reason:aguardando_implantacao',
    'status_reason:aguardando_priorizacao',
    'status_reason:backlog_produto',
  ];

  for (const tagName of statusReasonTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.STATUS_REASON,
        isActive: true,
      },
    });
  }

  // Tags de Trabalho
  const workTags = [
    'work:manutencao_corretiva',
    'work:manutencao_evolutiva',
    'work:refatoracao',
    'work:debito_tecnico',
    'work:melhoria_experiencia',
    'work:ajuste_campanha',
    'work:automacao_processos',
  ];

  for (const tagName of workTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.WORK,
        isActive: true,
      },
    });
  }

  // Tags de Dúvida (Question)
  const questionTags = [
    'question:uso_plataforma',
    'question:processo_interno',
    'question:comercial_condicoes',
    'question:marketing_midia_paga',
    'question:relatorios_dados',
    'question:infra_duvida',
    'question:seguranca_politicas',
  ];

  for (const tagName of questionTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.QUESTION,
        isActive: true,
      },
    });
  }

  // Tags de Infraestrutura
  const infraTags = [
    // Rede/Internet
    'infra:sem_internet',
    'infra:rede_cabo',
    'infra:wifi',
    'infra:switch',
    'infra:roteador',
    'infra:dhcp',
    'infra:dns_local',
    // Estação de trabalho
    'infra:desktop',
    'infra:notebook',
    'infra:monitor',
    'infra:teclado_mouse',
    // Servidores / apps locais
    'infra:servidor_local',
    'infra:subir_nova_aplicacao',
    'infra:deploy_on_prem',
    'infra:backup_local',
    // Outros
    'infra:impressora',
    'infra:telefonia_voip',
    'infra:nobreak_energia',
  ];

  for (const tagName of infraTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        group: TagGroup.INFRA,
        isActive: true,
      },
    });
  }

  // Criar times
  console.log('👥 Criando times...');
  const teamSuporte = await prisma.team.upsert({
    where: { name: 'Suporte Técnico' },
    update: {},
    create: {
      name: 'Suporte Técnico',
      description: 'Time responsável por suporte técnico e incidentes',
    },
  });

  const teamDesenvolvimento = await prisma.team.upsert({
    where: { name: 'Desenvolvimento' },
    update: {},
    create: {
      name: 'Desenvolvimento',
      description: 'Time de desenvolvimento de software',
    },
  });

  const teamInfraestrutura = await prisma.team.upsert({
    where: { name: 'Infraestrutura' },
    update: {},
    create: {
      name: 'Infraestrutura',
      description: 'Time de infraestrutura e DevOps',
    },
  });

  // Adicionar usuários aos times
  await prisma.userTeam.upsert({
    where: { userId_teamId: { userId: technician.id, teamId: teamSuporte.id } },
    update: {},
    create: {
      userId: technician.id,
      teamId: teamSuporte.id,
      role: TeamRole.MEMBER,
    },
  });

  await prisma.userTeam.upsert({
    where: { userId_teamId: { userId: triager.id, teamId: teamSuporte.id } },
    update: {},
    create: {
      userId: triager.id,
      teamId: teamSuporte.id,
      role: TeamRole.LEAD,
    },
  });

  // Criar mais técnicos para ter mais dados
  const technician2 = await prisma.user.upsert({
    where: { email: 'tech2@example.com' },
    update: {},
    create: {
      name: 'Técnico 2',
      email: 'tech2@example.com',
      passwordHash: technicianPassword,
      role: UserRole.TECHNICIAN,
      department: 'Suporte',
    },
  });

  const technician3 = await prisma.user.upsert({
    where: { email: 'tech3@example.com' },
    update: {},
    create: {
      name: 'Técnico 3',
      email: 'tech3@example.com',
      passwordHash: technicianPassword,
      role: UserRole.TECHNICIAN,
      department: 'Desenvolvimento',
    },
  });

  await prisma.userTeam.upsert({
    where: { userId_teamId: { userId: technician2.id, teamId: teamSuporte.id } },
    update: {},
    create: {
      userId: technician2.id,
      teamId: teamSuporte.id,
      role: TeamRole.MEMBER,
    },
  });

  await prisma.userTeam.upsert({
    where: { userId_teamId: { userId: technician3.id, teamId: teamDesenvolvimento.id } },
    update: {},
    create: {
      userId: technician3.id,
      teamId: teamDesenvolvimento.id,
      role: TeamRole.MEMBER,
    },
  });

  // Buscar algumas tags para usar nos tickets
  const tagFeature = await prisma.tag.findFirst({ where: { name: 'feature:dashboard' } });
  const tagArea = await prisma.tag.findFirst({ where: { name: 'area:produto' } });
  const tagEnv = await prisma.tag.findFirst({ where: { name: 'env:prod' } });

  console.log('🎫 Criando tickets fictícios...');

  // Criar projetos (TASK) com tarefas filhas
  const projeto1 = await prisma.ticket.create({
    data: {
      title: 'Projeto: Migração para Cloud',
      description: 'Projeto completo de migração da infraestrutura para nuvem, incluindo planejamento, execução e validação.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      tipo: TicketType.TASK,
      requesterId: admin.id,
      assignedTechnicianId: technician3.id,
      categoryId: category2.id,
      teamId: teamDesenvolvimento.id,
      teamSolicitanteId: teamDesenvolvimento.id,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      estimatedMinutes: 12000, // 200 horas
      customFields: {
        budget: 50000,
        stakeholders: ['CTO', 'Diretor de TI'],
        fase: 'Execução',
      },
    },
  });

  // Tarefas filhas do projeto 1
  const tarefa1_1 = await prisma.ticket.create({
    data: {
      title: 'Análise de requisitos de migração',
      description: 'Analisar todos os requisitos técnicos e de negócio para a migração.',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.HIGH,
      tipo: TicketType.TASK,
      requesterId: admin.id,
      assignedTechnicianId: technician3.id,
      categoryId: category2.id,
      teamId: teamDesenvolvimento.id,
      teamSolicitanteId: teamDesenvolvimento.id,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 2400, // 40 horas
    },
  });

  const tarefa1_2 = await prisma.ticket.create({
    data: {
      title: 'Configuração de ambientes na nuvem',
      description: 'Configurar ambientes de desenvolvimento, staging e produção na nuvem.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      tipo: TicketType.TASK,
      requesterId: admin.id,
      assignedTechnicianId: technician3.id,
      categoryId: category2.id,
      teamId: teamDesenvolvimento.id,
      teamSolicitanteId: teamDesenvolvimento.id,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 3600, // 60 horas
    },
  });

  const tarefa1_3 = await prisma.ticket.create({
    data: {
      title: 'Testes de validação pós-migração',
      description: 'Executar testes completos após a migração para validar funcionamento.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      tipo: TicketType.TASK,
      requesterId: admin.id,
      assignedTechnicianId: technician3.id,
      categoryId: category2.id,
      teamId: teamDesenvolvimento.id,
      teamSolicitanteId: teamDesenvolvimento.id,
      dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 1800, // 30 horas
    },
  });

  // Criar relações PARENT_OF / CHILD_OF
  await prisma.ticketRelation.createMany({
    data: [
      { ticketId: projeto1.id, relatedTicketId: tarefa1_1.id, relationType: 'PARENT_OF' },
      { ticketId: tarefa1_1.id, relatedTicketId: projeto1.id, relationType: 'CHILD_OF' },
      { ticketId: projeto1.id, relatedTicketId: tarefa1_2.id, relationType: 'PARENT_OF' },
      { ticketId: tarefa1_2.id, relatedTicketId: projeto1.id, relationType: 'CHILD_OF' },
      { ticketId: projeto1.id, relatedTicketId: tarefa1_3.id, relationType: 'PARENT_OF' },
      { ticketId: tarefa1_3.id, relatedTicketId: projeto1.id, relationType: 'CHILD_OF' },
    ],
  });

  // Adicionar worklogs para tarefa1_1 (já resolvida)
  await prisma.ticketWorklog.createMany({
    data: [
      {
        ticketId: tarefa1_1.id,
        userId: technician3.id,
        durationMinutes: 2200, // 36.67 horas (menos que estimado)
        description: 'Análise completa dos requisitos técnicos e de negócio',
      },
      {
        ticketId: tarefa1_1.id,
        userId: technician3.id,
        durationMinutes: 200, // 3.33 horas
        description: 'Documentação dos requisitos',
      },
    ],
  });

  // Adicionar worklog parcial para tarefa1_2 (em progresso)
  await prisma.ticketWorklog.create({
    data: {
      ticketId: tarefa1_2.id,
      userId: technician3.id,
      durationMinutes: 1800, // 30 horas (50% do estimado)
      description: 'Configuração inicial dos ambientes',
    },
  });

  // Projeto 2: Melhoria de Performance
  const projeto2 = await prisma.ticket.create({
    data: {
      title: 'Projeto: Otimização de Performance',
      description: 'Projeto para melhorar a performance geral da aplicação.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      tipo: TicketType.TASK,
      requesterId: requester.id,
      assignedTechnicianId: technician2.id,
      categoryId: category2.id,
      teamId: teamDesenvolvimento.id,
      teamSolicitanteId: teamSuporte.id,
      dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 4800, // 80 horas
      customFields: {
        objetivo: 'Reduzir tempo de resposta em 50%',
        metricas: ['response_time', 'throughput'],
      },
    },
  });

  const tarefa2_1 = await prisma.ticket.create({
    data: {
      title: 'Análise de gargalos',
      description: 'Identificar gargalos de performance na aplicação.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.MEDIUM,
      tipo: TicketType.TASK,
      requesterId: requester.id,
      assignedTechnicianId: technician2.id,
      categoryId: category2.id,
      teamId: teamDesenvolvimento.id,
      teamSolicitanteId: teamSuporte.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 1200, // 20 horas
    },
  });

  await prisma.ticketRelation.createMany({
    data: [
      { ticketId: projeto2.id, relatedTicketId: tarefa2_1.id, relationType: 'PARENT_OF' },
      { ticketId: tarefa2_1.id, relatedTicketId: projeto2.id, relationType: 'CHILD_OF' },
    ],
  });

  // Criar tickets de incidentes variados
  const incidentes = [
    {
      title: 'Erro ao fazer login no sistema',
      description: 'Usuários estão reportando erro 500 ao tentar fazer login.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.CRITICAL,
      tipo: TicketType.INCIDENT,
      requesterId: requester.id,
      assignedTechnicianId: technician.id,
      categoryId: category2.id,
      teamId: teamSuporte.id,
      teamSolicitanteId: teamSuporte.id,
      infraTipo: InfraType.NUVEM,
    },
    {
      title: 'Servidor de produção lento',
      description: 'Servidor apresentando lentidão durante horário de pico.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      tipo: TicketType.INCIDENT,
      requesterId: admin.id,
      assignedTechnicianId: technician2.id,
      categoryId: category1.id,
      teamId: teamInfraestrutura.id,
      teamSolicitanteId: teamInfraestrutura.id,
      infraTipo: InfraType.NUVEM,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 480, // 8 horas
    },
    {
      title: 'Falha na integração com API externa',
      description: 'API de pagamento não está respondendo corretamente.',
      status: TicketStatus.WAITING_THIRD_PARTY,
      priority: TicketPriority.HIGH,
      tipo: TicketType.INCIDENT,
      requesterId: requester.id,
      assignedTechnicianId: technician.id,
      categoryId: category2.id,
      teamId: teamDesenvolvimento.id,
      teamSolicitanteId: teamSuporte.id,
    },
    {
      title: 'Impressora não está funcionando',
      description: 'Impressora do escritório principal não está imprimindo.',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.LOW,
      tipo: TicketType.INCIDENT,
      requesterId: requester.id,
      assignedTechnicianId: technician.id,
      categoryId: category1.id,
      teamId: teamSuporte.id,
      teamSolicitanteId: teamSuporte.id,
      infraTipo: InfraType.ESTACAO_TRABALHO,
      resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Backup automático falhou',
      description: 'Backup automático do banco de dados falhou na última execução.',
      status: TicketStatus.CLOSED,
      priority: TicketPriority.MEDIUM,
      tipo: TicketType.INCIDENT,
      requesterId: admin.id,
      assignedTechnicianId: technician2.id,
      categoryId: category3.id,
      teamId: teamInfraestrutura.id,
      teamSolicitanteId: teamInfraestrutura.id,
      infraTipo: InfraType.SERVIDOR_FISICO,
      resolvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  ];

  const ticketsCriados = [];
  for (const incidente of incidentes) {
    const ticket = await prisma.ticket.create({ data: incidente });
    ticketsCriados.push(ticket);

    // Adicionar tags a alguns tickets
    if (tagFeature && tagArea) {
      await prisma.ticketTag.createMany({
        data: [
          { ticketId: ticket.id, tagId: tagFeature.id },
          { ticketId: ticket.id, tagId: tagArea.id },
        ],
        skipDuplicates: true,
      });
    }
  }

  // Criar solicitações de serviço
  const solicitacoes = [
    {
      title: 'Solicitação de novo usuário',
      description: 'Preciso criar acesso para novo funcionário do departamento de vendas.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      tipo: TicketType.SERVICE_REQUEST,
      requesterId: requester.id,
      assignedTechnicianId: technician.id,
      categoryId: category2.id,
      teamId: teamSuporte.id,
      teamSolicitanteId: teamSuporte.id,
    },
    {
      title: 'Instalação de software',
      description: 'Necessário instalar Adobe Creative Suite em 5 estações de trabalho.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.LOW,
      tipo: TicketType.SERVICE_REQUEST,
      requesterId: requester.id,
      assignedTechnicianId: technician2.id,
      categoryId: category1.id,
      teamId: teamSuporte.id,
      teamSolicitanteId: teamSuporte.id,
      infraTipo: InfraType.ESTACAO_TRABALHO,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 600, // 10 horas
    },
  ];

  for (const solicitacao of solicitacoes) {
    await prisma.ticket.create({ data: solicitacao });
  }

  // Criar problemas (PROBLEM)
  const problemas = [
    {
      title: 'Problema recorrente: Timeout em queries',
      description: 'Queries do banco de dados estão apresentando timeout com frequência.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      tipo: TicketType.PROBLEM,
      requesterId: admin.id,
      assignedTechnicianId: technician3.id,
      categoryId: category3.id,
      teamId: teamDesenvolvimento.id,
      teamSolicitanteId: teamDesenvolvimento.id,
      customFields: {
        ocorrencias: 15,
        primeiro_ocorrencia: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        impacto: 'Alto',
      },
    },
  ];

  for (const problema of problemas) {
    await prisma.ticket.create({ data: problema });
  }

  // Criar mudanças (CHANGE)
  const mudancas = [
    {
      title: 'Mudança: Atualização de versão do banco',
      description: 'Atualizar PostgreSQL da versão 13 para 15 em produção.',
      status: TicketStatus.WAITING_REQUESTER,
      priority: TicketPriority.HIGH,
      tipo: TicketType.CHANGE,
      requesterId: admin.id,
      assignedTechnicianId: technician2.id,
      categoryId: category3.id,
      teamId: teamInfraestrutura.id,
      teamSolicitanteId: teamInfraestrutura.id,
      infraTipo: InfraType.SERVIDOR_FISICO,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 2400, // 40 horas
      customFields: {
        janela_manutencao: '2024-01-20 02:00',
        rollback_plan: 'Disponível',
      },
    },
  ];

  for (const mudanca of mudancas) {
    await prisma.ticket.create({ data: mudanca });
  }

  // Criar dúvidas (QUESTION)
  const duvidas = [
    {
      title: 'Como configurar acesso remoto?',
      description: 'Preciso de orientação sobre como configurar acesso remoto para minha equipe.',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.LOW,
      tipo: TicketType.QUESTION,
      requesterId: requester.id,
      assignedTechnicianId: technician.id,
      categoryId: category3.id,
      teamId: teamSuporte.id,
      teamSolicitanteId: teamSuporte.id,
      resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const duvida of duvidas) {
    const ticket = await prisma.ticket.create({ data: duvida });
    // Dúvidas precisam de tags
    if (tagArea) {
      await prisma.ticketTag.create({
        data: { ticketId: ticket.id, tagId: tagArea.id },
      });
    }
  }

  // Adicionar alguns comentários
  await prisma.ticketComment.createMany({
    data: [
      {
        ticketId: projeto1.id,
        authorId: technician3.id,
        type: 'PUBLIC',
        content: 'Iniciando análise dos requisitos. Primeira etapa em andamento.',
      },
      {
        ticketId: ticketsCriados[0].id,
        authorId: technician.id,
        type: 'PUBLIC',
        content: 'Investigando o problema. Parece ser relacionado à autenticação.',
      },
      {
        ticketId: ticketsCriados[1].id,
        authorId: technician2.id,
        type: 'INTERNAL',
        content: 'Aumentando capacidade do servidor. Monitorando performance.',
      },
      {
        ticketId: tarefa1_2.id,
        authorId: technician3.id,
        type: 'PUBLIC',
        content: 'Configuração dos ambientes em andamento. Progresso de 50%.',
      },
      {
        ticketId: projeto2.id,
        authorId: technician2.id,
        type: 'PUBLIC',
        content: 'Iniciando análise de performance. Identificando pontos críticos.',
      },
    ],
  });

  // Adicionar mais worklogs para outros tickets
  await prisma.ticketWorklog.createMany({
    data: [
      {
        ticketId: ticketsCriados[1].id,
        userId: technician2.id,
        durationMinutes: 360, // 6 horas
        description: 'Análise inicial do problema de performance',
      },
      {
        ticketId: ticketsCriados[1].id,
        userId: technician2.id,
        durationMinutes: 120, // 2 horas
        description: 'Ajustes na configuração do servidor',
      },
      {
        ticketId: (await prisma.ticket.findFirst({ where: { title: 'Instalação de software' } }))?.id || ticketsCriados[0].id,
        userId: technician2.id,
        durationMinutes: 180, // 3 horas
        description: 'Instalação parcial do software',
      },
    ],
  });

  // Criar mais tickets para popular melhor o Kanban
  const maisTickets = [
    {
      title: 'Atualização de documentação técnica',
      description: 'Atualizar documentação técnica do sistema principal.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.LOW,
      tipo: TicketType.TASK,
      requesterId: admin.id,
      assignedTechnicianId: technician3.id,
      categoryId: category2.id,
      teamId: teamDesenvolvimento.id,
      teamSolicitanteId: teamDesenvolvimento.id,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 600, // 10 horas
    },
    {
      title: 'Configuração de monitoramento',
      description: 'Configurar sistema de monitoramento para novos servidores.',
      status: TicketStatus.WAITING_REQUESTER,
      priority: TicketPriority.MEDIUM,
      tipo: TicketType.SERVICE_REQUEST,
      requesterId: requester.id,
      assignedTechnicianId: technician2.id,
      categoryId: category3.id,
      teamId: teamInfraestrutura.id,
      teamSolicitanteId: teamInfraestrutura.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 480, // 8 horas
    },
    {
      title: 'Treinamento de equipe',
      description: 'Realizar treinamento sobre novo processo de deploy.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.MEDIUM,
      tipo: TicketType.SERVICE_REQUEST,
      requesterId: admin.id,
      assignedTechnicianId: technician.id,
      categoryId: category2.id,
      teamId: teamSuporte.id,
      teamSolicitanteId: teamSuporte.id,
    },
    {
      title: 'Revisão de código',
      description: 'Revisar código da feature de autenticação.',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.MEDIUM,
      tipo: TicketType.TASK,
      requesterId: admin.id,
      assignedTechnicianId: technician3.id,
      categoryId: category2.id,
      teamId: teamDesenvolvimento.id,
      teamSolicitanteId: teamDesenvolvimento.id,
      resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Backup de segurança',
      description: 'Executar backup completo de segurança dos dados.',
      status: TicketStatus.CLOSED,
      priority: TicketPriority.HIGH,
      tipo: TicketType.TASK,
      requesterId: admin.id,
      assignedTechnicianId: technician2.id,
      categoryId: category3.id,
      teamId: teamInfraestrutura.id,
      teamSolicitanteId: teamInfraestrutura.id,
      resolvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const ticketData of maisTickets) {
    await prisma.ticket.create({ data: ticketData });
  }

  console.log('📔 Criando entradas no diário dos técnicos...');

  // Buscar worklogs criados para criar entradas automáticas
  const worklogs = await prisma.ticketWorklog.findMany({
    include: {
      ticket: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  // Criar entradas automáticas para worklogs
  for (const worklog of worklogs) {
    // Verificar se já existe entrada para este worklog
    const existingEntry = await prisma.technicianJournalEntry.findUnique({
      where: { worklogId: worklog.id },
    });

    if (!existingEntry) {
      const hours = Math.floor(worklog.durationMinutes / 60);
      const minutes = worklog.durationMinutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
      
      await prisma.technicianJournalEntry.create({
        data: {
          technicianId: worklog.userId,
          type: TechnicianJournalEntryType.AUTO_TICKET_WORKLOG,
          ticketId: worklog.ticketId,
          worklogId: worklog.id,
          description: `Registrei ${timeStr} de trabalho no ticket #${worklog.ticket.id.substring(0, 8)} - ${worklog.ticket.title}${worklog.description ? `. ${worklog.description}` : ''}`,
          source: 'worklog',
        },
      });
    }
  }

  // Buscar comentários criados por técnicos para criar entradas automáticas
  const comentarios = await prisma.ticketComment.findMany({
    where: {
      author: {
        role: {
          in: [UserRole.TECHNICIAN, UserRole.TRIAGER, UserRole.ADMIN],
        },
      },
      type: 'PUBLIC',
    },
    include: {
      ticket: {
        select: {
          id: true,
          title: true,
          status: true,
          assignedTechnicianId: true,
        },
      },
      author: {
        select: {
          id: true,
          role: true,
        },
      },
    },
  });

  // Criar entradas automáticas para comentários
  for (const comment of comentarios) {
    // Verificar se já existe entrada para este comentário
    const existingEntry = await prisma.technicianJournalEntry.findUnique({
      where: { commentId: comment.id },
    });

    if (!existingEntry) {
      // Só criar se o autor for o técnico responsável pelo ticket
      if (comment.ticket.assignedTechnicianId === comment.authorId || 
          comment.author.role === UserRole.ADMIN || 
          comment.author.role === UserRole.TRIAGER) {
        const contentPreview = comment.content.length > 100 
          ? comment.content.substring(0, 100) + '...' 
          : comment.content;
        
        await prisma.technicianJournalEntry.create({
          data: {
            technicianId: comment.authorId,
            type: TechnicianJournalEntryType.AUTO_TICKET_COMMENT,
            ticketId: comment.ticketId,
            commentId: comment.id,
            description: `Comentei no ticket #${comment.ticket.id.substring(0, 8)} - ${comment.ticket.title}: ${contentPreview}`,
            source: 'comment',
          },
        });
      }
    }
  }

  // Criar histórico de status para alguns tickets (simulando mudanças)
  const ticketsComStatus = await prisma.ticket.findMany({
    where: {
      OR: [
        { status: TicketStatus.IN_PROGRESS },
        { status: TicketStatus.RESOLVED },
        { status: TicketStatus.CLOSED },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      assignedTechnicianId: true,
      requesterId: true,
    },
  });

  const statusLabels: Record<TicketStatus, string> = {
    OPEN: 'Aberto',
    IN_PROGRESS: 'Em Progresso',
    WAITING_REQUESTER: 'Aguardando Solicitante',
    WAITING_THIRD_PARTY: 'Aguardando Terceiros',
    RESOLVED: 'Resolvido',
    CLOSED: 'Fechado',
  };

  // Criar entradas de mudança de status para tickets que mudaram de status
  for (const ticket of ticketsComStatus) {
    if (ticket.assignedTechnicianId) {
      // Simular que o técnico mudou o status de OPEN para o status atual
      const oldLabel = statusLabels[TicketStatus.OPEN];
      const newLabel = statusLabels[ticket.status];
      
      await prisma.technicianJournalEntry.create({
        data: {
          technicianId: ticket.assignedTechnicianId,
          type: TechnicianJournalEntryType.AUTO_TICKET_STATUS,
          ticketId: ticket.id,
          description: `Alterei status do ticket #${ticket.id.substring(0, 8)} - ${ticket.title} de ${oldLabel} para ${newLabel}.`,
          source: 'status_change',
          createdAt: ticket.status === TicketStatus.CLOSED 
            ? new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
            : ticket.status === TicketStatus.RESOLVED
            ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // Criar entradas manuais para simular outras ações dos técnicos
  const entradasManuais = [
    {
      technicianId: technician.id,
      title: 'Reunião com equipe de suporte',
      description: 'Participação em reunião semanal da equipe de suporte para alinhamento de processos e discussão de casos complexos.',
      contentHtml: '<p>Discutimos melhorias no processo de atendimento e priorização de tickets críticos.</p>',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 dias atrás
    },
    {
      technicianId: technician.id,
      title: 'Treinamento sobre nova ferramenta',
      description: 'Participação em treinamento sobre nova ferramenta de monitoramento.',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 dias atrás
    },
    {
      technicianId: technician2.id,
      title: 'Análise de performance do servidor',
      description: 'Realizei análise detalhada de performance do servidor de produção. Identifiquei alguns gargalos que precisam ser otimizados.',
      contentHtml: '<p>Encontrei problemas de memória e CPU em horários de pico. Recomendação: aumentar recursos ou otimizar queries.</p>',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias atrás
    },
    {
      technicianId: technician2.id,
      title: 'Configuração de alertas',
      description: 'Configurei novos alertas de monitoramento para detectar problemas antes que afetem os usuários.',
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 dias atrás
    },
    {
      technicianId: technician3.id,
      title: 'Code review de feature',
      description: 'Realizei code review da nova feature de autenticação. Aprovado com algumas sugestões de melhoria.',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 dia atrás
    },
    {
      technicianId: technician3.id,
      title: 'Documentação técnica',
      description: 'Atualizei documentação técnica do sistema de migração para cloud.',
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 dias atrás
    },
    {
      technicianId: technician.id,
      title: 'Atendimento presencial',
      description: 'Atendimento presencial para configuração de impressora no escritório principal.',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 dia atrás
    },
    {
      technicianId: triager.id,
      title: 'Triagem de tickets',
      description: 'Realizei triagem de 15 tickets novos, priorizando e atribuindo aos técnicos apropriados.',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 dia atrás
    },
    {
      technicianId: triager.id,
      title: 'Análise de SLA',
      description: 'Analisei métricas de SLA do mês. Identifiquei necessidade de melhorar tempo de resposta em tickets críticos.',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dias atrás
    },
  ];

  for (const entrada of entradasManuais) {
    await prisma.technicianJournalEntry.create({
      data: {
        technicianId: entrada.technicianId,
        type: TechnicianJournalEntryType.MANUAL,
        title: entrada.title,
        description: entrada.description,
        contentHtml: entrada.contentHtml,
        source: 'manual',
        createdAt: entrada.createdAt,
      },
    });
  }

  // Criar algumas entradas automáticas adicionais para tickets criados por técnicos
  const ticketsCriadosPorTecnicos = await prisma.ticket.findMany({
    where: {
      requester: {
        role: {
          in: [UserRole.TECHNICIAN, UserRole.TRIAGER, UserRole.ADMIN],
        },
      },
    },
    select: {
      id: true,
      title: true,
      requesterId: true,
      createdAt: true,
      requester: {
        select: {
          role: true,
        },
      },
    },
  });

  for (const ticket of ticketsCriadosPorTecnicos) {
    if (ticket.requester.role === UserRole.TECHNICIAN || 
        ticket.requester.role === UserRole.TRIAGER || 
        ticket.requester.role === UserRole.ADMIN) {
      await prisma.technicianJournalEntry.create({
        data: {
          technicianId: ticket.requesterId,
          type: TechnicianJournalEntryType.AUTO_OTHER,
          ticketId: ticket.id,
          description: `Criei o ticket #${ticket.id.substring(0, 8)} - ${ticket.title}`,
          source: 'ticket_created',
          createdAt: ticket.createdAt,
        },
      });
    }
  }

  // Adicionar mais entradas manuais variadas para cada técnico
  const maisEntradasManuais = [
    {
      technicianId: technician.id,
      title: 'Atendimento telefônico',
      description: 'Atendimento telefônico para suporte ao usuário sobre configuração de email.',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      technicianId: technician.id,
      title: 'Configuração de VPN',
      description: 'Ajuda na configuração de VPN para usuário remoto.',
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      technicianId: technician2.id,
      title: 'Otimização de banco de dados',
      description: 'Executei otimização de queries no banco de dados de produção. Melhoria de 30% no tempo de resposta.',
      contentHtml: '<p>Análise de índices e otimização de queries lentas. Resultados positivos.</p>',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      technicianId: technician2.id,
      title: 'Deploy de correção',
      description: 'Realizei deploy de correção crítica em produção durante janela de manutenção.',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      technicianId: technician3.id,
      title: 'Reunião de planejamento',
      description: 'Participação em reunião de planejamento do sprint. Definição de prioridades.',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      technicianId: technician3.id,
      title: 'Refatoração de código',
      description: 'Iniciei refatoração do módulo de autenticação para melhorar manutenibilidade.',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      technicianId: triager.id,
      title: 'Análise de tendências',
      description: 'Analisei tendências de tickets do último mês. Identifiquei aumento em tickets de infraestrutura.',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const entrada of maisEntradasManuais) {
    await prisma.technicianJournalEntry.create({
      data: {
        technicianId: entrada.technicianId,
        type: TechnicianJournalEntryType.MANUAL,
        title: entrada.title,
        description: entrada.description,
        contentHtml: entrada.contentHtml,
        source: 'manual',
        createdAt: entrada.createdAt,
      },
    });
  }

  // Contar entradas criadas
  const totalEntradas = await prisma.technicianJournalEntry.count();
  const entradasPorTecnico = await prisma.technicianJournalEntry.groupBy({
    by: ['technicianId'],
    _count: { _all: true },
  });

  console.log('');
  console.log('📔 Entradas no diário criadas:');
  console.log(`- Total: ${totalEntradas} entradas`);
  for (const grupo of entradasPorTecnico) {
    const user = await prisma.user.findUnique({
      where: { id: grupo.technicianId },
      select: { name: true },
    });
    console.log(`- ${user?.name || grupo.technicianId}: ${grupo._count._all} entradas`);
  }

  console.log('✅ Seed concluído!');
  console.log('Usuários criados:');
  console.log(`- Admin: admin@example.com / admin123`);
  console.log(`- Triagista: triager@example.com / triager123`);
  console.log(`- Técnico: technician@example.com / technician123`);
  console.log(`- Técnico 2: tech2@example.com / technician123`);
  console.log(`- Técnico 3: tech3@example.com / technician123`);
  console.log(`- Solicitante: requester@example.com / requester123`);
  console.log('');
  console.log('Times criados:');
  console.log(`- ${teamSuporte.name}`);
  console.log(`- ${teamDesenvolvimento.name}`);
  console.log(`- ${teamInfraestrutura.name}`);
  console.log('');
  console.log('Tickets criados:');
  console.log(`- 2 Projetos (TASK) com tarefas filhas`);
  console.log(`- ${incidentes.length} Incidentes`);
  console.log(`- ${solicitacoes.length} Solicitações de Serviço`);
  console.log(`- ${problemas.length} Problemas`);
  console.log(`- ${mudancas.length} Mudanças`);
  console.log(`- ${duvidas.length} Dúvidas`);
  console.log(`- ${maisTickets.length} Tickets adicionais`);
  const totalTickets = 2 + incidentes.length + solicitacoes.length + problemas.length + mudancas.length + duvidas.length + maisTickets.length;
  console.log(`- Total: ${totalTickets} tickets`);
  console.log('');
  console.log('Tags criadas:');
  console.log(`- ${featureTags.length} tags de Feature`);
  console.log(`- ${areaTags.length} tags de Área`);
  console.log(`- ${envTags.length} tags de Ambiente`);
  console.log(`- ${platformTags.length} tags de Plataforma`);
  console.log(`- ${sourceTags.length} tags de Origem`);
  console.log(`- ${impactTags.length} tags de Impacto`);
  console.log(`- ${rcTags.length} tags de Causa Raiz (RC)`);
  console.log(`- ${statusReasonTags.length} tags de Status Reason`);
  console.log(`- ${workTags.length} tags de Trabalho`);
  console.log(`- ${questionTags.length} tags de Dúvida`);
  console.log(`- ${infraTags.length} tags de Infraestrutura`);
  console.log(`Total: ${featureTags.length + areaTags.length + envTags.length + platformTags.length + sourceTags.length + impactTags.length + rcTags.length + statusReasonTags.length + workTags.length + questionTags.length + infraTags.length} tags`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
