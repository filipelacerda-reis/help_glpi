import { Router } from 'express';
import { ticketController } from '../controllers/ticket.controller';
import { attachmentController } from '../controllers/attachment.controller';
import { authenticate, requireModuleAccess } from '../middleware/auth';
import { uploadMultiple } from '../utils/upload';

const router = Router();

// Permitir que todos os níveis de perfil possam criar tickets
router.post('/', authenticate, requireModuleAccess('TICKETS'), uploadMultiple, ticketController.createTicket);
router.get('/', authenticate, requireModuleAccess('TICKETS'), ticketController.getTickets);
router.get('/:id', authenticate, requireModuleAccess('TICKETS'), ticketController.getTicketById);
router.patch('/:id', authenticate, requireModuleAccess('TICKETS'), ticketController.updateTicket);
router.post('/:id/comments', authenticate, requireModuleAccess('TICKETS'), uploadMultiple, ticketController.addComment);
router.get('/:id/comments', authenticate, requireModuleAccess('TICKETS'), ticketController.getComments);

// Rotas de anexos
router.get('/:id/attachments', authenticate, requireModuleAccess('TICKETS'), attachmentController.getTicketAttachments);
router.delete('/attachments/:id', authenticate, requireModuleAccess('TICKETS'), attachmentController.deleteAttachment);

// Rotas de tags
router.post('/:id/tags', authenticate, requireModuleAccess('TICKETS'), ticketController.addTagsToTicket);
router.delete('/:id/tags/:tagId', authenticate, requireModuleAccess('TICKETS'), ticketController.removeTagFromTicket);

// Rotas de observadores
router.post('/:id/observers', authenticate, requireModuleAccess('TICKETS'), ticketController.addObserver);
router.delete('/:id/observers/:observerId', authenticate, requireModuleAccess('TICKETS'), ticketController.removeObserver);
router.get('/:id/observers', authenticate, requireModuleAccess('TICKETS'), ticketController.getObservers);

// Rotas de KB (importadas do kb.controller)
import { kbController } from '../controllers/kb.controller';
router.post('/:ticketId/kb-articles', authenticate, requireModuleAccess('TICKETS'), kbController.linkArticleToTicket);
router.get('/:ticketId/kb-articles', authenticate, requireModuleAccess('TICKETS'), kbController.getTicketArticles);

export { router as ticketRoutes };
