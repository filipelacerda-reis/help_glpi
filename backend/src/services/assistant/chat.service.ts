import prisma from '../../lib/prisma';
import { ChatMessageRole } from '@prisma/client';
import { generateSupportReply, LlmMessage } from './llm.service';
import { logger } from '../../utils/logger';

type CreateSessionInput = {
  userId?: string;
  externalId?: string;
  sessionId?: string;
};

export async function getOrCreateChatSession(input: CreateSessionInput) {
  // Verificar se chatSession está disponível
  if (!prisma.chatSession) {
    logger.error('Prisma chatSession não está disponível', {
      prismaKeys: Object.keys(prisma).filter(k => k.includes('chat') || k.includes('Chat')),
    });
    throw new Error('Prisma chatSession model não está disponível. Verifique se o Prisma Client foi regenerado.');
  }

  if (input.sessionId) {
    const existing = await prisma.chatSession.findUnique({
      where: { id: input.sessionId },
    });
    if (existing && existing.status === 'OPEN') {
      return existing;
    }
  }

  logger.debug('Criando nova sessão de chat', { userId: input.userId, externalId: input.externalId });

  return prisma.chatSession.create({
    data: {
      userId: input.userId,
      externalId: input.externalId,
      status: 'OPEN',
    },
  });
}

export async function appendUserMessage(sessionId: string, content: string) {
  return prisma.chatMessage.create({
    data: {
      sessionId,
      role: ChatMessageRole.USER,
      content,
    },
  });
}

export async function appendAssistantMessage(
  sessionId: string,
  content: string,
) {
  return prisma.chatMessage.create({
    data: {
      sessionId,
      role: ChatMessageRole.ASSISTANT,
      content,
    },
  });
}

export async function getRecentMessagesForLlm(
  sessionId: string,
  limit = 10,
): Promise<LlmMessage[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });

  // limite simples – se quiser, aplicar window sliding de últimos N
  const lastMessages = messages.slice(-limit);

  return lastMessages.map((m) => ({
    role:
      m.role === 'USER'
        ? 'user'
        : m.role === 'ASSISTANT'
        ? 'assistant'
        : 'system',
    content: m.content,
  }));
}

export async function handleUserChatMessage(
  sessionId: string,
  userContent: string,
) {
  try {
    logger.debug('Processando mensagem do usuário', { sessionId, contentLength: userContent.length });
    
    await appendUserMessage(sessionId, userContent);

    const history = await getRecentMessagesForLlm(sessionId);
    logger.debug('Histórico de mensagens obtido', { sessionId, messageCount: history.length });

    logger.debug('Gerando resposta do assistente', { sessionId });
    const assistantContent = await generateSupportReply(history);
    logger.debug('Resposta do assistente gerada', { sessionId, contentLength: assistantContent.length });

    const assistantMessage = await appendAssistantMessage(
      sessionId,
      assistantContent,
    );

    return assistantMessage;
  } catch (error: any) {
    logger.error('Erro ao processar mensagem do chat', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error?.constructor?.name,
      errorStack: error instanceof Error ? error.stack : undefined,
      errorDetails: error?.response?.data || error?.body || error?.message,
      sessionId,
    });
    throw error;
  }
}

export async function createTicketFromSession(sessionId: string) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!session) {
    throw new Error('ChatSession not found');
  }

  // título simples: primeira mensagem do usuário
  const firstUserMessage = session.messages.find((m) => m.role === 'USER');
  const title =
    firstUserMessage?.content.slice(0, 120) ||
    'Solicitação via assistente virtual';

  const description = session.messages
    .map((m) => {
      const prefix =
        m.role === 'USER'
          ? 'Usuário:'
          : m.role === 'ASSISTANT'
          ? 'Assistente:'
          : 'Sistema:';
      return `${prefix} ${m.content}`;
    })
    .join('\n\n');

  // Usar o serviço de ticket existente ou criar diretamente
  // Assumindo que requesterId é obrigatório, usar um usuário padrão ou o userId da sessão
  if (!session.userId) {
    throw new Error('Não é possível criar ticket sem usuário associado');
  }

  // Buscar um time padrão (primeiro time disponível com membros)
  // Primeiro, buscar um time que tenha pelo menos um membro na tabela UserTeam
  const teamWithMembers = await prisma.userTeam.findFirst({
    include: {
      team: true,
    },
  });

  let team;
  if (!teamWithMembers || !teamWithMembers.team) {
    // Se não houver time com membros, buscar qualquer time disponível
    const anyTeam = await prisma.team.findFirst();
    if (!anyTeam) {
      throw new Error('Nenhum time disponível para criar o ticket');
    }
    team = anyTeam;
  } else {
    team = teamWithMembers.team;
  }

  // Usar o serviço de ticket para manter consistência
  const { ticketService } = await import('../ticket.service');
  const ticket = await ticketService.createTicket(session.userId, {
    title,
    description,
    teamId: team.id,
    priority: 'MEDIUM',
    tipo: 'INCIDENT',
  });

  if (!ticket) {
    throw new Error('Falha ao criar ticket a partir da sessão');
  }

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      status: 'ESCALATED',
      createdTicketId: ticket.id,
    },
  });

  return ticket;
}

