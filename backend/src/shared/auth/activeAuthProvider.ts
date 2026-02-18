import { AuthProvider } from '@prisma/client';
import { env } from '../../config/env';
import { authProviderConfigService } from '../../domains/iam/services/authProviderConfig.service';

export const getActiveAuthProvider = async (): Promise<AuthProvider | null> => {
  const activeDbProvider = await authProviderConfigService.getActiveProvider();
  if (activeDbProvider) return activeDbProvider;

  // Fallback de compatibilidade para ambientes legados sem registro no banco
  if (env.SAML_ENABLED && !env.AUTH0_ENABLED) return AuthProvider.SAML_GOOGLE;
  if (env.AUTH0_ENABLED && !env.SAML_ENABLED) return AuthProvider.AUTH0;
  return null;
};

export const isAuthProviderActive = async (provider: AuthProvider) => {
  const active = await getActiveAuthProvider();
  return active === provider;
};
