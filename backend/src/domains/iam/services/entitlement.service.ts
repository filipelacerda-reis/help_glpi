import { AccessLevel, ModuleKey, SubmoduleKey } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { AppError } from '../../../middleware/errorHandler';
import { ENTITLEMENT_CATALOG } from '../entitlements/entitlementCatalog';
import { PERMISSION_CATALOG } from '../entitlements/permissionCatalog';

export type UserEntitlementInput = {
  module: ModuleKey;
  submodule: SubmoduleKey;
  level: AccessLevel;
};

const uniqueKey = (e: UserEntitlementInput) => `${e.module}:${e.submodule}`;

export const entitlementService = {
  getPermissionCatalog() {
    return PERMISSION_CATALOG.map((key) => ({ key }));
  },

  getEntitlementCatalog() {
    return ENTITLEMENT_CATALOG;
  },

  async getUserEntitlements(userId: string) {
    return prisma.userEntitlement.findMany({
      where: { userId },
      orderBy: [{ module: 'asc' }, { submodule: 'asc' }],
    });
  },

  async replaceUserEntitlements(userId: string, items: UserEntitlementInput[]) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new AppError('Usuário não encontrado', 404);

    const normalized = new Map<string, UserEntitlementInput>();
    for (const item of items) {
      normalized.set(uniqueKey(item), item);
    }
    const values = [...normalized.values()];

    await prisma.$transaction(async (tx) => {
      await tx.userEntitlement.deleteMany({ where: { userId } });
      if (values.length > 0) {
        await tx.userEntitlement.createMany({
          data: values.map((item) => ({
            userId,
            module: item.module,
            submodule: item.submodule,
            level: item.level,
          })),
        });
      }
    });

    return this.getUserEntitlements(userId);
  },
};
