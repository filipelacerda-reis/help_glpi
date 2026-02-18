import { Router } from 'express';
import { metricsController } from '../controllers/metrics.controller';
import { advancedMetricsController } from '../controllers/advancedMetrics.controller';
import { authenticate, authorizeAdminOrTeamLead, requireModuleAccess, requirePermission } from '../middleware/auth';
import { samlAdminController } from '../controllers/samlAdmin.controller';
import { PERMISSIONS } from '../domains/iam/services/authorization.service';

const router = Router();

// Todas as rotas de admin requerem autenticação
router.use(authenticate);

// Rotas de métricas: permitir ADMIN ou líderes de time
router.get('/metrics', requireModuleAccess('METRICS'), authorizeAdminOrTeamLead(), metricsController.getMetrics);
router.get('/metrics/enterprise', requireModuleAccess('METRICS'), authorizeAdminOrTeamLead(), metricsController.getEnterpriseMetrics);
router.get('/metrics/tickets/summary', requireModuleAccess('METRICS'), authorizeAdminOrTeamLead(), advancedMetricsController.getTicketSummary);
router.get('/metrics/expanded', requireModuleAccess('METRICS'), authorizeAdminOrTeamLead(), advancedMetricsController.getExpandedMetrics);
router.get('/saml-config', requireModuleAccess('ADMIN'), requirePermission(PERMISSIONS.PLATFORM_SETTINGS_WRITE), samlAdminController.getConfig);
router.put('/saml-config', requireModuleAccess('ADMIN'), requirePermission(PERMISSIONS.PLATFORM_SETTINGS_WRITE), samlAdminController.updateConfig);

export { router as adminRoutes };
