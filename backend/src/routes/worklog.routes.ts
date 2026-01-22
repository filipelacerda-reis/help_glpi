import { Router } from 'express';
import { worklogController } from '../controllers/worklog.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/:ticketId/worklogs', authenticate, worklogController.createWorklog);
router.get('/:ticketId/worklogs', authenticate, worklogController.getTicketWorklogs);

export { router as worklogRoutes };

