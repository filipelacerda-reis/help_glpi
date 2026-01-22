import { Request, Response } from 'express';
import { reportPresetService } from '../services/reportPreset.service';
import { logger } from '../utils/logger';

export const reportPresetController = {
  /**
   * Lista presets do usuário atual
   */
  async getPresets(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const presets = await reportPresetService.getPresetsByUser(req.userId);
      return res.json(presets);
    } catch (error: any) {
      logger.error('Erro ao listar presets', { error: error.message });
      return res.status(500).json({ error: 'Erro ao listar presets' });
    }
  },

  /**
   * Cria um novo preset
   */
  async createPreset(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { name, description, filters } = req.body;

      if (!name || !filters) {
        return res.status(400).json({ error: 'Nome e filtros são obrigatórios' });
      }

      const preset = await reportPresetService.createPreset(req.userId, {
        name,
        description,
        filters,
      });

      return res.status(201).json(preset);
    } catch (error: any) {
      logger.error('Erro ao criar preset', { error: error.message });
      return res.status(500).json({ error: 'Erro ao criar preset' });
    }
  },

  /**
   * Atualiza um preset existente
   */
  async updatePreset(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { id } = req.params;
      const { name, description, filters } = req.body;

      const preset = await reportPresetService.updatePreset(id, req.userId, {
        name,
        description,
        filters,
      });

      return res.json(preset);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Erro ao atualizar preset', { error: error.message });
      return res.status(500).json({ error: 'Erro ao atualizar preset' });
    }
  },

  /**
   * Remove um preset
   */
  async deletePreset(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { id } = req.params;
      await reportPresetService.deletePreset(id, req.userId);

      return res.status(204).send();
    } catch (error: any) {
      if (error.statusCode === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Erro ao remover preset', { error: error.message });
      return res.status(500).json({ error: 'Erro ao remover preset' });
    }
  },
};

