import { api } from './api';

export interface AdminSettingsPayload {
  saml?: Record<string, any>;
  auth0?: Record<string, any>;
  platform?: Record<string, any>;
  slack?: {
    enabled: boolean;
    botToken?: string;
    signingSecret?: string;
  };
}

export const adminSettingsService = {
  async getSettings() {
    const response = await api.get('/admin/settings');
    return response.data;
  },
  async updateSettings(payload: AdminSettingsPayload) {
    const response = await api.put('/admin/settings', payload);
    return response.data;
  },
  async testSaml() {
    const response = await api.post('/admin/settings/saml/test');
    return response.data;
  },
  async testAuth0() {
    const response = await api.post('/admin/settings/auth0/test');
    return response.data;
  },
  async recalculateSla(payload: { from?: string; to?: string; teamId?: string; categoryId?: string }) {
    const response = await api.post('/admin/tools/recalculate-sla', payload);
    return response.data;
  },
  async getAudit(limit = 50, cursor?: string) {
    const response = await api.get('/admin/audit', {
      params: { limit, cursor },
    });
    return response.data;
  },
  async getSlackSettings() {
    const response = await api.get('/admin/settings/slack');
    return response.data as {
      enabled: boolean;
      botToken: string;
      signingSecret: string;
    };
  },
  async updateSlackSettings(payload: {
    enabled: boolean;
    botToken?: string;
    signingSecret?: string;
  }) {
    const response = await api.put('/admin/settings/slack', payload);
    return response.data;
  },
};
