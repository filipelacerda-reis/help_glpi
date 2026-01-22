import { Router } from 'express';
import { satisfactionController } from '../controllers/satisfaction.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/:ticketId/satisfaction', authenticate, satisfactionController.createOrUpdateSatisfaction);
router.get('/:ticketId/satisfaction', authenticate, satisfactionController.getTicketSatisfaction);

export { router as satisfactionRoutes };

