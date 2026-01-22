import { Router } from 'express';
import { technicianJournalController } from '../controllers/technicianJournal.controller';
import { technicianMetricsController } from '../controllers/technicianMetrics.controller';
import { authenticate } from '../middleware/auth';
import { uploadMultiple } from '../utils/upload';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

router.get('/me/journal', technicianJournalController.getMyJournal);
router.post(
  '/me/journal/manual',
  uploadMultiple,
  technicianJournalController.createManualEntry
);
router.get('/me/journal/summary', technicianJournalController.getMyJournalSummary);
router.get('/me/metrics', technicianMetricsController.getMyMetrics);

export { router as technicianJournalRoutes };

