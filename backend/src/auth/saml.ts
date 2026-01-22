import passport from 'passport';
import { Strategy as SamlStrategy, SamlConfig, Profile } from 'passport-saml';
import NodeCache from 'node-cache';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { env } from '../config/env';
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

export const parseRoleMapping = (raw: string): Record<string, UserRole> => {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed || {};
  } catch {
    return {};
  }
};

export const normalizeGroups = (groupsRaw: any): string[] => {
  if (!groupsRaw) return [];
  if (Array.isArray(groupsRaw)) return groupsRaw.map(String);
  return [String(groupsRaw)];
};

export const mapGroupsToRole = (
  groups: string[],
  mapping: Record<string, UserRole>,
  defaultRole: UserRole
) => {
  const matchedRoles = groups
    .map((group) => mapping[group])
    .filter(Boolean) as UserRole[];

  for (const role of ROLE_PRIORITY) {
    if (matchedRoles.includes(role)) {
      return role;
    }
  }

  return defaultRole;
};

export const isEmailAllowed = (email: string, allowedDomains: string[]) => {
  if (!allowedDomains.length) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && allowedDomains.includes(domain));
};

const normalizeCert = (value: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.includes('BEGIN CERTIFICATE')) {
    return trimmed;
  }
  const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
  if (decoded.includes('BEGIN CERTIFICATE')) {
    return decoded;
  }
  return trimmed;
};

const buildCacheProvider = () => {
  const cache = new NodeCache({ stdTTL: env.SAML_REQUEST_ID_TTL_MS / 1000 });
  return {
    save: (key: string, value: string, callback: (err: any, result?: any) => void) => {
      cache.set(key, value);
      callback(null, value);
    },
    get: (key: string, callback: (err: any, result?: any) => void) => {
      const value = cache.get<string>(key);
      callback(null, value || null);
    },
    remove: (key: string, callback: (err: any, result?: any) => void) => {
      cache.del(key);
      callback(null, key);
    },
  };
};

const extractEmail = (profile: Profile) => {
  const nameId = profile?.nameID;
  if (nameId && nameId.includes('@')) return nameId;
  const emailAttr =
    (profile as any).email ||
    (profile as any).mail ||
    (profile as any)['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
  if (emailAttr) return Array.isArray(emailAttr) ? emailAttr[0] : emailAttr;
  return null;
};

const extractGroups = (profile: Profile, attributeName: string) => {
  const groupsRaw =
    (profile as any)[attributeName] ||
    (profile as any).groups ||
    (profile as any)['http://schemas.google.com/ws/2005/05/identity/claims/groups'];
  return normalizeGroups(groupsRaw);
};

let cachedStrategy: SamlStrategy | null = null;
let cachedHash = '';

const buildConfigHash = (config: any) =>
  crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');

export const getSamlStrategy = async () => {
  const runtimeConfig = await getRuntimeConfig();
  const saml = runtimeConfig.saml;

  if (!saml.enabled) {
    return null;
  }

  if (!saml.entryPoint || !saml.issuer || !saml.callbackUrl || !saml.cert) {
    logger.error('SAML habilitado, mas configuração obrigatória incompleta');
    return null;
  }

  const configHash = buildConfigHash(saml);
  if (cachedStrategy && cachedHash === configHash) {
    return cachedStrategy;
  }

  const allowedDomains = saml.allowedDomains
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  const roleMapping = parseRoleMapping(saml.roleMappingJson);
  const cert = normalizeCert(saml.cert);

  const strategyConfig: SamlConfig = {
    entryPoint: saml.entryPoint,
    issuer: saml.issuer,
    callbackUrl: saml.callbackUrl,
    cert,
    acceptedClockSkewMs: 2 * 60 * 1000,
    signatureAlgorithm: saml.signatureAlgorithm as any,
    digestAlgorithm: saml.signatureAlgorithm as any,
    validateInResponseTo: saml.validateInResponseTo,
    requestIdExpirationPeriodMs: saml.requestIdTtlMs,
    identifierFormat: saml.nameIdFormat,
  };

  if (saml.validateInResponseTo) {
    (strategyConfig as any).cacheProvider = buildCacheProvider();
  }

  const strategy = new SamlStrategy(strategyConfig, async (profile, done) => {
    try {
      const email = extractEmail(profile);
      if (!email) {
        return done(new AppError('Email não encontrado no SAML', 401), null);
      }

      if (!isEmailAllowed(email, allowedDomains)) {
        return done(new AppError('Domínio não autorizado', 403), null);
      }

      const groups = extractGroups(profile, saml.groupsAttribute);
      const defaultRole = saml.defaultRole || UserRole.REQUESTER;
      const role = mapGroupsToRole(groups, roleMapping, defaultRole);

      if (saml.requireGroup && groups.length === 0) {
        return done(new AppError('Usuário sem grupos permitidos', 403), null);
      }

      if (saml.requireGroup && role === defaultRole && Object.keys(roleMapping).length > 0) {
        return done(new AppError('Usuário sem grupos mapeados', 403), null);
      }

      const name =
        (profile as any).displayName ||
        [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
        email.split('@')[0];

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        const randomPassword = crypto.randomBytes(24).toString('hex');
        const passwordHash = await hashPassword(randomPassword);
        user = await prisma.user.create({
          data: {
            email,
            name,
            role,
            passwordHash,
            department: (profile as any).department || null,
          },
        });
      } else if (saml.updateRoleOnLogin && role !== user.role) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role },
        });
      }

      logger.info('Login SAML realizado', {
        email,
        role,
        groupsCount: groups.length,
      });

      return done(null, { ...user, samlGroups: groups, samlEmail: email });
    } catch (error) {
      return done(error as Error, null);
    }
  });

  passport.use('saml', strategy);

  passport.serializeUser((user: any, done) => {
    done(null, user?.id || user?.userId);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user || null);
    } catch (error) {
      done(error as Error, null);
    }
  });

  cachedStrategy = strategy;
  cachedHash = configHash;
  return cachedStrategy;
};
