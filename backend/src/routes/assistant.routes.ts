import { Router } from 'express';
import {
  getOrCreateChatSession,
  handleUserChatMessage,
  createTicketFromSession,
} from '../services/assistant/chat.service';
import { AppError, ErrorType } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { platformPolicyService } from '../services/platformPolicy.service';

export const assistantRouter = Router();

// Todas as rotas requerem autenticação
assistantRouter.use(authenticate);

// POST /api/assistant/session
assistantRouter.post('/session', async (req, res, next) => {
  try {
    const { sessionId, externalId } = req.body as {
      sessionId?: string;
      externalId?: string;
    };

    // Pegar userId do middleware de autenticação
    const userId = req.userId;
    
    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    await platformPolicyService.enforceAssistantAccess(userId);

    const session = await getOrCreateChatSession({
      sessionId,
      userId,
      externalId,
    });

    return res.json({ sessionId: session.id });
  } catch (err) {
    next(err);
  }
});

// POST /api/assistant/message
assistantRouter.post('/message', async (req, res, next) => {
  try {
    const { sessionId, message } = req.body as {
      sessionId: string;
      message: string;
    };

    if (!sessionId || !message) {
      throw new AppError('sessionId and message are required', 400);
    }

    if (!req.userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    await platformPolicyService.enforceAssistantAccess(req.userId);

    const assistantMessage = await handleUserChatMessage(sessionId, message);

    return res.json({
      assistantMessage: {
        id: assistantMessage.id,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/assistant/escalate
assistantRouter.post('/escalate', async (req, res, next) => {
  try {
    const { sessionId } = req.body as { sessionId: string };

    if (!sessionId) {
      throw new AppError('sessionId is required', 400);
    }

    const ticket = await createTicketFromSession(sessionId);

    if (!ticket) {
      throw new AppError('Falha ao criar ticket a partir da sessão', 500, ErrorType.INTERNAL_ERROR);
    }

    return res.json({ ticketId: ticket.id });
  } catch (err) {
    next(err);
  }
});
