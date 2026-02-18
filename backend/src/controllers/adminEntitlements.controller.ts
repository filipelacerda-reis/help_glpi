import { Request, Response } from 'express';
import { z } from 'zod';
import { AccessLevel, ModuleKey, SubmoduleKey } from '@prisma/client';
import { entitlementService } from '../domains/iam/services/entitlement.service';

const updateEntitlementsSchema = z.object({
  entitlements: z.array(
    z.object({
      module: z.nativeEnum(ModuleKey),
      submodule: z.nativeEnum(SubmoduleKey),
      level: z.nativeEnum(AccessLevel),
    })
  ),
});

export const adminEntitlementsController = {
  async getPermissionCatalog(_req: Request, res: Response) {
    res.json(entitlementService.getPermissionCatalog());
  },

  async getEntitlementCatalog(_req: Request, res: Response) {
    res.json(entitlementService.getEntitlementCatalog());
  },

  async getUserEntitlements(req: Request, res: Response) {
    const data = await entitlementService.getUserEntitlements(req.params.id);
    res.json(data);
  },

  async replaceUserEntitlements(req: Request, res: Response) {
    const payload = updateEntitlementsSchema.parse(req.body);
    const data = await entitlementService.replaceUserEntitlements(
      req.params.id,
      payload.entitlements
    );
    res.json(data);
  },
};
