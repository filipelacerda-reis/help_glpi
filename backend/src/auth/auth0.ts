import passport from 'passport';
import Auth0Strategy from 'passport-auth0';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { getRuntimeConfig } from '../config/runtimeConfig';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { UserRole } from '@prisma/client';
import { hashPassword } from '../utils/password';

const ROLE_PRIORITY: UserRole[] = [
  UserRole.ADMIN,
  UserRole.TRIAGER,
  UserRole.TECHNICIAN,
  UserRole.REQUESTER,
];

export const parseAuth0RoleMapping = (raw: string): Record<string, UserRole> => {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed || {};
  } catch {
    return {};
  }
};

const normalizeRoles = (raw: unknown): string[] => {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
};

const mapAuth0RolesToRole = (
  roles: string[],
  mapping: Record<string, UserRole>,
  defaultRole: UserRole
): UserRole => {
  const matched = roles
    .map((r) => mapping[r.trim()])
    .filter(Boolean) as UserRole[];
  for (const role of ROLE_PRIORITY) {
    if (matched.includes(role)) return role;
  }
  return defaultRole;
};

const isEmailAllowed = (email: string, allowedDomains: string[]) => {
  if (!allowedDomains.length) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && allowedDomains.includes(domain));
};

let cachedStrategy: Auth0Strategy | null = null;
let cachedHash = '';

const buildConfigHash = (config: Record<string, unknown>) =>
  crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');

export const getAuth0Strategy = async (): Promise<Auth0Strategy | null> => {
  const runtime = await getRuntimeConfig();
  const auth0 = runtime.auth0;

  if (!auth0.enabled) return null;
  if (!auth0.domain || !auth0.clientId || !auth0.clientSecret || !auth0.callbackUrl) {
    logger.error('Auth0 habilitado, mas configuração obrigatória incompleta');
    return null;
  }

  const configHash = buildConfigHash({
    domain: auth0.domain,
    clientId: auth0.clientId,
    callbackUrl: auth0.callbackUrl,
  });
  if (cachedStrategy && cachedHash === configHash) {
    return cachedStrategy;
  }

  const allowedDomains = auth0.allowedDomains
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const roleMapping = parseAuth0RoleMapping(auth0.roleMappingJson);
  const defaultRole = auth0.defaultRole || UserRole.REQUESTER;
  const rolesClaim = auth0.rolesClaim || 'https://glpi.etus.io/roles';

  const strategy = new Auth0Strategy(
    {
      domain: auth0.domain,
      clientID: auth0.clientId,
      clientSecret: auth0.clientSecret,
      callbackURL: auth0.callbackUrl,
      state: true,
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      _extraParams: unknown,
      profile: any,
      done: (err: Error | null, user?: any) => void
    ) => {
      try {
        if (!profile) {
          return done(new AppError('Perfil Auth0 inválido', 401));
        }

        const email =
          profile.emails?.[0]?.value ||
          profile._json?.email ||
          profile._json?.emails?.[0];
        if (!email || typeof email !== 'string') {
          return done(new AppError('Email não encontrado no perfil Auth0', 401));
        }

        if (!isEmailAllowed(email, allowedDomains)) {
          return done(new AppError('Domínio não autorizado', 403));
        }

        const rolesRaw = profile._json?.[rolesClaim] ?? profile[rolesClaim];
        const roles = normalizeRoles(rolesRaw);
        const role = mapAuth0RolesToRole(roles, roleMapping, defaultRole);

        if (auth0.requireRole && Object.keys(roleMapping).length > 0 && roles.length === 0) {
          return done(new AppError('Usuário sem role mapeada no Auth0', 403));
        }

        const name =
          profile.displayName ||
          [profile.name?.givenName, profile.name?.familyName].filter(Boolean).join(' ') ||
          email.split('@')[0];

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          const randomPassword = crypto.randomBytes(24).toString('hex');
          const passwordHash = await hashPassword(randomPassword);
          user = await prisma.user.create({
            data: {
              email,
              name: name || email,
              role,
              passwordHash,
              department: profile._json?.department ?? null,
            },
          });
        } else if (auth0.updateRoleOnLogin && role !== user.role) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { role },
          });
        }

        logger.info('Login Auth0 realizado', {
          email,
          role,
          rolesCount: roles.length,
        });

        return done(null, { ...user, auth0Roles: roles, auth0Email: email });
      } catch (error) {
        return done(error as Error);
      }
    }
  );

  try {
    passport.unuse('auth0');
  } catch {
    // ignore if not registered
  }
  passport.use('auth0', strategy);
  cachedStrategy = strategy;
  cachedHash = configHash;
  return cachedStrategy;
};
