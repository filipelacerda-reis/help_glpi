import { api } from './api';

export interface BusinessCalendar {
  id: string;
  name: string;
  timezone: string;
  isDefault: boolean;
  schedule: any;
  createdAt: string;
  updatedAt: string;
}

export interface SlaPolicy {
  id: string;
  name: string;
  description?: string;
  appliesTo: {
    teamId?: string;
    categoryId?: string;
    priority?: string;
    ticketType?: string;
    requesterTeamId?: string;
  };
  targetFirstResponseBusinessMinutes?: number;
  targetResolutionBusinessMinutes: number;
  calendarId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  calendar?: BusinessCalendar;
}

export const slaService = {
  async getAllCalendars(): Promise<BusinessCalendar[]> {
    const response = await api.get<BusinessCalendar[]>('/sla/calendars');
    return response.data;
  },

  async getCalendarById(id: string): Promise<BusinessCalendar> {
    const response = await api.get<BusinessCalendar>(`/sla/calendars/${id}`);
    return response.data;
  },

  async createCalendar(data: {
    name: string;
    timezone?: string;
    schedule: any;
    isDefault?: boolean;
  }): Promise<BusinessCalendar> {
    const response = await api.post<BusinessCalendar>('/sla/calendars', data);
    return response.data;
  },

  async updateCalendar(id: string, data: Partial<BusinessCalendar>): Promise<BusinessCalendar> {
    const response = await api.put<BusinessCalendar>(`/sla/calendars/${id}`, data);
    return response.data;
  },

  async getAllPolicies(activeOnly?: boolean): Promise<SlaPolicy[]> {
    const params = activeOnly ? '?activeOnly=true' : '';
    const response = await api.get<SlaPolicy[]>(`/sla/policies${params}`);
    return response.data;
  },

  async getPolicyById(id: string): Promise<SlaPolicy> {
    const response = await api.get<SlaPolicy>(`/sla/policies/${id}`);
    return response.data;
  },

  async createPolicy(data: {
    name: string;
    description?: string;
    appliesTo: SlaPolicy['appliesTo'];
    targetFirstResponseBusinessMinutes?: number;
    targetResolutionBusinessMinutes: number;
    calendarId: string;
    active?: boolean;
  }): Promise<SlaPolicy> {
    const response = await api.post<SlaPolicy>('/sla/policies', data);
    return response.data;
  },

  async updatePolicy(id: string, data: Partial<SlaPolicy>): Promise<SlaPolicy> {
    const response = await api.put<SlaPolicy>(`/sla/policies/${id}`, data);
    return response.data;
  },

  async deletePolicy(id: string): Promise<void> {
    await api.delete(`/sla/policies/${id}`);
  },

  async deleteCalendar(id: string): Promise<void> {
    await api.delete(`/sla/calendars/${id}`);
  },
};
