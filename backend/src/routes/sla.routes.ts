import { Router } from 'express';
import { slaController, businessCalendarController } from '../controllers/sla.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// Calendários
router.get('/calendars', authenticate, businessCalendarController.getAllCalendars);
router.get('/calendars/:id', authenticate, businessCalendarController.getCalendarById);
router.post('/calendars', authenticate, authorize(UserRole.ADMIN), businessCalendarController.createCalendar);
router.put('/calendars/:id', authenticate, authorize(UserRole.ADMIN), businessCalendarController.updateCalendar);

// Políticas de SLA
router.get('/policies', authenticate, slaController.getAllPolicies);
router.get('/policies/:id', authenticate, slaController.getPolicyById);
router.post('/policies', authenticate, authorize(UserRole.ADMIN), slaController.createPolicy);
router.put('/policies/:id', authenticate, authorize(UserRole.ADMIN), slaController.updatePolicy);
router.delete('/policies/:id', authenticate, authorize(UserRole.ADMIN), slaController.deletePolicy);

export { router as slaRoutes };
