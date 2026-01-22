import { Request, Response } from 'express';
import { tagService } from '../services/tag.service';
import { TagGroup } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger';

const createTagSchema = z.object({
  name: z.string().min(1, 'Nome da tag é obrigatório'),
  group: z.nativeEnum(TagGroup),
  isActive: z.boolean().optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  group: z.nativeEnum(TagGroup).optional(),
  isActive: z.boolean().optional(),
});

export const tagController = {
  async getAllTags(req: Request, res: Response) {
    try {
      const filters: any = {};

      if (req.query.group) {
        filters.group = req.query.group as TagGroup;
      }

      if (req.query.search) {
        filters.search = req.query.search as string;
      }

      if (req.query.isActive !== undefined) {
        filters.isActive = req.query.isActive === 'true';
      }

      const tags = await tagService.getAllTags(filters);
      res.json(tags);
    } catch (error: any) {
      logger.error('Erro ao buscar tags', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar tags' });
    }
  },

  async getTagById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tag = await tagService.getTagById(id);
      res.json(tag);
    } catch (error: any) {
      if (error.statusCode === 404) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('Erro ao buscar tag', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar tag' });
      }
    }
  },

  async createTag(req: Request, res: Response) {
    try {
      const data = createTagSchema.parse(req.body);
      const tag = await tagService.createTag(data);
      res.status(201).json(tag);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode === 400) {
        res.status(400).json({ error: error.message });
      } else {
        logger.error('Erro ao criar tag', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar tag' });
      }
    }
  },

  async updateTag(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = updateTagSchema.parse(req.body);
      const tag = await tagService.updateTag(id, data);
      res.json(tag);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode === 404 || error.statusCode === 400) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao atualizar tag', { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar tag' });
      }
    }
  },

  async deleteTag(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await tagService.deleteTag(id);
      res.status(204).send();
    } catch (error: any) {
      if (error.statusCode === 404) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('Erro ao deletar tag', { error: error.message });
        res.status(500).json({ error: 'Erro ao deletar tag' });
      }
    }
  },
};

