import { api } from './api';

export interface TicketRelation {
  ticketId: string;
  relatedTicketId: string;
  relationType: 'DUPLICATE_OF' | 'CHILD_OF' | 'PARENT_OF' | 'CAUSED_BY' | 'BLOCKED_BY';
  createdAt: string;
  relatedTicket?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
  };
  direction?: 'outgoing' | 'incoming';
}

export interface TicketRelationsResponse {
  outgoing: TicketRelation[];
  incoming: TicketRelation[];
}

export const ticketRelationService = {
  async createRelation(
    ticketId: string,
    data: {
      relatedTicketId: string;
      relationType: TicketRelation['relationType'];
    }
  ): Promise<TicketRelation> {
    const response = await api.post<TicketRelation>(`/tickets/${ticketId}/relations`, data);
    return response.data;
  },

  async getTicketRelations(ticketId: string): Promise<TicketRelationsResponse> {
    const response = await api.get<TicketRelationsResponse>(`/tickets/${ticketId}/relations`);
    return response.data;
  },

  async removeRelation(
    ticketId: string,
    relatedTicketId: string,
    relationType: TicketRelation['relationType']
  ): Promise<void> {
    await api.delete(`/tickets/${ticketId}/relations/${relatedTicketId}?type=${relationType}`);
  },
};

