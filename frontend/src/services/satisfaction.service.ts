import { api } from './api';

export interface Satisfaction {
  id: string;
  ticketId: string;
  score: number; // 1 a 5
  comment?: string;
  answeredAt: string;
  answeredBy?: string;
}

export const satisfactionService = {
  async createOrUpdateSatisfaction(
    ticketId: string,
    data: {
      score: number;
      comment?: string;
    }
  ): Promise<Satisfaction> {
    const response = await api.post<Satisfaction>(`/tickets/${ticketId}/satisfaction`, data);
    return response.data;
  },

  async getTicketSatisfaction(ticketId: string): Promise<Satisfaction | null> {
    try {
      const response = await api.get<Satisfaction>(`/tickets/${ticketId}/satisfaction`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },
};

