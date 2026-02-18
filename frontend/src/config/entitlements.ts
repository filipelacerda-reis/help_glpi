export const MODULE_KEYS = ['ADMIN', 'ITSM', 'HR', 'FINANCE', 'ASSETS', 'COMPLIANCE'] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const ACCESS_LEVELS = ['READ', 'WRITE'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const SUBMODULE_KEYS = [
  'ADMIN_SETTINGS',
  'ADMIN_USERS',
  'ADMIN_ROLES_PERMS',
  'ADMIN_SSO',
  'ADMIN_GROUP_MAPPING',
  'ADMIN_AUDIT',
  'ITSM_TICKETS',
  'ITSM_SLA',
  'ITSM_KB',
  'ITSM_AUTOMATIONS',
  'ITSM_REPORTS',
  'HR_EMPLOYEES',
  'HR_EMPLOYEES_PII',
  'HR_ONBOARDING',
  'HR_OFFBOARDING',
  'HR_POLICIES',
  'HR_REPORTS',
  'FINANCE_COST_CENTERS',
  'FINANCE_VENDORS',
  'FINANCE_PURCHASE_REQUESTS',
  'FINANCE_PURCHASE_ORDERS',
  'FINANCE_INVOICES',
  'FINANCE_APPROVALS',
  'FINANCE_ASSETS_LEDGER',
  'FINANCE_REPORTS',
  'ASSETS_EQUIPMENT',
  'ASSETS_ASSIGNMENTS',
  'ASSETS_STOCK',
  'ASSETS_DELIVERIES',
  'ASSETS_MAINTENANCE',
  'ASSETS_REPORTS',
  'COMPLIANCE_RETENTION',
  'COMPLIANCE_ANONYMIZATION',
  'COMPLIANCE_AUDIT_VIEW',
] as const;
export type SubmoduleKey = (typeof SUBMODULE_KEYS)[number];

export type UserEntitlement = {
  module: ModuleKey;
  submodule: SubmoduleKey;
  level: AccessLevel;
};

export type EntitlementCatalogEntry = {
  module: ModuleKey;
  submodule: SubmoduleKey;
  label: string;
  description?: string;
};

export const moduleToLegacyModule: Partial<Record<ModuleKey, string>> = {
  ADMIN: 'ADMIN',
  ITSM: 'TICKETS',
  HR: 'HR',
  FINANCE: 'FINANCE',
  ASSETS: 'EQUIPMENTS',
};

export function hasEntitlement(
  entitlements: UserEntitlement[] | undefined,
  module: ModuleKey,
  submodule: SubmoduleKey,
  level: AccessLevel = 'READ'
): boolean {
  if (!entitlements || entitlements.length === 0) return false;
  const current = entitlements.find((e) => e.module === module && e.submodule === submodule);
  if (!current) return false;
  if (level === 'READ') return true;
  return current.level === 'WRITE';
}

