import { Request, Response } from 'express';
import { TicketPriority, TicketType, UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { ticketService } from '../services/ticket.service';
import { logger } from '../utils/logger';
import { platformSettingsService } from '../services/platformSettings.service';

type SlackActionValue = {
  type?: string;
  value?: string;
  selected_option?: {
    value?: string;
    text?: { text?: string };
  };
  selected_options?: Array<{
    value?: string;
    text?: { text?: string };
  }>;
  selected_user?: string;
  selected_users?: string[];
  selected_conversation?: string;
  selected_conversations?: string[];
  selected_date?: string;
  selected_time?: string;
};

type SlackViewSubmissionPayload = {
  type?: string;
  user?: {
    id?: string;
    username?: string;
    name?: string;
  };
  view?: {
    callback_id?: string;
    private_metadata?: string;
    state?: {
      values?: Record<string, Record<string, SlackActionValue>>;
    };
  };
};

type SlackFieldEntry = {
  blockId: string;
  actionId: string;
  value: string;
};

const parsePayload = (rawPayload: unknown): SlackViewSubmissionPayload | null => {
  if (!rawPayload) return null;
  try {
    if (typeof rawPayload === 'string') {
      return JSON.parse(rawPayload) as SlackViewSubmissionPayload;
    }
    if (typeof rawPayload === 'object') {
      return rawPayload as SlackViewSubmissionPayload;
    }
    return null;
  } catch {
    return null;
  }
};

const toActionValue = (field: SlackActionValue): string => {
  if (typeof field.value === 'string') return field.value.trim();
  if (field.selected_option?.value) return field.selected_option.value.trim();
  if (field.selected_option?.text?.text) return field.selected_option.text.text.trim();
  if (field.selected_options?.length) {
    return field.selected_options
      .map((item) => item.value || item.text?.text || '')
      .filter(Boolean)
      .join(', ')
      .trim();
  }
  if (field.selected_user) return field.selected_user.trim();
  if (field.selected_users?.length) return field.selected_users.join(', ').trim();
  if (field.selected_conversation) return field.selected_conversation.trim();
  if (field.selected_conversations?.length) return field.selected_conversations.join(', ').trim();
  if (field.selected_date) return field.selected_date.trim();
  if (field.selected_time) return field.selected_time.trim();
  return '';
};

const flattenSlackState = (payload: SlackViewSubmissionPayload): SlackFieldEntry[] => {
  const values = payload.view?.state?.values || {};
  const entries: SlackFieldEntry[] = [];

  for (const [blockId, actionMap] of Object.entries(values)) {
    for (const [actionId, actionValue] of Object.entries(actionMap || {})) {
      const parsedValue = toActionValue(actionValue || {});
      if (!parsedValue) continue;
      entries.push({
        blockId,
        actionId,
        value: parsedValue,
      });
    }
  }
  return entries;
};

const extractByAlias = (entries: SlackFieldEntry[], aliases: string[]): string => {
  const normalizedAliases = aliases.map((alias) => alias.toLowerCase());
  const found = entries.find((entry) => {
    const block = entry.blockId.toLowerCase();
    const action = entry.actionId.toLowerCase();
    return normalizedAliases.some((alias) => block.includes(alias) || action.includes(alias));
  });
  return found?.value || '';
};

const parsePrivateMetadata = (payload: SlackViewSubmissionPayload): Record<string, string> => {
  const raw = payload.view?.private_metadata;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
};

const mapPriority = (priorityRaw: string): TicketPriority => {
  const value = priorityRaw.toLowerCase();
  if (['low', 'baixa', 'baixo'].includes(value)) return TicketPriority.LOW;
  if (['high', 'alta', 'alto'].includes(value)) return TicketPriority.HIGH;
  if (['critical', 'critica', 'crítica'].includes(value)) return TicketPriority.CRITICAL;
  return TicketPriority.MEDIUM;
};

const resolveRequester = async (email?: string) => {
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail?.active) return byEmail;
  }

  const adminFallback = await prisma.user.findFirst({
    where: { active: true, role: UserRole.ADMIN },
    orderBy: { createdAt: 'asc' },
  });
  if (adminFallback) return adminFallback;

  return prisma.user.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
  });
};

