import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Limpa todas as tabelas do banco de dados de teste
 * IMPORTANTE: Usar apenas em ambiente de teste!
 */
export async function resetDatabase(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetDatabase só pode ser usado em ambiente de teste!');
  }

  // Deletar em ordem para respeitar constraints de foreign key
  await prisma.ticketAttachment.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticketTag.deleteMany();
  await prisma.ticketObserver.deleteMany();
  await prisma.ticketRelation.deleteMany();
  await prisma.ticketStatusHistory.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.technicianJournalEntry.deleteMany();
  await prisma.userTeam.deleteMany();
  await prisma.team.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.slaPolicy.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.businessCalendar.deleteMany();
}

/**
 * Fecha a conexão do Prisma
 */
export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}

