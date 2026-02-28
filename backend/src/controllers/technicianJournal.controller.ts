import { Request, Response } from 'express';
import { technicianJournalService } from '../services/technicianJournal.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { TechnicianJournalEntryType } from '@prisma/client';

const createManualEntrySchema = z.object({
  title: z.string().optional(),
  description: z.string().min(1, 'Descrição é obrigatória'),
  contentHtml: z.string().optional(), // Conteúdo rico em HTML
  tagIds: z.array(z.string()).optional(), // IDs das tags da plataforma
});

const updateManualEntrySchema = z.object({
  title: z.string().optional(),
  description: z.string().min(1, 'Descrição é obrigatória'),
  contentHtml: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  reason: z.string().max(300).optional(),
});

export const technicianJournalController = {
  /**
   * GET /api/me/journal
   * Lista entradas do diário do técnico autenticado
   */
  async getMyJournal(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const filters: any = {};
      
      if (req.query.from) {
        filters.from = new Date(req.query.from as string);
      }
      if (req.query.to) {
        filters.to = new Date(req.query.to as string);
      }
      if (req.query.ticketId) {
        filters.ticketId = req.query.ticketId as string;
      }
      if (req.query.types) {
        const types = Array.isArray(req.query.types) 
          ? req.query.types 
          : [req.query.types];
        filters.types = types.map((t) => t as TechnicianJournalEntryType);
      }
      if (req.query.searchText) {
        filters.searchText = req.query.searchText as string;
      }
      if (req.query.tagIds) {
        const tagIds = Array.isArray(req.query.tagIds)
          ? req.query.tagIds
          : [req.query.tagIds];
        filters.tagIds = tagIds.map((id) => id as string);
      }
      if (req.query.page) {
        filters.page = parseInt(req.query.page as string, 10);
      }
      if (req.query.pageSize) {
        filters.pageSize = parseInt(req.query.pageSize as string, 10);
      }

      const result = await technicianJournalService.getJournalEntriesForTechnician(
        req.userId,
        filters
      );

      res.json(result);
    } catch (error: any) {
      logger.error('Erro ao buscar diário do técnico', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar diário' });
    }
  },

  /**
   * POST /api/me/journal/manual
   * Cria uma entrada manual no diário
   */
  async createManualEntry(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      // Parse FormData ou JSON
      let bodyData: any = req.body;
      
      // Se for FormData, converter tagIds de string para array
      if (req.body.tagIds && typeof req.body.tagIds === 'string') {
        try {
          bodyData.tagIds = JSON.parse(req.body.tagIds);
        } catch {
          bodyData.tagIds = [req.body.tagIds];
        }
      }

      const data = createManualEntrySchema.parse(bodyData);

      // Processar anexos se houver
      let attachments: Array<{
        fileName: string;
        filePath: string;
        fileSize?: number;
        mimeType?: string;
      }> | undefined;

      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        attachments = req.files.map((file: Express.Multer.File) => ({
          fileName: file.originalname,
          filePath: file.filename,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));
      }

      const entry = await technicianJournalService.createManualEntry(
        req.userId,
        data,
        attachments
      );

      // Adicionar URLs aos anexos
      const entryWithUrls = {
        ...entry,
        attachments: entry.attachments?.map((att) => ({
          ...att,
          url: `/uploads/journal/${att.filePath}`,
        })),
      };

      res.status(201).json(entryWithUrls);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else {
        logger.error('Erro ao criar entrada manual no diário', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar entrada no diário' });
      }
    }
  },

  /**
   * PATCH /api/me/journal/:id/manual
   * Edita uma entrada manual do diário
   */
  async updateMyManualEntry(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const { id } = req.params;
      const body = updateManualEntrySchema.parse(req.body);
      const entry = await technicianJournalService.updateManualEntry(req.userId, id, body);

      res.json(entry);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      logger.error('Erro ao editar entrada manual no diário', { error: error.message });
      res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao editar entrada no diário' });
    }
  },

  /**
   * GET /api/me/journal/:id/edit-logs
   * Histórico de edições da entrada
   */
  async getEntryEditLogs(req: Request, res: Response) {
    try {
      if (!req.userId || !req.userRole) {
        return res.status(401).json({ error: 'Não autenticado' });
      }
      const { id } = req.params;
      const logs = await technicianJournalService.getEntryEditLogs(id, req.userId, req.userRole);
      res.json(logs);
    } catch (error: any) {
      logger.error('Erro ao buscar histórico de edição do diário', { error: error.message });
      res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao buscar histórico de edição' });
    }
  },

  /**
   * GET /api/me/journal/summary
   * Busca resumo diário do técnico
   */
  async getMyJournalSummary(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const from = req.query.from as string;
      const to = req.query.to as string;

      if (!from || !to) {
        return res.status(400).json({ error: 'Parâmetros from e to são obrigatórios' });
      }

      const summary = await technicianJournalService.getDailySummaryForTechnician(
        req.userId,
        new Date(from),
        new Date(to)
      );

      res.json(summary);
    } catch (error: any) {
      logger.error('Erro ao buscar resumo do diário', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar resumo do diário' });
    }
  },
};
