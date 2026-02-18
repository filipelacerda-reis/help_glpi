import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { authenticate, authorize, requireModuleAccess } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// Leitura pública (para seleção em formulários)
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);

// Mutações apenas para ADMIN
router.post('/', authenticate, requireModuleAccess('CATEGORIES'), authorize(UserRole.ADMIN), categoryController.createCategory);
router.patch('/:id', authenticate, requireModuleAccess('CATEGORIES'), authorize(UserRole.ADMIN), categoryController.updateCategory);
router.delete('/:id', authenticate, requireModuleAccess('CATEGORIES'), authorize(UserRole.ADMIN), categoryController.deleteCategory);

export { router as categoryRoutes };
