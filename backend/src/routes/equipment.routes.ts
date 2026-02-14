import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { equipmentController } from '../controllers/equipment.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getAll);
router.get('/dashboard', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getDashboard);
router.get('/alerts', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getAlerts);
router.get('/assignments', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getAssignments);
router.get('/assignments/:assignmentId/term.pdf', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.downloadDeliveryTermPdf);
router.get('/:id', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getById);

router.post('/', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.create);
router.patch('/:id', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.update);
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), equipmentController.delete);
router.post('/:id/assignments', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.assign);
router.post('/assignments/:assignmentId/return', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.returnAssignment);

export { router as equipmentRoutes };
