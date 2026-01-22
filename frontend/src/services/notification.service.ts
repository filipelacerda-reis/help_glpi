import { api } from './api';

export interface Notification {
  id: string;
  userId: string;
  ticketId?: string | null;
  type: 'COMMENT' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'TEAM_CHANGE';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
  ticket?: {
    id: string;
    title: string;
  } | null;
}

export const notificationService = {
  async getNotifications(unreadOnly: boolean = false): Promise<Notification[]> {
    const response = await api.get<Notification[]>('/notifications', {
      params: { unreadOnly },
    });
    return response.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get<{ count: number }>('/notifications/unread-count');
    return response.data.count;
  },

  async markAsRead(notificationId: string): Promise<Notification> {
    const response = await api.patch<Notification>(`/notifications/${notificationId}/read`);
    return response.data;
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },
};

