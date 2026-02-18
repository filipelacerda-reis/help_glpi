import { AuthProvider, Prisma } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { decryptJson, encryptJson } from '../../../lib/crypto/settingsCrypto';
import { AppError, ErrorType } from '../../../middleware/errorHandler';

export type ProviderConfigView = {
  provider: AuthProvider;
  enabled: boolean;
  samlMetadataUrl?: string | null;
  samlEntityId?: string | null;
  samlCallbackUrl?: string | null;
  auth0Domain?: string | null;
  auth0ClientId?: string | null;
  auth0CallbackUrl?: string | null;
  auth0Audience?: string | null;
  auth0ClientSecret?: string;
};

export type UpsertProviderConfigInput = {
  provider: AuthProvider;
  enabled?: boolean;
  samlMetadataUrl?: string;
  samlEntityId?: string;
  samlCallbackUrl?: string;
  auth0Domain?: string;
  auth0ClientId?: string;
  auth0CallbackUrl?: string;
  auth0Audience?: string;
  auth0ClientSecret?: string;
};

const maskSecret = (value?: string | null) => (value ? '***' : '');

const toView = (record: {
  provider: AuthProvider;
  enabled: boolean;
  samlMetadataUrl: string | null;
  samlEntityId: string | null;
  samlCallbackUrl: string | null;
  auth0Domain: string | null;
  auth0ClientId: string | null;
  auth0CallbackUrl: string | null;
  auth0Audience: string | null;
  auth0ClientSecret: string | null;
}): ProviderConfigView => ({
  provider: record.provider,
  enabled: record.enabled,
  samlMetadataUrl: record.samlMetadataUrl,
  samlEntityId: record.samlEntityId,
  samlCallbackUrl: record.samlCallbackUrl,
  auth0Domain: record.auth0Domain,
  auth0ClientId: record.auth0ClientId,
  auth0CallbackUrl: record.auth0CallbackUrl,
  auth0Audience: record.auth0Audience,
  auth0ClientSecret: maskSecret(record.auth0ClientSecret),
});

const decryptSecret = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    const parsed = decryptJson(value);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object' && 'value' in parsed) {
      return String((parsed as any).value || '');
    }
    return null;
  } catch {
    return null;
  }
};

export const authProviderConfigService = {
  async list(): Promise<ProviderConfigView[]> {
    const records = await prisma.authProviderConfig.findMany({
      orderBy: { provider: 'asc' },
    });
    return records.map(toView);
  },

  async getByProvider(provider: AuthProvider): Promise<ProviderConfigView | null> {
    const record = await prisma.authProviderConfig.findUnique({ where: { provider } });
    if (!record) return null;
    return toView(record);
  },

  async getActiveProvider(): Promise<AuthProvider | null> {
    const active = await prisma.authProviderConfig.findFirst({ where: { enabled: true } });
    return active?.provider ?? null;
  },

  async getActiveProviderConfigDecrypted() {
    const active = await prisma.authProviderConfig.findFirst({ where: { enabled: true } });
    if (!active) return null;

    return {
      ...active,
      auth0ClientSecret: decryptSecret(active.auth0ClientSecret),
    };
  },

  async upsert(input: UpsertProviderConfigInput, updatedByUserId?: string) {
    const enabled = Boolean(input.enabled);

    if (input.provider === AuthProvider.SAML_GOOGLE && enabled) {
      if (!input.samlMetadataUrl || !input.samlEntityId || !input.samlCallbackUrl) {
        throw new AppError(
          'SAML requer metadata URL, entityId e callbackUrl para habilitar',
          400,
          ErrorType.VALIDATION_ERROR
        );
      }
    }

    if (input.provider === AuthProvider.AUTH0 && enabled) {
      if (!input.auth0Domain || !input.auth0ClientId || !input.auth0CallbackUrl) {
        throw new AppError(
          'Auth0 requer domain, clientId e callbackUrl para habilitar',
          400,
          ErrorType.VALIDATION_ERROR
        );
      }
    }

    const auth0ClientSecret =
      input.auth0ClientSecret && input.auth0ClientSecret !== '***'
        ? encryptJson(input.auth0ClientSecret)
        : undefined;

    const data: Prisma.AuthProviderConfigUncheckedCreateInput = {
      provider: input.provider,
      enabled,
      samlMetadataUrl: input.samlMetadataUrl,
      samlEntityId: input.samlEntityId,
      samlCallbackUrl: input.samlCallbackUrl,
      auth0Domain: input.auth0Domain,
      auth0ClientId: input.auth0ClientId,
      auth0CallbackUrl: input.auth0CallbackUrl,
      auth0Audience: input.auth0Audience,
      ...(auth0ClientSecret ? { auth0ClientSecret } : {}),
      updatedByUserId,
    };

    const updated = await prisma.$transaction(async (tx) => {
      if (enabled) {
        await tx.authProviderConfig.updateMany({
          where: {
            enabled: true,
            provider: { not: input.provider },
          },
          data: { enabled: false, updatedByUserId },
        });
      }

      return tx.authProviderConfig.upsert({
        where: { provider: input.provider },
        create: data,
        update: {
          enabled,
          samlMetadataUrl: input.samlMetadataUrl,
          samlEntityId: input.samlEntityId,
          samlCallbackUrl: input.samlCallbackUrl,
          auth0Domain: input.auth0Domain,
          auth0ClientId: input.auth0ClientId,
          auth0CallbackUrl: input.auth0CallbackUrl,
          auth0Audience: input.auth0Audience,
          ...(auth0ClientSecret ? { auth0ClientSecret } : {}),
          updatedByUserId,
        },
      });
    });

    return toView(updated);
  },
};
