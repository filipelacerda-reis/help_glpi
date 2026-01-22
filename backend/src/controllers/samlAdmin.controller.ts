import { Request, Response } from 'express';
import { getRuntimeConfig } from '../config/runtimeConfig';

export const samlAdminController = {
  async getConfig(_req: Request, res: Response) {
    const runtime = await getRuntimeConfig();
    res.json({
      enabled: runtime.saml.enabled,
      entryPoint: runtime.saml.entryPoint,
      issuer: runtime.saml.issuer,
      callbackUrl: runtime.saml.callbackUrl,
      signatureAlgorithm: runtime.saml.signatureAlgorithm,
      nameIdFormat: runtime.saml.nameIdFormat,
      allowedDomains: runtime.saml.allowedDomains,
      groupsAttribute: runtime.saml.groupsAttribute,
      roleMappingJson: runtime.saml.roleMappingJson,
      defaultRole: runtime.saml.defaultRole,
      updateRoleOnLogin: runtime.saml.updateRoleOnLogin,
      requireGroup: runtime.saml.requireGroup,
      validateInResponseTo: runtime.saml.validateInResponseTo,
      requestIdTtlMs: runtime.saml.requestIdTtlMs,
      certConfigured: Boolean(runtime.saml.cert),
      jwtRedirectUrl: runtime.saml.jwtRedirectUrl,
      readOnly: true,
    });
  },

  async updateConfig(_req: Request, res: Response) {
    res.status(501).json({
      error: 'Configuração SAML é gerenciada por variáveis de ambiente.',
    });
  },
};
