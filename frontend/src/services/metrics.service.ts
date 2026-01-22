import { api } from './api';
import { MetricsFilters, MetricsResponse } from '../types/metrics.types';

export interface Metrics {
  ticketsByStatus: Array<{
    status: string;
    count: number;
  }>;
  ticketsByPriority: Array<{
    priority: string;
    count: number;
  }>;
  ticketsByTeam: Array<{
    teamId: string | null;
    teamName: string | null;
    count: number;
  }>;
  avgResolutionTimeByTeam: Array<{
    teamId: string;
    teamName: string;
    totalResolved: number;
    avgResolutionHours: number;
  }>;
}

export interface AdvancedMetrics {
  ticketsByType: Array<{ tipo: string; count: number }>;
  ticketsByCategory: Array<{ categoryId: string | null; count: number }>;
  topFeatureTags: Array<{ name: string; count: number }>;
  topInfraTags: Array<{ name: string; count: number }>;
  topRcTags: Array<{ name: string; count: number }>;
  topQuestionTags: Array<{ name: string; count: number }>;
  questionsByTag: Array<{ tag: string; count: number }>;
  questionsByTeam: Array<{ teamId: string; teamName: string; count: number }>;
  mttr: {
    general: number;
    byType: Record<string, number>;
    byTeam: Record<string, { teamName: string; avgHours: number; count: number }>;
    byFeature: Array<{ tag: string; avgHours: number; count: number }>;
    byInfra: Array<{ tag: string; avgHours: number; count: number }>;
    byRc: Array<{ tag: string; avgHours: number; count: number }>;
  };
  avgFirstResponse: {
    general: number;
    byTeam: Record<string, { teamName: string; avgHours: number; count: number }>;
    byType: Record<string, number>;
    byCategory: Record<string, { categoryName: string; avgHours: number; count: number }>;
  };
  ticketsByRequesterTeam: Array<{ teamId: string | null; teamName: string | null; count: number }>;
  interactionsByTeam: Array<{ teamId: string | null; teamName: string | null; count: number }>;
  interactionsByAuthor: Array<{ authorId: string; author: { id: string; name: string; email: string } | null; count: number }>;
}

export interface AdvancedMetricsFilters {
  from?: string;
  to?: string;
  tipo?: string;
  teamResponsavelId?: string;
  teamSolicitanteId?: string;
  categoryId?: string;
  featureTag?: string;
  infraTag?: string;
  rcTag?: string;
}

export const metricsService = {
  async getMetrics(params?: { teamId?: string }): Promise<Metrics> {
    const query = params?.teamId ? `?teamId=${params.teamId}` : '';
    const response = await api.get<Metrics>(`/admin/metrics${query}`);
    return response.data;
  },

  async getAdvancedMetrics(filters?: AdvancedMetricsFilters): Promise<AdvancedMetrics> {
    const params = new URLSearchParams();
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.tipo) params.append('tipo', filters.tipo);
    if (filters?.teamResponsavelId) params.append('teamResponsavelId', filters.teamResponsavelId);
    if (filters?.teamSolicitanteId) params.append('teamSolicitanteId', filters.teamSolicitanteId);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.featureTag) params.append('featureTag', filters.featureTag);
    if (filters?.infraTag) params.append('infraTag', filters.infraTag);
    if (filters?.rcTag) params.append('rcTag', filters.rcTag);

    const response = await api.get<AdvancedMetrics>(`/admin/metrics/tickets/summary?${params.toString()}`);
    return response.data;
  },

  async getExpandedMetrics(filters?: {
    from?: string;
    to?: string;
    teamId?: string;
    agentId?: string;
    categoryId?: string;
    priority?: string;
    status?: string;
    requesterTeamId?: string;
  }): Promise<ExpandedMetrics> {
    const params = new URLSearchParams();
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.teamId) params.append('teamId', filters.teamId);
    if (filters?.agentId) params.append('agentId', filters.agentId);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.requesterTeamId) params.append('requesterTeamId', filters.requesterTeamId);

    const response = await api.get<ExpandedMetrics>(`/admin/metrics/expanded?${params.toString()}`);
    return response.data;
  },

  /**
   * Nova API enterprise para métricas avançadas
   */
  async getEnterpriseMetrics(filters?: MetricsFilters): Promise<MetricsResponse> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.teamId) params.append('teamId', filters.teamId);
    if (filters?.technicianId) params.append('technicianId', filters.technicianId);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.tags) {
      filters.tags.forEach((tag) => params.append('tags', tag));
    }
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.status) {
      const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
      statusArray.forEach((status) => params.append('status', status));
    }
    if (filters?.slaStatus) params.append('slaStatus', filters.slaStatus);
    if (filters?.businessHours !== undefined) {
      params.append('businessHours', String(filters.businessHours));
    }
    if (filters?.comparePreviousPeriod !== undefined) {
      params.append('comparePreviousPeriod', String(filters.comparePreviousPeriod));
    }

    const response = await api.get<MetricsResponse>(`/admin/metrics/enterprise?${params.toString()}`);
    return response.data;
  },
};

export interface ExpandedMetrics {
  global: {
    totalTicketsCreated: number;
    totalTicketsResolved: number;
    backlogOpenTickets: number;
    slaComplianceRate: number;
    averageFirstResponseBusinessMinutes: number;
    averageResolutionBusinessMinutes: number;
    reopenRate: number;
    csatAverage: number;
  };
  byTeam: Array<{
    teamId: string;
    teamName: string;
    ticketsCreated: number;
    ticketsResolved: number;
    slaComplianceRate: number;
    averageResolutionBusinessMinutes: number;
    csatAverage: number;
  }>;
  byAgent: Array<{
    agentId: string;
    agentName: string;
    ticketsResolved: number;
    slaComplianceRate: number;
    averageResolutionBusinessMinutes: number;
    csatAverage: number;
  }>;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    ticketsCreated: number;
    ticketsResolved: number;
    averageResolutionBusinessMinutes: number;
  }>;
  timeSeries: Array<{
    date: string;
    ticketsCreated: number;
    ticketsResolved: number;
  }>;
  slaRiskBuckets: {
    onTrack: number;
    atRisk: number;
    breached: number;
  };
}

