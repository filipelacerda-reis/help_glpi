import { env } from './env';
import { platformSettingsService } from '../services/platformSettings.service';
import { logger } from '../utils/logger';
import { AuthProvider, UserRole } from '@prisma/client';
import { authProviderConfigService } from '../domains/iam/services/authProviderConfig.service';

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

type Auth0RuntimeConfig = {
  enabled: boolean;
  domain: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  audience: string;
  jwtRedirectUrl: string;
  allowedDomains: string;
  rolesClaim: string;
  roleMappingJson: string;
  defaultRole: UserRole;
  updateRoleOnLogin: boolean;
  requireRole: boolean;
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
  activeProvider: AuthProvider | null;
  saml: SamlRuntimeConfig;
  auth0: Auth0RuntimeConfig;
  platform: PlatformRuntimeConfig;
};

let cachedConfig: RuntimeConfig | null = null;
let cacheExpiresAt = 0;

const buildDefaultConfig = (): RuntimeConfig => ({
  activeProvider: env.SAML_ENABLED && !env.AUTH0_ENABLED
    ? AuthProvider.SAML_GOOGLE
    : env.AUTH0_ENABLED && !env.SAML_ENABLED
      ? AuthProvider.AUTH0
      : null,
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
  auth0: {
    enabled: env.AUTH0_ENABLED,
    domain: env.AUTH0_DOMAIN,
    clientId: env.AUTH0_CLIENT_ID,
    clientSecret: env.AUTH0_CLIENT_SECRET,
    callbackUrl: env.AUTH0_CALLBACK_URL,
    audience: process.env.AUTH0_AUDIENCE || '',
    jwtRedirectUrl: env.AUTH0_JWT_REDIRECT_URL,
    allowedDomains: env.AUTH0_ALLOWED_DOMAINS,
    rolesClaim: env.AUTH0_ROLES_CLAIM,
    roleMappingJson: env.AUTH0_ROLE_MAPPING_JSON,
    defaultRole: (env.AUTH0_DEFAULT_ROLE as UserRole) || UserRole.REQUESTER,
    updateRoleOnLogin: env.AUTH0_UPDATE_ROLE_ON_LOGIN,
    requireRole: env.AUTH0_REQUIRE_ROLE,
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
    const [saml, samlSecret, auth0, auth0Secret, platform, activeProviderConfig] = await Promise.all([
      platformSettingsService.getSettingDecrypted('saml'),
      platformSettingsService.getSettingDecrypted('saml.secret'),
      platformSettingsService.getSettingDecrypted('auth0'),
      platformSettingsService.getSettingDecrypted('auth0.secret'),
      platformSettingsService.getSettingDecrypted('platform'),
      authProviderConfigService.getActiveProviderConfigDecrypted(),
    ]);

    const auth0SecretObj = auth0Secret as { clientSecret?: string } | null;

    const activeProvider = activeProviderConfig?.provider || null;

    cachedConfig = {
      activeProvider,
      saml: {
        ...defaults.saml,
        ...(saml || {}),
        enabled: activeProvider === AuthProvider.SAML_GOOGLE,
        entryPoint: activeProviderConfig?.samlMetadataUrl || defaults.saml.entryPoint,
        issuer: activeProviderConfig?.samlEntityId || defaults.saml.issuer,
        callbackUrl: activeProviderConfig?.samlCallbackUrl || defaults.saml.callbackUrl,
        cert: (samlSecret as { cert?: string } | null)?.cert || defaults.saml.cert,
      },
      auth0: {
        ...defaults.auth0,
        ...(auth0 || {}),
        enabled: activeProvider === AuthProvider.AUTH0,
        domain: activeProviderConfig?.auth0Domain || defaults.auth0.domain,
        clientId: activeProviderConfig?.auth0ClientId || defaults.auth0.clientId,
        callbackUrl: activeProviderConfig?.auth0CallbackUrl || defaults.auth0.callbackUrl,
        audience: activeProviderConfig?.auth0Audience || defaults.auth0.audience,
        clientSecret:
          activeProviderConfig?.auth0ClientSecret ||
          auth0SecretObj?.clientSecret ||
          defaults.auth0.clientSecret,
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
    cachedConfig = { ...defaults, activeProvider: null };
  }

  cacheExpiresAt = now + 60 * 1000;
  logger.info('RuntimeConfig atualizado');
  return cachedConfig!;
};
