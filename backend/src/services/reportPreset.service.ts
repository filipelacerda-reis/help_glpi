import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { MetricsFilters } from '../types/metrics.types';

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
   * Lista todos os presets do usuário
   */
  async getPresetsByUser(userId: string) {
    return prisma.reportPreset.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  },

  /**
   * Busca preset por ID (verificando se pertence ao usuário)
   */
  async getPresetById(id: string, userId: string) {
    const preset = await prisma.reportPreset.findFirst({
      where: { id, userId },
    });

    if (!preset) {
      throw new AppError('Preset não encontrado', 404);
    }

    return preset;
  },

  /**
   * Cria um novo preset
   */
  async createPreset(userId: string, data: CreateReportPresetDto) {
    const preset = await prisma.reportPreset.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        filters: data.filters as any,
      },
    });

    logger.info('Preset de relatório criado', { presetId: preset.id, userId });
    return preset;
  },

  /**
   * Atualiza um preset existente
   */
  async updatePreset(id: string, userId: string, data: UpdateReportPresetDto) {
    // Verificar se o preset existe e pertence ao usuário
    const existing = await this.getPresetById(id, userId);

    const preset = await prisma.reportPreset.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        filters: data.filters ? (data.filters as any) : undefined,
      },
    });

    logger.info('Preset de relatório atualizado', { presetId: id, userId });
    return preset;
  },

  /**
   * Remove um preset
   */
  async deletePreset(id: string, userId: string) {
    // Verificar se o preset existe e pertence ao usuário
    await this.getPresetById(id, userId);

    await prisma.reportPreset.delete({
      where: { id },
    });

    logger.info('Preset de relatório removido', { presetId: id, userId });
  },
};

