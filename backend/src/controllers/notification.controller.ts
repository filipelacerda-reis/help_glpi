import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';

export const notificationController = {
  async getNotifications(req: Request, res: Response) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await notificationService.getUserNotifications(req.userId, unreadOnly);
    res.json(notifications);
  },

  async getUnreadCount(req: Request, res: Response) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const count = await notificationService.getUnreadCount(req.userId);
    res.json({ count });
  },

  async markAsRead(req: Request, res: Response) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, req.userId);
    res.json(notification);
  },

  async markAllAsRead(req: Request, res: Response) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const result = await notificationService.markAllAsRead(req.userId);
    res.json(result);
  },
};

