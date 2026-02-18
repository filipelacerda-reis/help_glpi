import { Router } from 'express';
import { reportPresetController } from '../controllers/reportPreset.controller';
import { authenticate, requireModuleAccess } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);
router.use(requireModuleAccess('METRICS'));

router.get('/', reportPresetController.getPresets);
router.post('/', reportPresetController.createPreset);
router.put('/:id', reportPresetController.updatePreset);
router.delete('/:id', reportPresetController.deletePreset);

export { router as reportPresetRoutes };
