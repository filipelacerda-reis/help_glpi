import { Request, Response } from 'express';
import { kbService } from '../services/kb.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { KbArticleStatus } from '@prisma/client';

const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
});

const createArticleSchema = z.object({
  categoryId: z.string().uuid().optional(),
  title: z.string().min(1, 'Título é obrigatório'),
  content: z.string().min(1, 'Conteúdo é obrigatório'),
  status: z.nativeEnum(KbArticleStatus).optional(),
  tags: z.array(z.string()).optional(),
});

export const kbController = {
  // ============================================
  // CATEGORIES
  // ============================================

  /**
   * GET /api/kb/categories
   * Lista categorias de KB
   */
  async getAllCategories(_req: Request, res: Response) {
    try {
      const categories = await kbService.getAllCategories();
      res.json(categories);
    } catch (error: any) {
      logger.error('Erro ao buscar categorias de KB', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar categorias de KB' });
    }
  },

  /**
   * GET /api/kb/categories/:id
   * Busca categoria por ID
   */
  async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const category = await kbService.getCategoryById(id);
      res.json(category);
    } catch (error: any) {
      if (error.statusCode === 404) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('Erro ao buscar categoria de KB', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar categoria de KB' });
      }
    }
  },

  /**
   * POST /api/kb/categories
   * Cria categoria (apenas ADMIN/TRIAGER)
   */
  async createCategory(req: Request, res: Response) {
    try {
      const data = createCategorySchema.parse(req.body);
      const category = await kbService.createCategory(data);
      res.status(201).json(category);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao criar categoria de KB', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar categoria de KB' });
      }
    }
  },

  /**
   * PUT /api/kb/categories/:id
   * Atualiza categoria (apenas ADMIN/TRIAGER)
   */
  async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = createCategorySchema.partial().parse(req.body);
      const category = await kbService.updateCategory(id, data);
      res.json(category);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao atualizar categoria de KB', { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar categoria de KB' });
      }
    }
  },

  /**
   * DELETE /api/kb/categories/:id
   * Deleta categoria (apenas ADMIN)
   */
  async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await kbService.deleteCategory(id);
      res.status(204).send();
    } catch (error: any) {
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao deletar categoria de KB', { error: error.message });
        res.status(500).json({ error: 'Erro ao deletar categoria de KB' });
      }
    }
  },

  // ============================================
  // ARTICLES
  // ============================================

  /**
   * GET /api/kb/articles
   * Busca artigos
   */
  async searchArticles(req: Request, res: Response) {
    try {
      const filters = {
        query: req.query.query as string | undefined,
        categoryId: req.query.categoryId as string | undefined,
        status: req.query.status as KbArticleStatus | undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      };

      const articles = await kbService.searchArticles(filters);
      res.json(articles);
    } catch (error: any) {
      logger.error('Erro ao buscar artigos de KB', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar artigos de KB' });
    }
  },

  /**
   * GET /api/kb/articles/:id
   * Busca artigo por ID
   */
  async getArticleById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const article = await kbService.getArticleById(id);
      res.json(article);
    } catch (error: any) {
      if (error.statusCode === 404) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('Erro ao buscar artigo de KB', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar artigo de KB' });
      }
    }
  },

  /**
   * POST /api/kb/articles
   * Cria artigo (apenas ADMIN/TRIAGER)
   */
  async createArticle(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
      }
      const data = createArticleSchema.parse(req.body);
      const article = await kbService.createArticle(userId, data);
      res.status(201).json(article);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao criar artigo de KB', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar artigo de KB' });
      }
    }
  },

  /**
   * PUT /api/kb/articles/:id
   * Atualiza artigo (apenas ADMIN/TRIAGER)
   */
  async updateArticle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
      }
      const data = createArticleSchema.partial().parse(req.body);
      const article = await kbService.updateArticle(id, userId, data);
      res.json(article);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao atualizar artigo de KB', { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar artigo de KB' });
      }
    }
  },

  /**
   * DELETE /api/kb/articles/:id
   * Deleta artigo (apenas ADMIN)
   */
  async deleteArticle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await kbService.deleteArticle(id);
      res.status(204).send();
    } catch (error: any) {
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao deletar artigo de KB', { error: error.message });
        res.status(500).json({ error: 'Erro ao deletar artigo de KB' });
      }
    }
  },

  /**
   * POST /api/kb/suggestions
   * Sugere artigos baseado em título e descrição
   */
  async suggestArticles(req: Request, res: Response) {
    try {
      const data = z
        .object({
          title: z.string().min(1),
          description: z.string().min(1),
          categoryId: z.string().uuid().optional(),
        })
        .parse(req.body);

      const result = await kbService.suggestArticles(data);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else {
        logger.error('Erro ao sugerir artigos', { error: error.message });
        res.status(500).json({ error: 'Erro ao sugerir artigos' });
      }
    }
  },

  /**
   * POST /api/kb/ai-solution
   * Gera uma solução sugerida via IA (RAG)
   */
  async getAiSolution(req: Request, res: Response) {
    try {
      const data = z
        .object({
          title: z.string(),
          description: z.string(),
          categoryId: z.string().uuid().optional(),
        })
        .parse(req.body);

      // Apenas processar se tiver conteúdo suficiente
      if (data.title.length < 5 && data.description.length < 5) {
        return res.json({ hasAnswer: false });
      }

      const result = await kbService.generateAiSolution(data);
      res.json(result);
    } catch (error: any) {
      logger.error('Erro no controller de AI Solution', { error: error.message });
      res.json({ hasAnswer: false });
    }
  },

  /**
   * POST /api/tickets/:ticketId/kb-articles
   * Associa artigo a um ticket
   */
  async linkArticleToTicket(req: Request, res: Response) {
    try {
      const { ticketId } = req.params;
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
      }
      const data = z.object({ articleId: z.string().uuid() }).parse(req.body);

      await kbService.linkArticleToTicket(ticketId, data.articleId, userId);
      res.status(201).json({ message: 'Artigo associado ao ticket' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        logger.error('Erro ao associar artigo ao ticket', { error: error.message });
        res.status(500).json({ error: 'Erro ao associar artigo ao ticket' });
      }
    }
  },

  /**
   * GET /api/tickets/:ticketId/kb-articles
   * Lista artigos associados a um ticket
   */
  async getTicketArticles(req: Request, res: Response) {
    try {
      const { ticketId } = req.params;
      const articles = await kbService.getTicketArticles(ticketId);
      res.json(articles);
    } catch (error: any) {
      logger.error('Erro ao buscar artigos do ticket', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar artigos do ticket' });
    }
  },
};
