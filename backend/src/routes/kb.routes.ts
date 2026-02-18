import { Router } from 'express';
import { kbController } from '../controllers/kb.controller';
import { authenticate, authorize, requireModuleAccess } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// Categorias
router.get('/categories', authenticate, requireModuleAccess('KB'), kbController.getAllCategories);
router.get('/categories/:id', authenticate, requireModuleAccess('KB'), kbController.getCategoryById);
router.post('/categories', authenticate, requireModuleAccess('KB'), authorize(UserRole.ADMIN, UserRole.TRIAGER), kbController.createCategory);
router.put('/categories/:id', authenticate, requireModuleAccess('KB'), authorize(UserRole.ADMIN, UserRole.TRIAGER), kbController.updateCategory);
router.delete('/categories/:id', authenticate, requireModuleAccess('KB'), authorize(UserRole.ADMIN), kbController.deleteCategory);

// Artigos
router.get('/articles', authenticate, requireModuleAccess('KB'), kbController.searchArticles);
router.get('/articles/:id', authenticate, requireModuleAccess('KB'), kbController.getArticleById);
router.post('/articles', authenticate, requireModuleAccess('KB'), authorize(UserRole.ADMIN, UserRole.TRIAGER), kbController.createArticle);
router.put('/articles/:id', authenticate, requireModuleAccess('KB'), authorize(UserRole.ADMIN, UserRole.TRIAGER), kbController.updateArticle);
router.delete('/articles/:id', authenticate, requireModuleAccess('KB'), authorize(UserRole.ADMIN), kbController.deleteArticle);

// Sugestões
router.post('/suggestions', authenticate, requireModuleAccess('KB'), kbController.suggestArticles);
router.post('/ai-solution', authenticate, requireModuleAccess('KB'), kbController.getAiSolution);

export { router as kbRoutes };
