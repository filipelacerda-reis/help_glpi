import { Router } from 'express';
import { authenticate, requireModuleAccess, requirePermission } from '../middleware/auth';
import { adminSettingsController } from '../controllers/adminSettings.controller';
import { adminToolsController } from '../controllers/adminTools.controller';
import { adminAuditController } from '../controllers/adminAudit.controller';
import { adminEntitlementsController } from '../controllers/adminEntitlements.controller';
import { PERMISSIONS } from '../domains/iam/services/authorization.service';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('ADMIN'));

router.get('/settings', requirePermission(PERMISSIONS.PLATFORM_SETTINGS_READ), adminSettingsController.getSettings);
router.put('/settings', requirePermission(PERMISSIONS.PLATFORM_SETTINGS_WRITE), adminSettingsController.updateSettings);
router.get('/settings/slack', requirePermission(PERMISSIONS.PLATFORM_SETTINGS_READ), adminSettingsController.getSlackSettings);
router.put('/settings/slack', requirePermission(PERMISSIONS.PLATFORM_SETTINGS_WRITE), adminSettingsController.updateSlackSettings);
router.post('/settings/saml/test', requirePermission(PERMISSIONS.PLATFORM_AUTHPROVIDER_WRITE), adminSettingsController.testSamlSettings);
router.post('/settings/auth0/test', requirePermission(PERMISSIONS.PLATFORM_AUTHPROVIDER_WRITE), adminSettingsController.testAuth0Settings);

router.post('/tools/recalculate-sla', requirePermission(PERMISSIONS.PLATFORM_SETTINGS_WRITE), adminToolsController.recalculateSla);
router.get('/audit', requirePermission(PERMISSIONS.AUDIT_READ), adminAuditController.list);
router.get('/audit/export', requirePermission(PERMISSIONS.AUDIT_READ), adminAuditController.exportJson);

router.get(
  '/permission-catalog',
  requirePermission(PERMISSIONS.PLATFORM_ROLES_READ),
  adminEntitlementsController.getPermissionCatalog
);
router.get(
  '/entitlement-catalog',
  requirePermission(PERMISSIONS.PLATFORM_ROLES_READ),
  adminEntitlementsController.getEntitlementCatalog
);
router.get(
  '/users/:id/entitlements',
  requirePermission(PERMISSIONS.PLATFORM_USERS_READ),
  adminEntitlementsController.getUserEntitlements
);
router.put(
  '/users/:id/entitlements',
  requirePermission(PERMISSIONS.PLATFORM_USERS_WRITE),
  adminEntitlementsController.replaceUserEntitlements
);

export { router as adminSettingsRoutes };
