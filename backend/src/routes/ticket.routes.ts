import { Router } from 'express';
import { ticketController } from '../controllers/ticket.controller';
import { attachmentController } from '../controllers/attachment.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { uploadMultiple } from '../utils/upload';

const router = Router();

// Permitir que todos os níveis de perfil possam criar tickets
router.post('/', authenticate, uploadMultiple, ticketController.createTicket);
router.get('/', authenticate, ticketController.getTickets);
router.get('/:id', authenticate, ticketController.getTicketById);
router.patch('/:id', authenticate, ticketController.updateTicket);
router.post('/:id/comments', authenticate, uploadMultiple, ticketController.addComment);
router.get('/:id/comments', authenticate, ticketController.getComments);

// Rotas de anexos
router.get('/:id/attachments', authenticate, attachmentController.getTicketAttachments);
router.delete('/attachments/:id', authenticate, attachmentController.deleteAttachment);

// Rotas de tags
router.post('/:id/tags', authenticate, ticketController.addTagsToTicket);
router.delete('/:id/tags/:tagId', authenticate, ticketController.removeTagFromTicket);

// Rotas de observadores
router.post('/:id/observers', authenticate, ticketController.addObserver);
router.delete('/:id/observers/:observerId', authenticate, ticketController.removeObserver);
router.get('/:id/observers', authenticate, ticketController.getObservers);

// Rotas de KB (importadas do kb.controller)
import { kbController } from '../controllers/kb.controller';
router.post('/:ticketId/kb-articles', authenticate, kbController.linkArticleToTicket);
router.get('/:ticketId/kb-articles', authenticate, kbController.getTicketArticles);

export { router as ticketRoutes };

