import { env } from './env';
import { platformSettingsService } from '../services/platformSettings.service';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';

type SamlRuntimeConfig = {
  enabled: boolean;
  entryPoint: string;
  issuer: string;
  callbackUrl: string;
  cert: string;
  signatureAlgorithm: string;
  nameIdFormat: string;
  allowedDomains: string;
  groupsAttribute: string;
  roleMappingJson: string;
  defaultRole: UserRole;
  updateRoleOnLogin: boolean;
  requireGroup: boolean;
  validateInResponseTo: boolean;
  requestIdTtlMs: number;
  jwtRedirectUrl: string;
};

type PlatformRuntimeConfig = {
  branding?: {
    name?: string;
    logoUrl?: string;
  };
  timezone?: string;
  businessCalendarDefaultId?: string;
  ticketing?: {
    allowRequesterCreate?: boolean;
    enabledTypes?: string[];
    enabledPriorities?: string[];
  };
  notifications?: {
    socketEnabled?: boolean;
    retentionDays?: number;
  };
  ai?: {
    assistantEnabled?: boolean;
    dailyLimit?: number;
  };
};

export type RuntimeConfig = {
  saml: SamlRuntimeConfig;
  platform: PlatformRuntimeConfig;
};

let cachedConfig: RuntimeConfig | null = null;
let cacheExpiresAt = 0;

const buildDefaultConfig = (): RuntimeConfig => ({
  saml: {
    enabled: env.SAML_ENABLED,
    entryPoint: env.SAML_ENTRY_POINT,
    issuer: env.SAML_ISSUER,
    callbackUrl: env.SAML_CALLBACK_URL,
    cert: env.SAML_CERT,
    signatureAlgorithm: env.SAML_SIGNATURE_ALG,
    nameIdFormat: env.SAML_NAMEID_FORMAT,
    allowedDomains: env.SAML_ALLOWED_DOMAINS,
    groupsAttribute: env.SAML_GROUPS_ATTRIBUTE,
    roleMappingJson: env.SAML_ROLE_MAPPING_JSON,
    defaultRole: (env.SAML_DEFAULT_ROLE as UserRole) || UserRole.REQUESTER,
    updateRoleOnLogin: env.SAML_UPDATE_ROLE_ON_LOGIN,
    requireGroup: env.SAML_REQUIRE_GROUP,
    validateInResponseTo: env.SAML_VALIDATE_IN_RESPONSE_TO,
    requestIdTtlMs: env.SAML_REQUEST_ID_TTL_MS,
    jwtRedirectUrl: env.SAML_JWT_REDIRECT_URL,
  },
  platform: {
    timezone: 'America/Recife',
  },
});

export const refreshRuntimeConfig = () => {
  cachedConfig = null;
  cacheExpiresAt = 0;
};

export const getRuntimeConfig = async (): Promise<RuntimeConfig> => {
  const now = Date.now();
  if (cachedConfig && cacheExpiresAt > now) {
    return cachedConfig;
  }

  const defaults = buildDefaultConfig();
  try {
    const [saml, samlSecret, platform] = await Promise.all([
      platformSettingsService.getSettingDecrypted('saml'),
      platformSettingsService.getSettingDecrypted('saml.secret'),
      platformSettingsService.getSettingDecrypted('platform'),
    ]);

    cachedConfig = {
      saml: {
        ...defaults.saml,
        ...(saml || {}),
        cert: samlSecret?.cert || defaults.saml.cert,
      },
      platform: {
        ...defaults.platform,
        ...(platform || {}),
      },
    };
  } catch (error) {
    logger.warn('Falha ao carregar runtimeConfig do banco, usando defaults', {
      error: (error as Error).message,
    });
    cachedConfig = defaults;
  }

  cacheExpiresAt = now + 60 * 1000;
  logger.info('RuntimeConfig atualizado');
  return cachedConfig!;
};
