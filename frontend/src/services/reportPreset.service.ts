import { api } from './api';
import { ReportPreset, MetricsFilters } from '../types/metrics.types';

export interface CreateReportPresetDto {
  name: string;
  description?: string;
  filters: MetricsFilters;
}

export interface UpdateReportPresetDto {
  name?: string;
  description?: string;
  filters?: MetricsFilters;
}

export const reportPresetService = {
  /**
   * Lista todos os presets do usuário atual
   */
  async getPresets(): Promise<ReportPreset[]> {
    const response = await api.get<ReportPreset[]>('/report-presets');
    return response.data;
  },

  /**
   * Cria um novo preset
   */
  async createPreset(data: CreateReportPresetDto): Promise<ReportPreset> {
    const response = await api.post<ReportPreset>('/report-presets', data);
    return response.data;
  },

  /**
   * Atualiza um preset existente
   */
  async updatePreset(id: string, data: UpdateReportPresetDto): Promise<ReportPreset> {
    const response = await api.put<ReportPreset>(`/report-presets/${id}`, data);
    return response.data;
  },

  /**
   * Remove um preset
   */
  async deletePreset(id: string): Promise<void> {
    await api.delete(`/report-presets/${id}`);
  },
};

