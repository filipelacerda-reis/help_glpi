import { Request, Response } from 'express';
import { z } from 'zod';
import { platformSettingsService } from '../services/platformSettings.service';
import { platformAuditService } from '../services/platformAudit.service';
import { getRuntimeConfig, refreshRuntimeConfig } from '../config/runtimeConfig';
import { UserRole } from '@prisma/client';
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
      enabledTypes: z.array(z.string()).optional(),
      enabledPriorities: z.array(z.string()).optional(),
    })
    .optional(),
  notifications: z
    .object({
      socketEnabled: z.boolean().optional(),
      retentionDays: z.number().optional(),
    })
    .optional(),
  ai: z
    .object({
      assistantEnabled: z.boolean().optional(),
      dailyLimit: z.number().optional(),
    })
    .optional(),
});

const settingsSchema = z.object({
  saml: samlSchema.optional(),
  platform: platformSchema.optional(),
});

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

export const adminSettingsController = {
  async getSettings(_req: Request, res: Response) {
    const runtime = await getRuntimeConfig();
    const samlSecret = await platformSettingsService.getSetting('saml.secret');
    const samlMasked = platformSettingsService.maskSecretsForResponse({
      ...runtime.saml,
      cert: samlSecret?.valueJson?.isConfigured ? '***' : '',
    });

    res.json({
      saml: samlMasked,
      platform: runtime.platform,
    });
  },

  async updateSettings(req: Request, res: Response) {
    const payload = settingsSchema.parse(req.body);
    const actorUserId = req.userId as string;

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
};
