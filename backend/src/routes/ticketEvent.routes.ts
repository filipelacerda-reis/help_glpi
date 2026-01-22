import { Router } from 'express';
import { ticketEventController } from '../controllers/ticketEvent.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/:ticketId/events', authenticate, ticketEventController.getTicketEvents);

export { router as ticketEventRoutes };

