import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, requireModuleAccess, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../domains/iam/services/authorization.service';

const router = Router();

router.get('/me', authenticate, userController.getCurrentUser);
router.get('/', authenticate, requireModuleAccess('USERS'), requirePermission(PERMISSIONS.USER_MANAGE), userController.getAllUsers);
router.get('/:id', authenticate, requireModuleAccess('USERS'), requirePermission(PERMISSIONS.USER_MANAGE), userController.getUserById);
router.post('/', authenticate, requireModuleAccess('USERS'), requirePermission(PERMISSIONS.USER_MANAGE), userController.createUser);
router.patch('/:id', authenticate, requireModuleAccess('USERS'), requirePermission(PERMISSIONS.USER_MANAGE), userController.updateUser);
router.delete('/:id', authenticate, requireModuleAccess('USERS'), requirePermission(PERMISSIONS.USER_MANAGE), userController.deleteUser);

export { router as userRoutes };
