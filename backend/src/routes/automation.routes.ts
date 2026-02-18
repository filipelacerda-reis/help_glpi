import { Router } from 'express';
import { automationController } from '../controllers/automation.controller';
import { authenticate, authorize, requireModuleAccess } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.get('/', authenticate, requireModuleAccess('AUTOMATIONS'), automationController.getAllRules);
router.get('/:id', authenticate, requireModuleAccess('AUTOMATIONS'), automationController.getRuleById);
router.post('/', authenticate, requireModuleAccess('AUTOMATIONS'), authorize(UserRole.ADMIN), automationController.createRule);
router.put('/:id', authenticate, requireModuleAccess('AUTOMATIONS'), authorize(UserRole.ADMIN), automationController.updateRule);
router.delete('/:id', authenticate, requireModuleAccess('AUTOMATIONS'), authorize(UserRole.ADMIN), automationController.deleteRule);

export { router as automationRoutes };
