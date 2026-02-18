import { Router } from 'express';
import { tagController } from '../controllers/tag.controller';
import { authenticate, authorize, requireModuleAccess } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// Rotas públicas (autenticadas) para leitura
router.get('/', authenticate, tagController.getAllTags);
router.get('/:id', authenticate, tagController.getTagById);

// Rotas de mutação apenas para ADMIN
router.post('/', authenticate, requireModuleAccess('TAGS'), authorize(UserRole.ADMIN), tagController.createTag);
router.patch('/:id', authenticate, requireModuleAccess('TAGS'), authorize(UserRole.ADMIN), tagController.updateTag);
router.delete('/:id', authenticate, requireModuleAccess('TAGS'), authorize(UserRole.ADMIN), tagController.deleteTag);

export { router as tagRoutes };
