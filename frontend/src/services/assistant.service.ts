import { api } from './api';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export async function createAssistantSession(sessionId?: string) {
  const res = await api.post('/assistant/session', { sessionId });
  return res.data as { sessionId: string };
}

export async function sendAssistantMessage(sessionId: string, message: string) {
  const res = await api.post('/assistant/message', { sessionId, message });
  return res.data as {
    assistantMessage: {
      id: string;
      content: string;
      createdAt: string;
    };
  };
}

export async function escalateChatToTicket(sessionId: string) {
  const res = await api.post('/assistant/escalate', { sessionId });
  return res.data as { ticketId: string };
}

