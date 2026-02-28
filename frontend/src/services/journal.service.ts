import { api } from './api';

export interface JournalEntry {
  id: string;
  technicianId: string;
  type: 'MANUAL' | 'AUTO_TICKET_WORKLOG' | 'AUTO_TICKET_STATUS' | 'AUTO_TICKET_COMMENT' | 'AUTO_OTHER';
  ticketId?: string | null;
  worklogId?: string | null;
  commentId?: string | null;
  title?: string | null;
  description: string;
  contentHtml?: string | null;
  editedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  source?: string | null;
  tags: Array<{
    id: string;
    name: string;
    group: string;
  }>;
  ticket?: {
    id: string;
    title: string;
    status: string;
  } | null;
  worklog?: {
    id: string;
    durationMinutes: number;
    description?: string | null;
  } | null;
  comment?: {
    id: string;
    content: string;
    createdAt: string;
  } | null;
  attachments?: Array<{
    id: string;
    fileName: string;
    filePath: string;
    fileSize?: number | null;
    mimeType?: string | null;
    url: string;
  }>;
}

export interface JournalEntryEditLog {
  id: string;
  entryId: string;
  editedById: string;
  editedByName: string;
  editedAt: string;
  previous: {
    title?: string | null;
    description: string;
    contentHtml?: string | null;
    tagIds: string[];
  };
  next: {
    title?: string | null;
    description: string;
    contentHtml?: string | null;
    tagIds: string[];
  };
  reason?: string | null;
}

export interface JournalSummary {
  daily: Array<{
    date: string;
    ticketsWorked: number;
    totalWorkMinutes?: number | null;
    entriesCount: number;
  }>;
  aggregates: {
    totalTicketsWorked: number;
    totalWorkMinutes: number;
    totalJournalEntries: number;
  };
}

export interface TechnicianMetrics {
  totalTicketsAssigned: number;
  totalTicketsResolved: number;
  mtta: number | null;
  mttr: number | null;
  slaCompliancePercent: number;
  reopenRatePercent: number;
}

export const journalService = {
  async getMyJournal(params: {
    from?: string;
    to?: string;
    ticketId?: string;
    types?: string[];
    searchText?: string;
    tagIds?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<{ entries: JournalEntry[]; pagination?: { page: number; pageSize: number; totalCount: number } }> {
    const response = await api.get('/me/journal', { params });
    return response.data;
  },

  async createMyManualEntry(
    payload: {
      title?: string;
      description: string;
      contentHtml?: string;
      tagIds?: string[];
    },
    files?: File[]
  ): Promise<JournalEntry> {
    const formData = new FormData();
    formData.append('title', payload.title || '');
    formData.append('description', payload.description);
    if (payload.contentHtml) {
      formData.append('contentHtml', payload.contentHtml);
    }
    if (payload.tagIds && payload.tagIds.length > 0) {
      formData.append('tagIds', JSON.stringify(payload.tagIds));
    }
    if (files) {
      files.forEach((file) => {
        formData.append('images', file);
      });
    }

    const response = await api.post('/me/journal/manual', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async updateMyManualEntry(
    id: string,
    payload: {
      title?: string;
      description: string;
      contentHtml?: string;
      tagIds?: string[];
      reason?: string;
    }
  ): Promise<JournalEntry> {
    const response = await api.patch(`/me/journal/${id}/manual`, payload);
    return response.data;
  },

  async getEntryEditLogs(id: string): Promise<JournalEntryEditLog[]> {
    const response = await api.get(`/me/journal/${id}/edit-logs`);
    return response.data;
  },

  async getMyJournalSummary(params: { from: string; to: string }): Promise<JournalSummary> {
    const response = await api.get('/me/journal/summary', { params });
    return response.data;
  },

  async getMyMetrics(params: { from: string; to: string; businessHours?: boolean }): Promise<TechnicianMetrics> {
    const response = await api.get('/me/metrics', { params });
    return response.data;
  },
};
