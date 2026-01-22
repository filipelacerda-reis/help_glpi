import { Request, Response, NextFunction } from 'express';
import { ticketService } from '../services/ticket.service';
import { tagService } from '../services/tag.service';
import { getFileUrl } from '../utils/upload';
import { processFormData, processAttachments } from '../utils/formData';
import { z } from 'zod';
import { TicketStatus, TicketPriority, TicketType, InfraType } from '@prisma/client';

// Schema que aceita tagIds como string JSON, array ou undefined
const tagIdsSchema = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return undefined;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return [];
  },
  z.array(z.string().uuid()).optional()
);

const createTicketSchema = z.object({
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  description: z.string().min(10, 'Descrição deve ter no mínimo 10 caracteres'),
  categoryId: z.string().uuid().optional(),
  teamId: z.string().uuid('ID de time inválido'), // Agora obrigatório
  priority: z.nativeEnum(TicketPriority).optional(),
  tipo: z.nativeEnum(TicketType).optional(),
  infraTipo: z.nativeEnum(InfraType).optional(),
  teamSolicitanteId: z.string().uuid().optional(),
  tagIds: tagIdsSchema,
  // Gestão de Projetos
  dueDate: z.preprocess(
    (val) => (val ? new Date(val as string) : undefined),
    z.date().optional()
  ),
  estimatedMinutes: z.preprocess(
    (val) => (val ? parseInt(String(val), 10) : undefined),
    z.number().int().positive().optional()
  ),
  customFields: z.record(z.any()).optional(),
  parentTicketId: z.string().uuid().optional(), // ID do ticket pai
});

const updateTicketSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedTechnicianId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  tipo: z.nativeEnum(TicketType).optional(),
  infraTipo: z.nativeEnum(InfraType).optional(),
  tagIds: tagIdsSchema,
  // Gestão de Projetos
  dueDate: z.preprocess(
    (val) => (val === null || val === '' ? null : val ? new Date(val as string) : undefined),
    z.date().nullable().optional()
  ),
  estimatedMinutes: z.preprocess(
    (val) => (val === null || val === '' ? null : val ? parseInt(String(val), 10) : undefined),
    z.number().int().positive().nullable().optional()
  ),
  customFields: z.record(z.any()).nullable().optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comentário não pode estar vazio'),
  type: z.enum(['PUBLIC', 'INTERNAL']),
});

