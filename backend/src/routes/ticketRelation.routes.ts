import { Router } from 'express';
import { ticketRelationController } from '../controllers/ticketRelation.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/:ticketId/relations', authenticate, ticketRelationController.createRelation);
router.get('/:ticketId/relations', authenticate, ticketRelationController.getTicketRelations);
router.delete('/:ticketId/relations/:relatedTicketId', authenticate, ticketRelationController.removeRelation);

export { router as ticketRelationRoutes };

