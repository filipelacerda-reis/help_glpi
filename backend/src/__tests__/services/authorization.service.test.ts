import prisma from '../../lib/prisma';
import { authorizationService, PERMISSIONS } from '../../domains/iam/services/authorization.service';
import { hashPassword } from '../../utils/password';

describe('authorizationService', () => {
  it('deve aplicar fallback de permissões pelo role legado quando não há user_roles', async () => {
    const suffix = Date.now().toString();
    const user = await prisma.user.create({
      data: {
        name: 'Legacy Admin',
        email: `legacy-admin-${suffix}@test.local`,
        passwordHash: await hashPassword('123456'),
        role: 'ADMIN',
      },
    });

    const context = await authorizationService.resolveContext(user.id);

    expect(context).not.toBeNull();
    expect(context?.permissions).toContain(PERMISSIONS.PLATFORM_SETTINGS_WRITE);
    expect(context?.permissions).toContain(PERMISSIONS.HR_EMPLOYEE_READ_PII);
  });

  it('deve usar permissões explícitas quando usuário tem user_roles', async () => {
    const suffix = Date.now().toString();
    const user = await prisma.user.create({
      data: {
        name: 'Permission User',
        email: `perm-user-${suffix}@test.local`,
        passwordHash: await hashPassword('123456'),
        role: 'REQUESTER',
      },
    });

    const permission = await prisma.permission.create({
      data: {
        key: `custom.permission.test.${suffix}`,
        description: 'Permissão de teste',
      },
    });

    const role = await prisma.role.create({
      data: {
        name: `CUSTOM_TEST_ROLE_${suffix}`,
        description: 'Role para teste',
      },
    });

    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });

    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    const context = await authorizationService.resolveContext(user.id);

    expect(context).not.toBeNull();
    expect(context?.permissions).toEqual([`custom.permission.test.${suffix}`]);
  });

  it('deve mesclar permissões vindas de entitlements', async () => {
    const suffix = Date.now().toString();
    const user = await prisma.user.create({
      data: {
        name: 'Entitled User',
        email: `entitled-user-${suffix}@test.local`,
        passwordHash: await hashPassword('123456'),
        role: 'REQUESTER',
      },
    });

    await prisma.userEntitlement.createMany({
      data: [
        {
          userId: user.id,
          module: 'FINANCE',
          submodule: 'FINANCE_INVOICES',
          level: 'WRITE',
        },
      ],
    });

    const context = await authorizationService.resolveContext(user.id);

    expect(context).not.toBeNull();
    expect(context?.permissions).toContain(PERMISSIONS.FINANCE_INVOICE_READ);
    expect(context?.permissions).toContain(PERMISSIONS.FINANCE_INVOICE_WRITE);
    expect(context?.entitlements.length).toBeGreaterThan(0);
  });
});
