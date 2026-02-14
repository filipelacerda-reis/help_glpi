import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { employeeController } from '../controllers/employee.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), employeeController.getAll);
router.get('/:id', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), employeeController.getById);
router.get('/:id/equipments.pdf', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), employeeController.downloadEquipmentsPdf);
router.post('/', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER), employeeController.create);
router.patch('/:id', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER), employeeController.update);
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), employeeController.delete);

export { router as employeeRoutes };
