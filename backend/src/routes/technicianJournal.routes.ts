import { Router } from 'express';
import { technicianJournalController } from '../controllers/technicianJournal.controller';
import { technicianMetricsController } from '../controllers/technicianMetrics.controller';
import { authenticate, requireModuleAccess } from '../middleware/auth';
import { uploadMultiple } from '../utils/upload';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

router.get('/me/journal', requireModuleAccess('JOURNAL'), technicianJournalController.getMyJournal);
router.post(
  '/me/journal/manual',
  requireModuleAccess('JOURNAL'),
  uploadMultiple,
  technicianJournalController.createManualEntry
);
router.get('/me/journal/summary', requireModuleAccess('JOURNAL'), technicianJournalController.getMyJournalSummary);
router.get('/me/metrics', requireModuleAccess('METRICS'), technicianMetricsController.getMyMetrics);

export { router as technicianJournalRoutes };
