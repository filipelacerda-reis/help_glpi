import { api } from './api';

export interface SamlConfig {
  enabled: boolean;
  entryPoint: string;
  issuer: string;
  callbackUrl: string;
  signatureAlgorithm: string;
  nameIdFormat: string;
  allowedDomains: string;
  groupsAttribute: string;
  roleMappingJson: string;
  defaultRole: string;
  updateRoleOnLogin: boolean;
  requireGroup: boolean;
  validateInResponseTo: boolean;
  requestIdTtlMs: number;
  certConfigured: boolean;
  jwtRedirectUrl: string;
  readOnly: boolean;
}

export const samlService = {
  async getConfig(): Promise<SamlConfig> {
    const response = await api.get('/admin/saml-config');
    return response.data;
  },
};
