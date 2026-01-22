import { Router } from 'express';
import { metricsController } from '../controllers/metrics.controller';
import { advancedMetricsController } from '../controllers/advancedMetrics.controller';
import { authenticate, authorize, authorizeAdminOrTeamLead } from '../middleware/auth';
import { samlAdminController } from '../controllers/samlAdmin.controller';
import { UserRole } from '@prisma/client';

const router = Router();

// Todas as rotas de admin requerem autenticação
router.use(authenticate);

// Rotas de métricas: permitir ADMIN ou líderes de time
router.get('/metrics', authorizeAdminOrTeamLead(), metricsController.getMetrics);
router.get('/metrics/enterprise', authorizeAdminOrTeamLead(), metricsController.getEnterpriseMetrics);
router.get('/metrics/tickets/summary', authorizeAdminOrTeamLead(), advancedMetricsController.getTicketSummary);
router.get('/metrics/expanded', authorizeAdminOrTeamLead(), advancedMetricsController.getExpandedMetrics);
router.get('/saml-config', authorize(UserRole.ADMIN), samlAdminController.getConfig);
router.put('/saml-config', authorize(UserRole.ADMIN), samlAdminController.updateConfig);

export { router as adminRoutes };

