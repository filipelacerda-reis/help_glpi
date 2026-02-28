import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

router.post('/slack/interactions', webhookController.slackInteractions);

export { router as webhookRoutes };

