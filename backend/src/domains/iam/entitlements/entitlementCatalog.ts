import { ModuleKey, SubmoduleKey } from '@prisma/client';

export type EntitlementCatalogEntry = {
  module: ModuleKey;
  submodule: SubmoduleKey;
  label: string;
  description?: string;
};

export const ENTITLEMENT_CATALOG: EntitlementCatalogEntry[] = [
  { module: 'ADMIN', submodule: 'ADMIN_SETTINGS', label: 'Admin / Settings' },
  { module: 'ADMIN', submodule: 'ADMIN_USERS', label: 'Admin / Users' },
  { module: 'ADMIN', submodule: 'ADMIN_ROLES_PERMS', label: 'Admin / Roles & Permissions' },
  { module: 'ADMIN', submodule: 'ADMIN_SSO', label: 'Admin / SSO' },
  { module: 'ADMIN', submodule: 'ADMIN_GROUP_MAPPING', label: 'Admin / Group Mapping' },
  { module: 'ADMIN', submodule: 'ADMIN_AUDIT', label: 'Admin / Audit' },

  { module: 'ITSM', submodule: 'ITSM_TICKETS', label: 'ITSM / Tickets' },
  { module: 'ITSM', submodule: 'ITSM_SLA', label: 'ITSM / SLA' },
  { module: 'ITSM', submodule: 'ITSM_KB', label: 'ITSM / Knowledge Base' },
  { module: 'ITSM', submodule: 'ITSM_AUTOMATIONS', label: 'ITSM / Automations' },
  { module: 'ITSM', submodule: 'ITSM_REPORTS', label: 'ITSM / Reports' },

  { module: 'HR', submodule: 'HR_EMPLOYEES', label: 'HR / Employees' },
  { module: 'HR', submodule: 'HR_EMPLOYEES_PII', label: 'HR / Employees PII' },
  { module: 'HR', submodule: 'HR_ONBOARDING', label: 'HR / Onboarding' },
  { module: 'HR', submodule: 'HR_OFFBOARDING', label: 'HR / Offboarding' },
  { module: 'HR', submodule: 'HR_POLICIES', label: 'HR / Policies' },
  { module: 'HR', submodule: 'HR_REPORTS', label: 'HR / Reports' },

  { module: 'FINANCE', submodule: 'FINANCE_COST_CENTERS', label: 'Finance / Cost Centers' },
  { module: 'FINANCE', submodule: 'FINANCE_VENDORS', label: 'Finance / Vendors' },
  { module: 'FINANCE', submodule: 'FINANCE_PURCHASE_REQUESTS', label: 'Finance / Purchase Requests' },
  { module: 'FINANCE', submodule: 'FINANCE_PURCHASE_ORDERS', label: 'Finance / Purchase Orders' },
  { module: 'FINANCE', submodule: 'FINANCE_INVOICES', label: 'Finance / Invoices' },
  { module: 'FINANCE', submodule: 'FINANCE_APPROVALS', label: 'Finance / Approvals' },
  { module: 'FINANCE', submodule: 'FINANCE_ASSETS_LEDGER', label: 'Finance / Assets Ledger' },
  { module: 'FINANCE', submodule: 'FINANCE_REPORTS', label: 'Finance / Reports' },

  { module: 'ASSETS', submodule: 'ASSETS_EQUIPMENT', label: 'Assets / Equipment' },
  { module: 'ASSETS', submodule: 'ASSETS_ASSIGNMENTS', label: 'Assets / Assignments' },
  { module: 'ASSETS', submodule: 'ASSETS_STOCK', label: 'Assets / Stock' },
  { module: 'ASSETS', submodule: 'ASSETS_DELIVERIES', label: 'Assets / Deliveries' },
  { module: 'ASSETS', submodule: 'ASSETS_MAINTENANCE', label: 'Assets / Maintenance' },
  { module: 'ASSETS', submodule: 'ASSETS_REPORTS', label: 'Assets / Reports' },

  { module: 'COMPLIANCE', submodule: 'COMPLIANCE_RETENTION', label: 'Compliance / Retention' },
  { module: 'COMPLIANCE', submodule: 'COMPLIANCE_ANONYMIZATION', label: 'Compliance / Anonymization' },
  { module: 'COMPLIANCE', submodule: 'COMPLIANCE_AUDIT_VIEW', label: 'Compliance / Audit View' },
];