const resolveTeamId = async (preferredTeamId?: string) => {
  if (preferredTeamId) {
    const preferred = await prisma.team.findUnique({
      where: { id: preferredTeamId },
      include: { users: { select: { userId: true } } },
    });
    if (preferred && preferred.users.length > 0) return preferred.id;
  }

  const fallback = await prisma.team.findFirst({
    where: { users: { some: {} } },
    orderBy: { createdAt: 'asc' },
  });
  return fallback?.id || null;
};

const processSlackViewSubmission = async (payload: SlackViewSubmissionPayload) => {
  const slackEnabled = await platformSettingsService.getSettingDecrypted('SLACK_ENABLED');
  if (!slackEnabled) {
    logger.info('Webhook Slack recebido com integração desativada');
    return;
  }

  const fields = flattenSlackState(payload);
  const metadata = parsePrivateMetadata(payload);
  const slackUserId = payload.user?.id || '';

  const title =
    extractByAlias(fields, ['title', 'titulo', 'assunto']) || 'Chamado criado via Slack';
  const descriptionFromModal =
    extractByAlias(fields, ['description', 'descricao', 'detalhe', 'details']) ||
    'Sem descrição detalhada no modal Slack.';
  const priorityRaw = extractByAlias(fields, ['priority', 'prioridade']);
  const emailFromModal = extractByAlias(fields, ['email', 'mail']);
  const requesterEmail = emailFromModal || metadata.userEmail || '';
  const categoryId =
    extractByAlias(fields, ['category', 'categoria']) || metadata.categoryId || undefined;

  const requester = await resolveRequester(requesterEmail);
  if (!requester) {
    logger.error('Webhook Slack: nenhum usuário fallback disponível para criação de ticket');
    return;
  }

  const teamIdCandidate =
    extractByAlias(fields, ['team', 'time']) || metadata.teamId || undefined;
  const teamId = await resolveTeamId(teamIdCandidate);
  if (!teamId) {
    logger.error('Webhook Slack: nenhum time com membros disponível para criação de ticket');
    return;
  }

  const requesterMismatchNote =
    requesterEmail && requester.email.toLowerCase() !== requesterEmail.toLowerCase()
      ? `\n\n[Slack] Email informado (${requesterEmail}) não encontrado; ticket associado a ${requester.email}.`
      : '';

  const enrichedDescription = [
    descriptionFromModal,
    '',
    `[Slack] Usuário Slack: ${slackUserId || 'desconhecido'}`,
    requesterEmail ? `[Slack] E-mail informado: ${requesterEmail}` : '',
    requesterMismatchNote.trim(),
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await ticketService.createTicket(requester.id, {
      title,
      description: enrichedDescription,
      priority: mapPriority(priorityRaw),
      teamId,
      categoryId,
      tipo: TicketType.INCIDENT,
    });
    logger.info('Ticket criado via webhook Slack', {
      slackUserId,
      requesterId: requester.id,
      teamId,
      callbackId: payload.view?.callback_id,
    });
  } catch (error: any) {
    logger.error('Erro ao criar ticket via webhook Slack', {
      message: error?.message || String(error),
      slackUserId,
      teamId,
      requesterId: requester.id,
    });
  }
};

export const webhookController = {
  async slackInteractions(req: Request, res: Response) {
    // Resposta imediata para evitar timeout do Slack (3s).
    res.status(200).send();

    const payload = parsePayload((req.body as any)?.payload || req.body);
    if (!payload) {
      logger.warn('Webhook Slack recebido com payload inválido');
      return;
    }

    if (payload.type !== 'view_submission') {
      logger.debug('Webhook Slack ignorado (tipo não suportado)', { type: payload.type });
      return;
    }

    void processSlackViewSubmission(payload).catch((error: any) => {
      logger.error('Erro não tratado no processamento do webhook Slack', {
        message: error?.message || String(error),
      });
    });
  },
};
