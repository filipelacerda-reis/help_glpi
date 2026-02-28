import { api } from './api';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tipo: 'INCIDENT' | 'SERVICE_REQUEST' | 'PROBLEM' | 'CHANGE' | 'TASK' | 'QUESTION';
  infraTipo?: 'LOCAL' | 'NUVEM' | 'HIBRIDA' | 'ESTACAO_TRABALHO' | 'REDE_LOCAL' | 'SERVIDOR_FISICO' | null;
  teamId?: string | null;
  teamSolicitanteId?: string | null;
  requesterId: string;
  assignedTechnicianId?: string | null;
  categoryId?: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  firstResponseBusinessMinutes?: number | null;
  resolutionBusinessMinutes?: number | null;
  closureBusinessMinutes?: number | null;
  // Gestão de Projetos
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  customFields?: Record<string, any> | null;
  relations?: Array<{
    ticketId: string;
    relatedTicketId: string;
    relationType: string;
    relatedTicket: Ticket;
  }>;
  relatedTickets?: Array<{
    ticketId: string;
    relatedTicketId: string;
    relationType: string;
    ticket: Ticket;
  }>;
  worklogs?: Array<{
    id: string;
    ticketId: string;
    userId: string;
    durationMinutes: number;
    description: string;
    createdAt: string;
  }>;
  requester: {
    id: string;
    name: string;
    email: string;
  };
  assignedTechnician?: {
    id: string;
    name: string;
    email: string;
  } | null;
  category?: {
    id: string;
    name: string;
  } | null;
  team?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  teamSolicitante?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  comments?: TicketComment[];
  statusHistory?: TicketStatusHistory[];
  attachments?: TicketAttachment[];
  tags?: Array<{
    ticketId: string;
    tagId: string;
    tag: {
      id: string;
      name: string;
      group: string;
      isActive: boolean;
    };
  }>;
  observers?: Array<{
    ticketId: string;
    observerId: string;
    addedById: string;
    createdAt: string;
    observer: {
      id: string;
      name: string;
      email: string;
    };
    addedBy?: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  fileName: string;
  filePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt: string;
  url?: string;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  type: 'PUBLIC' | 'INTERNAL';
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  attachments?: TicketAttachment[];
}

export interface TicketStatusHistory {
  id: string;
  ticketId: string;
  oldStatus: string | null;
  newStatus: string;
  changedById: string;
  changedAt: string;
  changedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateTicketDto {
  title: string;
  description: string;
  categoryId?: string;
  teamId: string; // Agora obrigatório
  priority?: string;
  tipo?: 'INCIDENT' | 'SERVICE_REQUEST' | 'PROBLEM' | 'CHANGE' | 'TASK' | 'QUESTION';
  infraTipo?: 'LOCAL' | 'NUVEM' | 'HIBRIDA' | 'ESTACAO_TRABALHO' | 'REDE_LOCAL' | 'SERVIDOR_FISICO';
  teamSolicitanteId?: string;
  tagIds?: string[];
}

export interface UpdateTicketDto {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignedTechnicianId?: string | null;
  categoryId?: string | null;
  teamId?: string | null;
  tipo?: 'INCIDENT' | 'SERVICE_REQUEST' | 'PROBLEM' | 'CHANGE' | 'TASK' | 'QUESTION';
  infraTipo?: 'LOCAL' | 'NUVEM' | 'HIBRIDA' | 'ESTACAO_TRABALHO' | 'REDE_LOCAL' | 'SERVIDOR_FISICO';
  tagIds?: string[];
}

export interface CreateCommentDto {
  content: string;
  type: 'PUBLIC' | 'INTERNAL';
}

export const ticketService = {
  async createTicket(data: CreateTicketDto): Promise<Ticket> {
    const response = await api.post<Ticket>('/tickets', data);
    return response.data;
  },

  async createTicketWithImages(formData: FormData): Promise<Ticket> {
    const response = await api.post<Ticket>('/tickets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getTickets(filters?: {
    status?: string;
    priority?: string;
    categoryId?: string;
    assignedTechnicianId?: string;
    requesterId?: string;
    teamId?: string;
    tipo?: string;
    teamSolicitanteId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Ticket[]> {
    const response = await api.get<Ticket[]>('/tickets', { params: filters });
    return response.data;
  },

  async getStaleTickets(params?: { daysThreshold?: number; take?: number }): Promise<Ticket[]> {
    const response = await api.get<Ticket[]>('/tickets/stale', { params });
    return response.data;
  },

  async addTagsToTicket(ticketId: string, tagIds: string[]): Promise<void> {
    await api.post(`/tickets/${ticketId}/tags`, { tagIds });
  },

  async removeTagFromTicket(ticketId: string, tagId: string): Promise<void> {
    await api.delete(`/tickets/${ticketId}/tags/${tagId}`);
  },

  async getTicketById(id: string): Promise<Ticket> {
    const response = await api.get<Ticket>(`/tickets/${id}`);
    return response.data;
  },

  async updateTicket(id: string, data: UpdateTicketDto): Promise<Ticket> {
    const response = await api.patch<Ticket>(`/tickets/${id}`, data);
    return response.data;
  },

  async addComment(ticketId: string, data: CreateCommentDto): Promise<TicketComment> {
    const response = await api.post<TicketComment>(`/tickets/${ticketId}/comments`, data);
    return response.data;
  },

  async addCommentWithImages(ticketId: string, formData: FormData): Promise<TicketComment> {
    const response = await api.post<TicketComment>(`/tickets/${ticketId}/comments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getComments(ticketId: string): Promise<TicketComment[]> {
    const response = await api.get<TicketComment[]>(`/tickets/${ticketId}/comments`);
    return response.data;
  },

  async addObserver(ticketId: string, observerId: string): Promise<any> {
    const response = await api.post(`/tickets/${ticketId}/observers`, { observerId });
    return response.data;
  },

  async removeObserver(ticketId: string, observerId: string): Promise<void> {
    await api.delete(`/tickets/${ticketId}/observers/${observerId}`);
  },

  async getObservers(ticketId: string): Promise<any[]> {
    const response = await api.get(`/tickets/${ticketId}/observers`);
    return response.data;
  },
};
