import { Router } from 'express';
import { slaController, businessCalendarController } from '../controllers/sla.controller';
import { authenticate, authorize, requireModuleAccess } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// Calendários
router.get('/calendars', authenticate, requireModuleAccess('SLA'), businessCalendarController.getAllCalendars);
router.get('/calendars/:id', authenticate, requireModuleAccess('SLA'), businessCalendarController.getCalendarById);
router.post('/calendars', authenticate, requireModuleAccess('SLA'), authorize(UserRole.ADMIN), businessCalendarController.createCalendar);
router.put('/calendars/:id', authenticate, requireModuleAccess('SLA'), authorize(UserRole.ADMIN), businessCalendarController.updateCalendar);

// Políticas de SLA
router.get('/policies', authenticate, requireModuleAccess('SLA'), slaController.getAllPolicies);
router.get('/policies/:id', authenticate, requireModuleAccess('SLA'), slaController.getPolicyById);
router.post('/policies', authenticate, requireModuleAccess('SLA'), authorize(UserRole.ADMIN), slaController.createPolicy);
router.put('/policies/:id', authenticate, requireModuleAccess('SLA'), authorize(UserRole.ADMIN), slaController.updatePolicy);
router.delete('/policies/:id', authenticate, requireModuleAccess('SLA'), authorize(UserRole.ADMIN), slaController.deletePolicy);

export { router as slaRoutes };
