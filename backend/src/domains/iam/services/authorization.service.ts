import { UserRole } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { permissionsFromEntitlements } from '../entitlements/map';

export type AuthorizationContext = {
  userId: string;
  legacyRole: UserRole;
  permissions: string[];
  entitlements: Array<{
    module: string;
    submodule: string;
    level: string;
  }>;
  attributes: {
    employeeId?: string | null;
    businessUnit?: string | null;
    costCenterId?: string | null;
    location?: string | null;
    managerUserId?: string | null;
  };
};

export const PERMISSIONS = {
  // Platform/Admin
  PLATFORM_ADMIN_VIEW: 'platform.admin.view',
  PLATFORM_SETTINGS_READ: 'platform.settings.read',
  PLATFORM_SETTINGS_WRITE: 'platform.settings.write',
  PLATFORM_AUTHPROVIDER_READ: 'platform.authprovider.read',
  PLATFORM_AUTHPROVIDER_WRITE: 'platform.authprovider.write',
  PLATFORM_GROUPMAPPING_READ: 'platform.groupmapping.read',
  PLATFORM_GROUPMAPPING_WRITE: 'platform.groupmapping.write',
  PLATFORM_USERS_READ: 'platform.users.read',
  PLATFORM_USERS_WRITE: 'platform.users.write',
  PLATFORM_ROLES_READ: 'platform.roles.read',
  PLATFORM_ROLES_WRITE: 'platform.roles.write',
  AUDIT_READ: 'audit.read',

  // IAM
  IAM_USER_VIEW: 'iam.user.view',
  IAM_USER_READ: 'iam.user.read',
  IAM_USER_WRITE: 'iam.user.write',
  IAM_USER_DISABLE: 'iam.user.disable',
  IAM_ROLE_READ: 'iam.role.read',
  IAM_ROLE_WRITE: 'iam.role.write',

  // ITSM
  ITSM_VIEW: 'itsm.view',
  ITSM_TICKET_READ: 'itsm.ticket.read',
  ITSM_TICKET_WRITE: 'itsm.ticket.write',
  ITSM_TICKET_ASSIGN: 'itsm.ticket.assign',
  ITSM_TICKET_CLOSE: 'itsm.ticket.close',
  ITSM_SLA_READ: 'itsm.sla.read',
  ITSM_SLA_WRITE: 'itsm.sla.write',
  ITSM_KB_READ: 'itsm.kb.read',
  ITSM_KB_WRITE: 'itsm.kb.write',
  ITSM_AUTOMATION_READ: 'itsm.automation.read',
  ITSM_AUTOMATION_WRITE: 'itsm.automation.write',
  ITSM_REPORTS_READ: 'itsm.reports.read',

  // Assets
  ASSETS_VIEW: 'assets.view',
  ASSETS_EQUIPMENT_READ: 'assets.equipment.read',
  ASSETS_EQUIPMENT_WRITE: 'assets.equipment.write',
  ASSETS_ASSIGNMENT_READ: 'assets.assignment.read',
  ASSETS_ASSIGNMENT_WRITE: 'assets.assignment.write',
  ASSETS_STOCK_READ: 'assets.stock.read',
  ASSETS_STOCK_WRITE: 'assets.stock.write',
  ASSETS_DELIVERY_READ: 'assets.delivery.read',
  ASSETS_DELIVERY_WRITE: 'assets.delivery.write',
  ASSETS_MAINTENANCE_READ: 'assets.maintenance.read',
  ASSETS_MAINTENANCE_WRITE: 'assets.maintenance.write',
  ASSETS_REPORTS_READ: 'assets.reports.read',

  // HR
  HR_VIEW: 'hr.view',
  HR_EMPLOYEE_READ: 'hr.employee.read',
  HR_EMPLOYEE_WRITE: 'hr.employee.write',
  HR_EMPLOYEE_READ_PII: 'hr.employee.read_pii',
  HR_EMPLOYEE_WRITE_PII: 'hr.employee.write_pii',
  HR_ONBOARDING_READ: 'hr.onboarding.read',
  HR_ONBOARDING_WRITE: 'hr.onboarding.write',
  HR_OFFBOARDING_READ: 'hr.offboarding.read',
  HR_OFFBOARDING_WRITE: 'hr.offboarding.write',
  HR_POLICY_READ: 'hr.policy.read',
  HR_POLICY_WRITE: 'hr.policy.write',
  HR_ACK_READ: 'hr.ack.read',
  HR_ACK_WRITE: 'hr.ack.write',
  HR_REPORTS_READ: 'hr.reports.read',

  // Finance
  FINANCE_VIEW: 'finance.view',
  FINANCE_COSTCENTER_READ: 'finance.costcenter.read',
  FINANCE_COSTCENTER_WRITE: 'finance.costcenter.write',
  FINANCE_VENDOR_READ: 'finance.vendor.read',
  FINANCE_VENDOR_WRITE: 'finance.vendor.write',
  FINANCE_PR_READ: 'finance.pr.read',
  FINANCE_PR_WRITE: 'finance.pr.write',
  FINANCE_PO_READ: 'finance.po.read',
  FINANCE_PO_WRITE: 'finance.po.write',
  FINANCE_INVOICE_READ: 'finance.invoice.read',
  FINANCE_INVOICE_WRITE: 'finance.invoice.write',
  FINANCE_APPROVAL_APPROVE: 'finance.approval.approve',
  FINANCE_ASSETS_READ: 'finance.assets.read',
  FINANCE_ASSETS_WRITE: 'finance.assets.write',
  FINANCE_REPORTS_READ: 'finance.reports.read',

  // Compliance
  COMPLIANCE_VIEW: 'compliance.view',
  COMPLIANCE_RETENTION_READ: 'compliance.retention.read',
  COMPLIANCE_RETENTION_WRITE: 'compliance.retention.write',
  COMPLIANCE_ANONYMIZE_REQUEST: 'compliance.anonymize.request',
  COMPLIANCE_ANONYMIZE_APPROVE: 'compliance.anonymize.approve',

  // Legacy aliases (compat)
  USER_MANAGE: 'platform.users.write',
  ASSETS_READ: 'assets.equipment.read',
  ASSETS_WRITE: 'assets.equipment.write',
  FINANCE_READ: 'finance.view',
  FINANCE_WRITE: 'finance.pr.write',
  FINANCE_APPROVE: 'finance.approval.approve',
  PROCUREMENT_READ: 'finance.pr.read',
  PROCUREMENT_WRITE: 'finance.pr.write',
  MANAGER_TEAM_READ: 'hr.employee.read',
} as const;

