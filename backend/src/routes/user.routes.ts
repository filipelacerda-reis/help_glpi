import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.get('/me', authenticate, userController.getCurrentUser);
router.get('/', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.REQUESTER), userController.getAllUsers);
router.get('/:id', authenticate, authorize(UserRole.ADMIN), userController.getUserById);
router.post('/', authenticate, authorize(UserRole.ADMIN), userController.createUser);
router.patch('/:id', authenticate, authorize(UserRole.ADMIN), userController.updateUser);
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), userController.deleteUser);

export { router as userRoutes };

