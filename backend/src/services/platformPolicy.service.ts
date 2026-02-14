import { ChatMessageRole, TicketPriority, TicketType, UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { getRuntimeConfig } from '../config/runtimeConfig';

export const platformPolicyService = {
  async enforceAssistantAccess(userId: string) {
    const runtime = await getRuntimeConfig();
    const ai = runtime.platform?.ai;

    if (ai?.assistantEnabled === false) {
      throw new AppError(
        'Assistente virtual desabilitado pelo administrador da plataforma.',
        403
      );
    }

    if (typeof ai?.dailyLimit === 'number' && ai.dailyLimit >= 0) {
      const startUtc = new Date();
      startUtc.setUTCHours(0, 0, 0, 0);

      const usedToday = await prisma.chatMessage.count({
        where: {
          role: ChatMessageRole.USER,
          createdAt: { gte: startUtc },
          session: {
            userId,
          },
        },
      });

      if (usedToday >= ai.dailyLimit) {
        throw new AppError(
          `Limite diário do assistente atingido (${ai.dailyLimit} mensagens por dia).`,
          429
        );
      }
    }
  },

  async enforceTicketCreatePolicy(
    userRole: UserRole,
    priority: TicketPriority,
    tipo: TicketType
  ) {
    const runtime = await getRuntimeConfig();
    const ticketing = runtime.platform?.ticketing;

    if (userRole === UserRole.REQUESTER && ticketing?.allowRequesterCreate === false) {
      throw new AppError(
        'Solicitantes não podem criar tickets nesta plataforma no momento.',
        403
      );
    }

    if (
      Array.isArray(ticketing?.enabledTypes) &&
      ticketing.enabledTypes.length > 0 &&
      !ticketing.enabledTypes.includes(tipo)
    ) {
      throw new AppError(
        `Tipo de ticket "${tipo}" está desabilitado pela administração.`,
        400
      );
    }

    if (
      Array.isArray(ticketing?.enabledPriorities) &&
      ticketing.enabledPriorities.length > 0 &&
      !ticketing.enabledPriorities.includes(priority)
    ) {
      throw new AppError(
        `Prioridade "${priority}" está desabilitada pela administração.`,
        400
      );
    }
  },

  async enforceTicketUpdatePolicy(data: {
    priority?: TicketPriority;
    tipo?: TicketType;
  }) {
    const runtime = await getRuntimeConfig();
    const ticketing = runtime.platform?.ticketing;

    if (
      data.tipo &&
      Array.isArray(ticketing?.enabledTypes) &&
      ticketing.enabledTypes.length > 0 &&
      !ticketing.enabledTypes.includes(data.tipo)
    ) {
      throw new AppError(
        `Tipo de ticket "${data.tipo}" está desabilitado pela administração.`,
        400
      );
    }

    if (
      data.priority &&
      Array.isArray(ticketing?.enabledPriorities) &&
      ticketing.enabledPriorities.length > 0 &&
      !ticketing.enabledPriorities.includes(data.priority)
    ) {
      throw new AppError(
        `Prioridade "${data.priority}" está desabilitada pela administração.`,
        400
      );
    }
  },
};