const LEGACY_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: Object.values(PERMISSIONS),
  TRIAGER: [
    PERMISSIONS.PLATFORM_USERS_WRITE,
    PERMISSIONS.IAM_USER_WRITE,
    PERMISSIONS.HR_EMPLOYEE_READ,
    PERMISSIONS.HR_EMPLOYEE_WRITE,
    PERMISSIONS.ASSETS_EQUIPMENT_READ,
    PERMISSIONS.ASSETS_EQUIPMENT_WRITE,
    PERMISSIONS.ASSETS_ASSIGNMENT_READ,
    PERMISSIONS.ASSETS_ASSIGNMENT_WRITE,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_PR_READ,
    PERMISSIONS.FINANCE_PR_WRITE,
    PERMISSIONS.FINANCE_APPROVAL_APPROVE,
  ],
  TECHNICIAN: [
    PERMISSIONS.ITSM_VIEW,
    PERMISSIONS.ITSM_TICKET_READ,
    PERMISSIONS.ITSM_TICKET_WRITE,
    PERMISSIONS.ASSETS_EQUIPMENT_READ,
    PERMISSIONS.ASSETS_ASSIGNMENT_READ,
    PERMISSIONS.ASSETS_ASSIGNMENT_WRITE,
  ],
  REQUESTER: [PERMISSIONS.ITSM_VIEW, PERMISSIONS.ITSM_TICKET_READ, PERMISSIONS.ITSM_TICKET_WRITE],
};

const unique = (items: string[]) => [...new Set(items)];

export const authorizationService = {
  async resolveContext(userId: string): Promise<AuthorizationContext | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        roleAssignments: {
          select: {
            role: {
              select: {
                rolePermissions: {
                  select: {
                    permission: {
                      select: { key: true },
                    },
                  },
                },
              },
            },
          },
        },
        entitlements: {
          select: {
            module: true,
            submodule: true,
            level: true,
          },
        },
        attributes: {
          select: {
            employeeId: true,
            businessUnit: true,
            costCenterId: true,
            location: true,
            managerUserId: true,
          },
        },
      },
    });

    if (!user) return null;

    const explicitPermissions = user.roleAssignments.flatMap((assignment) =>
      assignment.role.rolePermissions.map((rp) => rp.permission.key)
    );

    const entitlementPermissions = permissionsFromEntitlements(user.entitlements as any);

    const roleBasedPermissions =
      explicitPermissions.length > 0
        ? explicitPermissions
        : LEGACY_ROLE_PERMISSIONS[user.role] || [];

    const permissions = unique([...roleBasedPermissions, ...entitlementPermissions]);

    return {
      userId: user.id,
      legacyRole: user.role,
      permissions,
      entitlements: user.entitlements,
      attributes: user.attributes || {},
    };
  },
};

export const hasPermission = (permissions: string[] | undefined, key: string) =>
  Boolean(permissions && permissions.includes(key));
