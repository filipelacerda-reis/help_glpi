import { Request, Response } from 'express';
import { z } from 'zod';
import { platformSettingsService } from '../services/platformSettings.service';
import { platformAuditService } from '../services/platformAudit.service';
import { getRuntimeConfig, refreshRuntimeConfig } from '../config/runtimeConfig';
import { TicketPriority, TicketType, UserRole } from '@prisma/client';
import { logger } from '../utils/logger';

const roleEnum = z.nativeEnum(UserRole);

const samlSchema = z.object({
  enabled: z.boolean(),
  entryPoint: z.string().url().optional(),
  issuer: z.string().optional(),
  callbackUrl: z.string().url().optional(),
  cert: z.string().optional(),
  allowedDomains: z.string().optional(),
  groupsAttribute: z.string().optional(),
  roleMappingJson: z.string().optional(),
  defaultRole: roleEnum.optional(),
  updateRoleOnLogin: z.boolean().optional(),
  requireGroup: z.boolean().optional(),
  validateInResponseTo: z.boolean().optional(),
  requestIdTtlMs: z.number().optional(),
  signatureAlgorithm: z.string().optional(),
  nameIdFormat: z.string().optional(),
  jwtRedirectUrl: z.string().optional(),
});

const platformSchema = z.object({
  branding: z
    .object({
      name: z.string().optional(),
      logoUrl: z.string().optional(),
    })
    .optional(),
  timezone: z.string().optional(),
  businessCalendarDefaultId: z.string().optional(),
  ticketing: z
    .object({
      allowRequesterCreate: z.boolean().optional(),
      enabledTypes: z.array(z.nativeEnum(TicketType)).optional(),
      enabledPriorities: z.array(z.nativeEnum(TicketPriority)).optional(),
    })
    .optional(),
  notifications: z
    .object({
      socketEnabled: z.boolean().optional(),
      retentionDays: z.number().int().min(1).max(3650).optional(),
    })
    .optional(),
  ai: z
    .object({
      assistantEnabled: z.boolean().optional(),
      dailyLimit: z.number().int().min(0).max(10000).optional(),
    })
    .optional(),
});

const auth0Schema = z.object({
  enabled: z.boolean(),
  domain: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  callbackUrl: z.string().url().optional(),
  jwtRedirectUrl: z.string().optional(),
  allowedDomains: z.string().optional(),
  rolesClaim: z.string().optional(),
  roleMappingJson: z.string().optional(),
  defaultRole: roleEnum.optional(),
  updateRoleOnLogin: z.boolean().optional(),
  requireRole: z.boolean().optional(),
});

const settingsSchema = z.object({
  saml: samlSchema.optional(),
  auth0: auth0Schema.optional(),
  platform: platformSchema.optional(),
});

const isValidJsonObject = (value?: string) => {
  if (!value) return true;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
};

const validateSamlConfig = (saml: any) => {
  if (!saml.enabled) return { ok: true };

  const errors: string[] = [];
  if (!saml.entryPoint) errors.push('entryPoint é obrigatório');
  if (!saml.issuer) errors.push('issuer é obrigatório');
  if (!saml.callbackUrl) errors.push('callbackUrl é obrigatório');
  if (!saml.allowedDomains) errors.push('allowedDomains é obrigatório');
  if (!saml.cert) errors.push('cert é obrigatório');
  if (saml.requireGroup && !saml.roleMappingJson) {
    errors.push('roleMappingJson é obrigatório quando requireGroup=true');
  }
  if (saml.cert && !saml.cert.includes('BEGIN CERTIFICATE')) {
    errors.push('cert deve conter BEGIN CERTIFICATE');
  }

  return { ok: errors.length === 0, errors };
};

const validateAuth0Config = (auth0: any) => {
  if (!auth0.enabled) return { ok: true };

  const errors: string[] = [];
  if (!auth0.domain) errors.push('domain é obrigatório');
  if (!auth0.clientId) errors.push('clientId é obrigatório');
  if (!auth0.callbackUrl) errors.push('callbackUrl é obrigatório');
  if (!auth0.clientSecret) errors.push('clientSecret é obrigatório');
  if (auth0.requireRole && !auth0.roleMappingJson) {
    errors.push('roleMappingJson é obrigatório quando requireRole=true');
  }

  return { ok: errors.length === 0, errors };
};

