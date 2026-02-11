import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { adminSettingsController } from '../controllers/adminSettings.controller';
import { adminToolsController } from '../controllers/adminTools.controller';
import { adminAuditController } from '../controllers/adminAudit.controller';

const router = Router();

router.use(authenticate);
router.use(requireAdmin());

router.get('/settings', adminSettingsController.getSettings);
router.put('/settings', adminSettingsController.updateSettings);
router.post('/settings/saml/test', adminSettingsController.testSamlSettings);
router.post('/settings/auth0/test', adminSettingsController.testAuth0Settings);

router.post('/tools/recalculate-sla', adminToolsController.recalculateSla);
router.get('/audit', adminAuditController.list);
router.get('/audit/export', adminAuditController.exportJson);

export { router as adminSettingsRoutes };
