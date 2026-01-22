import { Request, Response } from 'express';
import { categoryService } from '../services/category.service';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  parentCategoryId: z.string().uuid().optional(),
  active: z.boolean().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(2).optional(),
  parentCategoryId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

export const categoryController = {
  async getAllCategories(req: Request, res: Response) {
    const activeOnly = req.query.activeOnly !== 'false';
    const teamId = req.query.teamId as string | undefined;
    const categories = await categoryService.getAllCategories(activeOnly, teamId);
    res.json(categories);
  },

  async getCategoryById(req: Request, res: Response) {
    const { id } = req.params;
    const category = await categoryService.getCategoryById(id);
    res.json(category);
  },

  async createCategory(req: Request, res: Response) {
    const data = createCategorySchema.parse(req.body);
    const category = await categoryService.createCategory(data);
    res.status(201).json(category);
  },

  async updateCategory(req: Request, res: Response) {
    const { id } = req.params;
    const data = updateCategorySchema.parse(req.body);
    const category = await categoryService.updateCategory(id, data);
    res.json(category);
  },

  async deleteCategory(req: Request, res: Response) {
    const { id } = req.params;
    await categoryService.deleteCategory(id);
    res.status(204).send();
  },
};