export const adminSettingsController = {
  async getSettings(_req: Request, res: Response) {
    const runtime = await getRuntimeConfig();
    const samlSecret = await platformSettingsService.getSetting('saml.secret');
    const samlSecretConfigured = Boolean((samlSecret?.valueJson as any)?.isConfigured);
    const samlMasked = platformSettingsService.maskSecretsForResponse({
      ...runtime.saml,
      cert: samlSecretConfigured ? '***' : '',
    });

    const auth0Secret = await platformSettingsService.getSetting('auth0.secret');
    const auth0SecretConfigured = Boolean((auth0Secret?.valueJson as any)?.isConfigured);
    const auth0Masked = platformSettingsService.maskSecretsForResponse({
      ...runtime.auth0,
      clientSecret: auth0SecretConfigured ? '***' : '',
    });

    res.json({
      saml: samlMasked,
      auth0: auth0Masked,
      platform: runtime.platform,
    });
  },

  async updateSettings(req: Request, res: Response) {
    const payload = settingsSchema.parse(req.body);
    const actorUserId = req.userId as string;
    const runtime = await getRuntimeConfig();

    const mergedSaml = payload.saml
      ? {
          ...runtime.saml,
          ...payload.saml,
          cert:
            payload.saml.cert && payload.saml.cert !== '***'
              ? payload.saml.cert
              : runtime.saml.cert,
        }
      : runtime.saml;

    const mergedAuth0 = payload.auth0
      ? {
          ...runtime.auth0,
          ...payload.auth0,
          clientSecret:
            payload.auth0.clientSecret && payload.auth0.clientSecret !== '***'
              ? payload.auth0.clientSecret
              : runtime.auth0.clientSecret,
        }
      : runtime.auth0;

    if (!isValidJsonObject(mergedSaml.roleMappingJson)) {
      res.status(400).json({ error: 'SAML: roleMappingJson deve ser um JSON objeto válido' });
      return;
    }
    if (!isValidJsonObject(mergedAuth0.roleMappingJson)) {
      res.status(400).json({ error: 'Auth0: roleMappingJson deve ser um JSON objeto válido' });
      return;
    }

    const samlValidation = validateSamlConfig(mergedSaml);
    if (!samlValidation.ok) {
      res.status(400).json({ error: 'Configuração SAML inválida', errors: samlValidation.errors });
      return;
    }

    const auth0Validation = validateAuth0Config(mergedAuth0);
    if (!auth0Validation.ok) {
      res.status(400).json({ error: 'Configuração Auth0 inválida', errors: auth0Validation.errors });
      return;
    }

    const updates: Array<{ key: string; valueJson: any; isSecret: boolean }> = [];

    if (payload.saml) {
      const saml = { ...payload.saml };
      const cert = saml.cert;
      delete (saml as any).cert;
      updates.push({ key: 'saml', valueJson: saml, isSecret: false });

      if (cert && cert !== '***') {
        updates.push({ key: 'saml.secret', valueJson: { cert }, isSecret: true });
      }
    }

    if (payload.auth0) {
      const auth0 = { ...payload.auth0 };
      const clientSecret = auth0.clientSecret;
      delete (auth0 as any).clientSecret;
      updates.push({ key: 'auth0', valueJson: auth0, isSecret: false });

      if (clientSecret && clientSecret !== '***') {
        updates.push({ key: 'auth0.secret', valueJson: { clientSecret }, isSecret: true });
      }
    }

    if (payload.platform) {
      updates.push({ key: 'platform', valueJson: payload.platform, isSecret: false });
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'Nenhuma configuração para atualizar' });
      return;
    }

    try {
      await platformSettingsService.setMany(updates, actorUserId);
      await platformAuditService.log(actorUserId, 'SETTING_UPDATED', 'PLATFORM', {
        keys: updates.map((u) => u.key),
      });

      refreshRuntimeConfig();
      logger.info('Settings atualizados via admin', { actorUserId, keys: updates.map((u) => u.key) });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        error: error?.message || 'Erro ao salvar configurações',
      });
    }
  },

  async testSamlSettings(req: Request, res: Response) {
    const runtime = await getRuntimeConfig();
    const saml = runtime.saml;
    const validation = validateSamlConfig(saml);

    await platformAuditService.log(req.userId as string, 'SETTING_TESTED', 'SAML', {
      ok: validation.ok,
      errors: validation.errors,
    });

    if (!validation.ok) {
      res.status(400).json({ ok: false, errors: validation.errors });
      return;
    }

    res.json({
      ok: true,
      metadataUrl: '/api/auth/saml/metadata',
      message: 'Configuração SAML válida',
    });
  },

  async testAuth0Settings(req: Request, res: Response) {
    const runtime = await getRuntimeConfig();
    const auth0 = runtime.auth0;
    const validation = validateAuth0Config(auth0);

    await platformAuditService.log(req.userId as string, 'SETTING_TESTED', 'AUTH0', {
      ok: validation.ok,
      errors: validation.errors,
    });

    if (!validation.ok) {
      res.status(400).json({ ok: false, errors: validation.errors });
      return;
    }

    res.json({
      ok: true,
      loginUrl: '/api/auth/auth0/login',
      message: 'Configuração Auth0 válida',
    });
  },
};
