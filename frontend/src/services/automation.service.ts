import { api } from './api';

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  event: string;
  conditions: Record<string, any>;
  actions: Array<{
    type: string;
    [key: string]: any;
  }>;
  createdAt: string;
  updatedAt: string;
}

export const automationService = {
  async getAllRules(enabledOnly?: boolean): Promise<AutomationRule[]> {
    const params = enabledOnly ? '?enabledOnly=true' : '';
    const response = await api.get<AutomationRule[]>(`/automation-rules${params}`);
    return response.data;
  },

  async getRuleById(id: string): Promise<AutomationRule> {
    const response = await api.get<AutomationRule>(`/automation-rules/${id}`);
    return response.data;
  },

  async createRule(data: {
    name: string;
    description?: string;
    enabled?: boolean;
    event: string;
    conditions: Record<string, any>;
    actions: Array<{ type: string; [key: string]: any }>;
  }): Promise<AutomationRule> {
    const response = await api.post<AutomationRule>('/automation-rules', data);
    return response.data;
  },

  async updateRule(id: string, data: Partial<AutomationRule>): Promise<AutomationRule> {
    const response = await api.put<AutomationRule>(`/automation-rules/${id}`, data);
    return response.data;
  },

  async deleteRule(id: string): Promise<void> {
    await api.delete(`/automation-rules/${id}`);
  },
};

