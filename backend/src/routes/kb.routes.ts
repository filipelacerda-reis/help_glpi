import { Router } from 'express';
import { kbController } from '../controllers/kb.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// Categorias
router.get('/categories', authenticate, kbController.getAllCategories);
router.get('/categories/:id', authenticate, kbController.getCategoryById);
router.post('/categories', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER), kbController.createCategory);
router.put('/categories/:id', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER), kbController.updateCategory);
router.delete('/categories/:id', authenticate, authorize(UserRole.ADMIN), kbController.deleteCategory);

// Artigos
router.get('/articles', authenticate, kbController.searchArticles);
router.get('/articles/:id', authenticate, kbController.getArticleById);
router.post('/articles', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER), kbController.createArticle);
router.put('/articles/:id', authenticate, authorize(UserRole.ADMIN, UserRole.TRIAGER), kbController.updateArticle);
router.delete('/articles/:id', authenticate, authorize(UserRole.ADMIN), kbController.deleteArticle);

// Sugestões
router.post('/suggestions', authenticate, kbController.suggestArticles);
router.post('/ai-solution', authenticate, kbController.getAiSolution);

export { router as kbRoutes };

