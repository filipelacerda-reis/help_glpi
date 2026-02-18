import { UserRole } from '@prisma/client';

export const PLATFORM_MODULES = [
  'DASHBOARD',
  'TICKETS',
  'NOTIFICATIONS',
  'JOURNAL',
  'EMPLOYEES',
  'EQUIPMENTS',
  'METRICS',
  'KB',
  'SLA',
  'AUTOMATIONS',
  'TEAMS',
  'USERS',
  'TAGS',
  'CATEGORIES',
  'ADMIN',
  'FINANCE',
  'HR',
  'PROCUREMENT',
] as const;

export type PlatformModule = (typeof PLATFORM_MODULES)[number];

const DEFAULT_MODULES_BY_ROLE: Record<UserRole, PlatformModule[]> = {
  REQUESTER: ['DASHBOARD', 'TICKETS', 'NOTIFICATIONS'],
  TECHNICIAN: ['DASHBOARD', 'TICKETS', 'NOTIFICATIONS', 'JOURNAL'],
  TRIAGER: [
    'DASHBOARD',
    'TICKETS',
    'NOTIFICATIONS',
    'JOURNAL',
    'EMPLOYEES',
    'EQUIPMENTS',
    'KB',
    'METRICS',
  ],
  ADMIN: [...PLATFORM_MODULES],
};

export function sanitizeModules(input?: string[] | null): PlatformModule[] {
  if (!input) return [];
  const allowed = new Set(PLATFORM_MODULES);
  const unique = new Set<string>();
  for (const moduleKey of input) {
    if (allowed.has(moduleKey as PlatformModule)) {
      unique.add(moduleKey);
    }
  }
  return Array.from(unique) as PlatformModule[];
}

export function getDefaultModulesByRole(role: UserRole): PlatformModule[] {
  return [...DEFAULT_MODULES_BY_ROLE[role]];
}

export function getEffectiveModules(role: UserRole, enabledModules?: string[] | null): PlatformModule[] {
  if (role === UserRole.ADMIN) {
    return [...PLATFORM_MODULES];
  }
  const sanitized = sanitizeModules(enabledModules);
  if (sanitized.length > 0) {
    return sanitized;
  }
  return getDefaultModulesByRole(role);
}
