import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate, requireModuleAccess } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.get('/', authenticate, requireModuleAccess('NOTIFICATIONS'), notificationController.getNotifications);
router.get('/unread-count', authenticate, requireModuleAccess('NOTIFICATIONS'), notificationController.getUnreadCount);
router.patch('/:id/read', authenticate, requireModuleAccess('NOTIFICATIONS'), notificationController.markAsRead);
router.patch('/read-all', authenticate, requireModuleAccess('NOTIFICATIONS'), notificationController.markAllAsRead);

export { router as notificationRoutes };
