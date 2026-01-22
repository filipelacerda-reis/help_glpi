import { api } from './api';

export interface TicketEvent {
  id: string;
  ticketId: string;
  eventType: string;
  actorUserId?: string;
  origin: string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TicketEventsResponse {
  events: TicketEvent[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const ticketEventService = {
  async getTicketEvents(
    ticketId: string,
    options?: {
      page?: number;
      pageSize?: number;
      eventType?: string;
    }
  ): Promise<TicketEventsResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', String(options.page));
    if (options?.pageSize) params.append('pageSize', String(options.pageSize));
    if (options?.eventType) params.append('eventType', options.eventType);

    const response = await api.get<TicketEventsResponse>(
      `/tickets/${ticketId}/events?${params.toString()}`
    );
    return response.data;
  },
};

