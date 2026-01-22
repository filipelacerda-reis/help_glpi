import { Router } from 'express';
import { automationController } from '../controllers/automation.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.get('/', authenticate, automationController.getAllRules);
router.get('/:id', authenticate, automationController.getRuleById);
router.post('/', authenticate, authorize(UserRole.ADMIN), automationController.createRule);
router.put('/:id', authenticate, authorize(UserRole.ADMIN), automationController.updateRule);
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), automationController.deleteRule);

export { router as automationRoutes };

