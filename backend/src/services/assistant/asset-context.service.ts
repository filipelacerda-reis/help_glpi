import prisma from '../../lib/prisma';

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function uniqueWords(input: string): string[] {
  const stopWords = new Set([
    'a',
    'o',
    'os',
    'as',
    'de',
    'da',
    'do',
    'com',
    'que',
    'qual',
    'quais',
    'quem',
    'esta',
    'estao',
    'maquina',
    'equipamento',
    'item',
    'itens',
    'colaborador',
    'funcionario',
    'tem',
  ]);

  return Array.from(
    new Set(
      normalize(input)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2 && !stopWords.has(token))
    )
  ).slice(0, 8);
}

function formatDate(value?: Date | null): string {
  if (!value) return '-';
  return value.toISOString().slice(0, 10);
}

export async function buildAssetContextForChat(userMessage: string): Promise<string> {
  const query = userMessage.trim();
  const tokens = uniqueWords(query);
  const cpfDigits = query.replace(/\D/g, '');

  const equipmentWhere: any = {
    OR: [
      { assetTag: { contains: query, mode: 'insensitive' } },
      { invoiceNumber: { contains: query, mode: 'insensitive' } },
      { serialNumber: { contains: query, mode: 'insensitive' } },
      { brand: { contains: query, mode: 'insensitive' } },
      { model: { contains: query, mode: 'insensitive' } },
      ...tokens.flatMap((token) => [
        { assetTag: { contains: token, mode: 'insensitive' } },
        { serialNumber: { contains: token, mode: 'insensitive' } },
        { model: { contains: token, mode: 'insensitive' } },
      ]),
    ],
  };

  const employeeWhere: any = {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      ...(cpfDigits.length >= 4 ? [{ cpf: { contains: cpfDigits } }] : []),
      ...tokens.map((token) => ({ name: { contains: token, mode: 'insensitive' } })),
    ],
  };

  const [equipmentMatches, employeeMatches, activeAssignments] = await Promise.all([
    prisma.equipment.findMany({
      where: equipmentWhere,
      include: {
        assignments: {
          where: { returnedAt: null },
          include: { employee: { select: { name: true } } },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
      take: 6,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.employee.findMany({
      where: employeeWhere,
      include: {
        team: { select: { name: true } },
        assignments: {
          where: { returnedAt: null },
          include: { equipment: true },
          orderBy: { assignedAt: 'desc' },
          take: 10,
        },
      },
      take: 4,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.equipmentAssignment.findMany({
      where: { returnedAt: null },
      include: {
        equipment: true,
        employee: { select: { name: true } },
      },
      orderBy: { assignedAt: 'desc' },
      take: 15,
    }),
  ]);

  const lines: string[] = [];
  lines.push(`Dados atualizados em: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('Equipamentos com maior aderencia a pergunta:');
  if (equipmentMatches.length === 0) {
    lines.push('- Nenhum equipamento encontrado com o termo informado.');
  } else {
    for (const eq of equipmentMatches) {
      const assignment = eq.assignments[0];
      lines.push(
        `- Patrimonio ${eq.assetTag} (${eq.equipmentType}) | status=${eq.status} | com=${assignment?.employee?.name || 'Ninguem'} | entregueEm=${formatDate(assignment?.assignedAt)}`
      );
    }
  }
  lines.push('');

  lines.push('Colaboradores com maior aderencia a pergunta:');
  if (employeeMatches.length === 0) {
    lines.push('- Nenhum colaborador encontrado com o termo informado.');
  } else {
    for (const employee of employeeMatches) {
      lines.push(
        `- ${employee.name} | cpf=${employee.cpf} | time=${employee.team?.name || '-'} | funcao=${employee.roleTitle}`
      );
      if (employee.assignments.length === 0) {
        lines.push('  Itens ativos: nenhum.');
      } else {
        for (const assignment of employee.assignments) {
          lines.push(
            `  Item: ${assignment.equipment.assetTag} (${assignment.equipment.equipmentType}) | entregueEm=${formatDate(assignment.assignedAt)} | termo=${assignment.deliveryTermNumber || '-'}`
          );
        }
      }
    }
  }
  lines.push('');

  lines.push('Mapa rapido de posse atual (ultimas entregas ativas):');
  if (activeAssignments.length === 0) {
    lines.push('- Nenhuma entrega ativa no momento.');
  } else {
    for (const assignment of activeAssignments) {
      lines.push(
        `- ${assignment.equipment.assetTag} (${assignment.equipment.equipmentType}) -> ${assignment.employee.name}, desde ${formatDate(assignment.assignedAt)}`
      );
    }
  }

  return lines.join('\n');
}