export const ticketController = {
  async createTicket(req: Request, res: Response, next: NextFunction) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const bodyData = processFormData(req);
      const data = createTicketSchema.parse(bodyData);
      const attachments = processAttachments(req);

      const ticket = await ticketService.createTicket(req.userId, data, attachments);

      if (!ticket) {
        return res.status(500).json({ error: 'Erro ao criar ticket' });
      }

      // Adicionar URLs aos anexos se houver
      if ((ticket as any).attachments && (ticket as any).attachments.length > 0) {
        (ticket as any).attachments = (ticket as any).attachments.map((att: any) => ({
          ...att,
          url: getFileUrl(att.filePath),
        }));
      }

      res.status(201).json(ticket);
    } catch (error: any) {
      next(error);
    }
  },

  async getTickets(req: Request, res: Response, next: NextFunction) {
    if (!req.userId || !req.userRole) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const filters: any = {};
      if (req.query.status) {
        filters.status = req.query.status as TicketStatus;
      }
      if (req.query.priority) {
        filters.priority = req.query.priority as TicketPriority;
      }
      if (req.query.categoryId) {
        filters.categoryId = req.query.categoryId as string;
      }
      if (req.query.assignedTechnicianId) {
        filters.assignedTechnicianId = req.query.assignedTechnicianId as string;
      }
      if (req.query.requesterId) {
        filters.requesterId = req.query.requesterId as string;
      }
      if (req.query.teamId) {
        filters.teamId = req.query.teamId as string;
      }
      if (req.query.tipo) {
        filters.tipo = req.query.tipo as TicketType;
      }
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }

      const tickets = await ticketService.getTickets(req.userId, req.userRole, filters);
      res.json(tickets);
    } catch (error: any) {
      next(error);
    }
  },

  async getTicketById(req: Request, res: Response, next: NextFunction) {
    if (!req.userId || !req.userRole) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const { id } = req.params;
      const ticket = await ticketService.getTicketById(id, req.userId, req.userRole);
      res.json(ticket);
    } catch (error: any) {
      next(error);
    }
  },

  async updateTicket(req: Request, res: Response, next: NextFunction) {
    if (!req.userId || !req.userRole) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const { id } = req.params;
      const bodyData = processFormData(req);
      const data = updateTicketSchema.parse(bodyData);
      const ticket = await ticketService.updateTicket(id, req.userId, req.userRole, data);
      res.json(ticket);
    } catch (error: any) {
      next(error);
    }
  },

  async addComment(req: Request, res: Response, next: NextFunction) {
    if (!req.userId || !req.userRole) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const { id } = req.params;
      const data = createCommentSchema.parse(req.body);
      const attachments = processAttachments(req);

      const comment = await ticketService.addComment(id, req.userId, data, attachments);
      
      // Adicionar URLs aos anexos
      if (comment.attachments && comment.attachments.length > 0) {
        (comment as any).attachments = comment.attachments.map((att: any) => ({
          ...att,
          url: getFileUrl(att.filePath),
        }));
      }

      res.status(201).json(comment);
    } catch (error: any) {
      next(error);
    }
  },

  async getComments(req: Request, res: Response, next: NextFunction) {
    if (!req.userId || !req.userRole) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const { id } = req.params;
      const comments = await ticketService.getComments(id, req.userId, req.userRole);
      
      // Adicionar URLs aos anexos de cada comentário
      const commentsWithUrls = comments.map((comment: any) => ({
        ...comment,
        attachments: comment.attachments?.map((att: any) => ({
          ...att,
          url: getFileUrl(att.filePath),
        })) || [],
      }));
      
      res.json(commentsWithUrls);
    } catch (error: any) {
      next(error);
    }
  },

  async addTagsToTicket(req: Request, res: Response, next: NextFunction) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const { id: ticketId } = req.params;
      const addTagsSchema = z.object({
        tagIds: z.array(z.string().uuid()).min(1, 'tagIds deve ser um array não vazio'),
      });
      const { tagIds } = addTagsSchema.parse(req.body);

      const tags = await tagService.addTagsToTicket(ticketId, tagIds, req.userId);
      res.json(tags);
    } catch (error: any) {
      next(error);
    }
  },

  async removeTagFromTicket(req: Request, res: Response, next: NextFunction) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const { id: ticketId, tagId } = req.params;
      await tagService.removeTagFromTicket(ticketId, tagId, req.userId);
      res.status(204).send();
    } catch (error: any) {
      next(error);
    }
  },

  async addObserver(req: Request, res: Response, next: NextFunction) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const { id: ticketId } = req.params;
      const addObserverSchema = z.object({
        observerId: z.string().uuid('observerId é obrigatório e deve ser um UUID válido'),
      });
      const { observerId } = addObserverSchema.parse(req.body);

      const observer = await ticketService.addObserver(ticketId, observerId, req.userId);
      res.status(201).json(observer);
    } catch (error: any) {
      next(error);
    }
  },

  async removeObserver(req: Request, res: Response, next: NextFunction) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const { id: ticketId, observerId } = req.params;
      await ticketService.removeObserver(ticketId, observerId, req.userId);
      res.status(204).send();
    } catch (error: any) {
      next(error);
    }
  },

  async getObservers(req: Request, res: Response, next: NextFunction) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const { id: ticketId } = req.params;
      const observers = await ticketService.getObservers(ticketId);
      res.json(observers);
    } catch (error: any) {
      next(error);
    }
  },
};

