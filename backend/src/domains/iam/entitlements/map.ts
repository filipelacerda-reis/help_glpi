import { AccessLevel, ModuleKey, SubmoduleKey } from '@prisma/client';

export type EntitlementMappingKey = `${ModuleKey}:${SubmoduleKey}`;

type MappingRule = {
  read: string[];
  write?: string[];
};

const RULES: Partial<Record<EntitlementMappingKey, MappingRule>> = {
  'ADMIN:ADMIN_SETTINGS': { read: ['platform.settings.read'], write: ['platform.settings.write'] },
  'ADMIN:ADMIN_USERS': { read: ['platform.users.read', 'iam.user.view', 'iam.user.read'], write: ['platform.users.write', 'iam.user.write', 'iam.user.disable'] },
  'ADMIN:ADMIN_ROLES_PERMS': { read: ['platform.roles.read', 'iam.role.read'], write: ['platform.roles.write', 'iam.role.write'] },
  'ADMIN:ADMIN_SSO': { read: ['platform.authprovider.read'], write: ['platform.authprovider.write'] },
  'ADMIN:ADMIN_GROUP_MAPPING': { read: ['platform.groupmapping.read'], write: ['platform.groupmapping.write'] },
  'ADMIN:ADMIN_AUDIT': { read: ['audit.read'] },

  'ITSM:ITSM_TICKETS': { read: ['itsm.view', 'itsm.ticket.read'], write: ['itsm.ticket.write', 'itsm.ticket.assign', 'itsm.ticket.close'] },
  'ITSM:ITSM_SLA': { read: ['itsm.sla.read'], write: ['itsm.sla.write'] },
  'ITSM:ITSM_KB': { read: ['itsm.kb.read'], write: ['itsm.kb.write'] },
  'ITSM:ITSM_AUTOMATIONS': { read: ['itsm.automation.read'], write: ['itsm.automation.write'] },
  'ITSM:ITSM_REPORTS': { read: ['itsm.reports.read'] },

  'HR:HR_EMPLOYEES': { read: ['hr.view', 'hr.employee.read'], write: ['hr.employee.write'] },
  'HR:HR_EMPLOYEES_PII': { read: ['hr.employee.read_pii'], write: ['hr.employee.write_pii'] },
  'HR:HR_ONBOARDING': { read: ['hr.onboarding.read'], write: ['hr.onboarding.write'] },
  'HR:HR_OFFBOARDING': { read: ['hr.offboarding.read'], write: ['hr.offboarding.write'] },
  'HR:HR_POLICIES': { read: ['hr.policy.read', 'hr.ack.read'], write: ['hr.policy.write', 'hr.ack.write'] },
  'HR:HR_REPORTS': { read: ['hr.reports.read'] },

  'FINANCE:FINANCE_COST_CENTERS': { read: ['finance.view', 'finance.costcenter.read'], write: ['finance.costcenter.write'] },
  'FINANCE:FINANCE_VENDORS': { read: ['finance.vendor.read'], write: ['finance.vendor.write'] },
  'FINANCE:FINANCE_PURCHASE_REQUESTS': { read: ['finance.pr.read'], write: ['finance.pr.write'] },
  'FINANCE:FINANCE_PURCHASE_ORDERS': { read: ['finance.po.read'], write: ['finance.po.write'] },
  'FINANCE:FINANCE_INVOICES': { read: ['finance.invoice.read'], write: ['finance.invoice.write'] },
  'FINANCE:FINANCE_APPROVALS': { read: ['finance.po.read', 'finance.invoice.read'], write: ['finance.approval.approve'] },
  'FINANCE:FINANCE_ASSETS_LEDGER': { read: ['finance.assets.read'], write: ['finance.assets.write'] },
  'FINANCE:FINANCE_REPORTS': { read: ['finance.reports.read'] },

  'ASSETS:ASSETS_EQUIPMENT': { read: ['assets.view', 'assets.equipment.read'], write: ['assets.equipment.write'] },
  'ASSETS:ASSETS_ASSIGNMENTS': { read: ['assets.assignment.read'], write: ['assets.assignment.write'] },
  'ASSETS:ASSETS_STOCK': { read: ['assets.stock.read'], write: ['assets.stock.write'] },
  'ASSETS:ASSETS_DELIVERIES': { read: ['assets.delivery.read'], write: ['assets.delivery.write'] },
  'ASSETS:ASSETS_MAINTENANCE': { read: ['assets.maintenance.read'], write: ['assets.maintenance.write'] },
  'ASSETS:ASSETS_REPORTS': { read: ['assets.reports.read'] },

  'COMPLIANCE:COMPLIANCE_RETENTION': { read: ['compliance.view', 'compliance.retention.read'], write: ['compliance.retention.write'] },
  'COMPLIANCE:COMPLIANCE_ANONYMIZATION': { read: ['compliance.anonymize.request'], write: ['compliance.anonymize.approve'] },
  'COMPLIANCE:COMPLIANCE_AUDIT_VIEW': { read: ['audit.read'] },
};

const uniq = (items: string[]) => [...new Set(items)];

export function permissionsFromEntitlement(input: {
  module: ModuleKey;
  submodule: SubmoduleKey;
  level: AccessLevel;
}): string[] {
  const key = `${input.module}:${input.submodule}` as EntitlementMappingKey;
  const rule = RULES[key];
  if (!rule) return [];

  if (input.level === 'READ') {
    return uniq(rule.read);
  }

  return uniq([...(rule.read || []), ...(rule.write || [])]);
}

export function permissionsFromEntitlements(
  entitlements: Array<{ module: ModuleKey; submodule: SubmoduleKey; level: AccessLevel }>
): string[] {
  return uniq(entitlements.flatMap(permissionsFromEntitlement));
}
