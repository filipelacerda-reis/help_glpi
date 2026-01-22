import { api } from './api';

export interface Worklog {
  id: string;
  ticketId: string;
  userId: string;
  durationMinutes: number;
  description?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export const worklogService = {
  async createWorklog(
    ticketId: string,
    data: {
      durationMinutes: number;
      description?: string;
    }
  ): Promise<Worklog> {
    const response = await api.post<Worklog>(`/tickets/${ticketId}/worklogs`, data);
    return response.data;
  },

  async getTicketWorklogs(ticketId: string): Promise<Worklog[]> {
    const response = await api.get<Worklog[]>(`/tickets/${ticketId}/worklogs`);
    return response.data;
  },
};

