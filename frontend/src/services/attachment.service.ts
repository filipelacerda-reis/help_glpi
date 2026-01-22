import { api } from './api';

export interface TicketAttachment {
  id: string;
  ticketId: string;
  fileName: string;
  filePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt: string;
  url: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export const attachmentService = {
  async getTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
    const response = await api.get<TicketAttachment[]>(`/tickets/${ticketId}/attachments`);
    return response.data;
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    await api.delete(`/tickets/attachments/${attachmentId}`);
  },
};

