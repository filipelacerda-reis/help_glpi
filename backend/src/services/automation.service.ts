import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { AutomationEvent, TicketEventType, EventOrigin, TicketStatus, TicketPriority, UserRole } from '@prisma/client';
import { ticketEventService } from './ticketEvent.service';
import { ticketService } from './ticket.service';
import { slaService } from './sla.service';
import axios from 'axios';

export interface CreateAutomationRuleDto {
  name: string;
  description?: string;
  enabled?: boolean;
  event: AutomationEvent;
  conditions: Record<string, any>;
  actions: Array<{
    type: string;
    [key: string]: any;
  }>;
}

export interface UpdateAutomationRuleDto {
  name?: string;
  description?: string;
  enabled?: boolean;
  event?: AutomationEvent;
  conditions?: Record<string, any>;
  actions?: Array<{
    type: string;
    [key: string]: any;
  }>;
}

/**
 * Avalia condições de uma regra de automação
 */
function evaluateConditions(conditions: Record<string, any>, ticket: any): boolean {
  for (const [key, value] of Object.entries(conditions)) {
    if (value === undefined || value === null) continue;

    const ticketValue = ticket[key];
    if (ticketValue === undefined) continue;

    // Comparação simples (pode ser expandida)
    if (ticketValue !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Executa ações de uma regra de automação
 */
async function executeActions(ticketId: string, actions: Array<{ type: string; [key: string]: any }>) {
  const results: any[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'SET_TEAM':
          if (action.teamId) {
            await ticketService.updateTicket(ticketId, 'SYSTEM', UserRole.ADMIN, { teamId: action.teamId });
            results.push({ type: action.type, success: true });
          }
          break;

        case 'SET_PRIORITY':
          if (action.priority) {
            await ticketService.updateTicket(ticketId, 'SYSTEM', UserRole.ADMIN, { priority: action.priority as TicketPriority });
            results.push({ type: action.type, success: true });
          }
          break;

        case 'SET_STATUS':
          if (action.status) {
            await ticketService.updateTicket(ticketId, 'SYSTEM', UserRole.ADMIN, { status: action.status as TicketStatus });
            results.push({ type: action.type, success: true });
          }
          break;

        case 'ASSIGN_TO_TECHNICIAN':
          if (action.technicianId) {
            await ticketService.updateTicket(ticketId, 'SYSTEM', UserRole.ADMIN, { assignedTechnicianId: action.technicianId });
            results.push({ type: action.type, success: true });
          }
          break;

        case 'ADD_TAG':
          if (action.tagId) {
            // Implementar adição de tag
            results.push({ type: action.type, success: true, note: 'Tag addition not yet implemented' });
          }
          break;

        case 'TRIGGER_SLA':
          // SLA já é iniciado automaticamente na criação do ticket
          results.push({ type: action.type, success: true, note: 'SLA is automatically started' });
          break;

        case 'CALL_WEBHOOK':
          if (action.url) {
            try {
              const ticket = await prisma.ticket.findUnique({
                where: { id: ticketId },
                include: {
                  requester: { select: { id: true, name: true, email: true } },
                  assignedTechnician: { select: { id: true, name: true, email: true } },
                  category: true,
                  team: true,
                  tags: { include: { tag: true } },
                },
              });

              if (!ticket) {
                throw new Error('Ticket not found');
              }

              const method = action.method || 'POST';
              const payload = {
                event: 'ticket_automation',
                ticketId: ticket.id,
                ticket: ticket,
                timestamp: new Date().toISOString(),
              };

              await axios({
                method: method as any,
                url: action.url,
                data: payload,
                headers: {
                  'Content-Type': 'application/json',
                  ...(action.headers || {}),
                },
                timeout: 10000, // 10 segundos
              });

              results.push({ type: action.type, success: true });
            } catch (error: any) {
              logger.error('Erro ao chamar webhook', { url: action.url, error: error.message });
              results.push({ type: action.type, success: false, error: error.message });
            }
          } else {
            results.push({ type: action.type, success: false, error: 'URL não fornecida' });
          }
          break;

        default:
          logger.warn('Ação de automação desconhecida', { actionType: action.type });
          results.push({ type: action.type, success: false, error: 'Unknown action type' });
      }
    } catch (error: any) {
      logger.error('Erro ao executar ação de automação', { actionType: action.type, error: error.message });
      results.push({ type: action.type, success: false, error: error.message });
    }
  }

  return results;
}

export const automationService = {
  /**
   * Cria uma regra de automação
   */
  async createRule(data: CreateAutomationRuleDto) {
    const rule = await prisma.automationRule.create({
      data: {
        name: data.name,
        description: data.description,
        enabled: data.enabled !== undefined ? data.enabled : true,
        event: data.event,
        conditions: data.conditions as any,
        actions: data.actions as any,
      },
    });

    logger.info('Regra de automação criada', { ruleId: rule.id, name: rule.name });
    return rule;
  },

  /**
   * Busca todas as regras
   */
  async getAllRules(enabledOnly?: boolean) {
    const where: any = {};
    if (enabledOnly) {
      where.enabled = true;
    }

    return prisma.automationRule.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });
  },

  /**
   * Busca regra por ID
   */
  async getRuleById(id: string) {
    const rule = await prisma.automationRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new AppError('Regra de automação não encontrada', 404);
    }

    return rule;
  },

  /**
   * Atualiza regra
   */
  async updateRule(id: string, data: UpdateAutomationRuleDto) {
    const rule = await prisma.automationRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new AppError('Regra de automação não encontrada', 404);
    }

    const updated = await prisma.automationRule.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        event: data.event,
        conditions: data.conditions as any,
        actions: data.actions as any,
      },
    });

    logger.info('Regra de automação atualizada', { ruleId: id });
    return updated;
  },

  /**
   * Deleta regra
   */
  async deleteRule(id: string) {
    await prisma.automationRule.delete({
      where: { id },
    });

    logger.info('Regra de automação deletada', { ruleId: id });
  },

  /**
   * Processa automações para um evento
   */
  async processAutomations(event: AutomationEvent, ticket: any) {
    const rules = await prisma.automationRule.findMany({
      where: {
        enabled: true,
        event,
      },
    });

    if (rules.length === 0) {
      return [];
    }

    const results: any[] = [];

    for (const rule of rules) {
      try {
        const conditions = rule.conditions as Record<string, any>;
        const actions = rule.actions as Array<{ type: string; [key: string]: any }>;

        // Avaliar condições
        if (!evaluateConditions(conditions, ticket)) {
          continue;
        }

        // Executar ações
        const actionResults = await executeActions(ticket.id, actions);

        // Registrar evento
        await ticketEventService.createEvent({
          ticketId: ticket.id,
          eventType: TicketEventType.AUTOMATION_TRIGGERED,
          origin: EventOrigin.AUTO_RULE,
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
            event,
            actionResults,
          },
        });

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          triggered: true,
          actionResults,
        });

        logger.info('Regra de automação executada', { ruleId: rule.id, ticketId: ticket.id });
      } catch (error: any) {
        logger.error('Erro ao processar regra de automação', {
          ruleId: rule.id,
          ticketId: ticket.id,
          error: error.message,
        });

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          triggered: false,
          error: error.message,
        });
      }
    }

    return results;
  },
};

