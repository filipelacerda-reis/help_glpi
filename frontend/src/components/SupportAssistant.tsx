import React, { useEffect, useState } from 'react';
import {
  createAssistantSession,
  sendAssistantMessage,
  escalateChatToTicket,
} from '../services/assistant.service';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export const SupportAssistant: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // cria sessão ao montar
    (async () => {
      try {
        setInitializing(true);
        setSessionError(null);
        console.log('[SupportAssistant] Criando sessão...');
        const { sessionId } = await createAssistantSession();
        console.log('[SupportAssistant] Sessão criada:', sessionId);
        setSessionId(sessionId);
      } catch (error: any) {
        console.error('[SupportAssistant] Erro ao criar sessão do assistente:', error);
        console.error('[SupportAssistant] Detalhes do erro:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
        setSessionError(
          error.response?.data?.error || 
          error.message ||
          'Erro ao inicializar assistente. Tente recarregar a página.'
        );
        // Mesmo com erro, permitir digitar (modo degradado)
        setSessionId('error-mode');
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    // Se não tiver sessão válida, tentar criar uma
    let currentSessionId = sessionId;
    if (!currentSessionId || currentSessionId === 'error-mode') {
      try {
        const { sessionId: newSessionId } = await createAssistantSession();
        currentSessionId = newSessionId;
        setSessionId(newSessionId);
        setSessionError(null);
      } catch (error: any) {
        console.error('[SupportAssistant] Erro ao criar sessão ao enviar:', error);
        setSessionError('Erro ao conectar com o assistente. Tente novamente.');
        return;
      }
    }
    const userMessage: UiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    try {
      const { assistantMessage } = await sendAssistantMessage(
        currentSessionId,
        userMessage.content,
      );
      const assistantUi: UiMessage = {
        id: assistantMessage.id,
        role: 'assistant',
        content: assistantMessage.content,
      };
      setMessages((prev) => [...prev, assistantUi]);
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      
      // Mensagem de erro mais específica baseada no status code
      let errorContent = 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
      
      if (error.response?.status === 503) {
        const errorMessage = error.response?.data?.error || '';
        if (errorMessage.includes('quota') || errorMessage.includes('cota') || errorMessage.includes('limite')) {
          errorContent = 'A cota da API da OpenAI foi excedida. Por favor, verifique sua conta OpenAI ou entre em contato com o administrador do sistema.';
        } else if (errorMessage.includes('configurado') || errorMessage.includes('OPENAI_API_KEY')) {
          errorContent = 'O assistente virtual não está configurado corretamente. Entre em contato com o administrador.';
        } else {
          errorContent = errorMessage || errorContent;
        }
      }
      
      const errorMessage: UiMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorContent,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!sessionId) return;
    setCreatingTicket(true);
    try {
      const { ticketId } = await escalateChatToTicket(sessionId);
      setTicketId(ticketId);
      // opcional: redirecionar para página do ticket
    } catch (error) {
      console.error('Erro ao criar ticket:', error);
      alert('Erro ao criar ticket. Tente novamente.');
    } finally {
      setCreatingTicket(false);
    }
  };

  return (
    <div className="flex flex-col border rounded-md p-3 h-full bg-gray-900 border-gray-700">
      <div className="font-semibold mb-2 text-white">
        Assistente virtual – Precisa de ajuda antes de abrir um chamado?
      </div>
      <div className="flex-1 overflow-y-auto mb-2 space-y-2 text-sm min-h-[300px] max-h-[400px]">
        {initializing && (
          <div className="text-gray-400 text-center py-4">
            Inicializando assistente...
          </div>
        )}
        {sessionError && (
          <div className="text-red-400 text-center py-4 text-xs">
            {sessionError}
          </div>
        )}
        {!initializing && !sessionError && messages.length === 0 && (
          <div className="text-gray-400 text-center py-4">
            Olá! Como posso ajudá-lo hoje?
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === 'user' ? 'text-right' : 'text-left'
            }
          >
            <div
              className={
                'inline-block px-3 py-2 rounded-md max-w-[80%] ' +
                (m.role === 'user'
                  ? 'bg-gray-800 text-white border border-gray-600'
                  : 'bg-gray-700 text-gray-100 border border-gray-600')
              }
              style={m.role === 'user' ? { backgroundColor: '#1f2937', color: '#ffffff' } : undefined}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-left text-xs text-gray-400">
            Assistente digitando...
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 border rounded px-3 py-2 text-sm bg-gray-800 text-white border-gray-700 focus:outline-none focus:ring-2 focus:ring-etus-green disabled:opacity-50 disabled:cursor-not-allowed"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            initializing 
              ? "Inicializando..." 
              : !sessionId 
              ? "Aguardando sessão..." 
              : "Descreva sua dúvida ou problema..."
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && sessionId && !loading) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading || initializing}
          readOnly={loading || initializing}
        />
        <button
          className="px-4 py-2 rounded bg-etus-green text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-etus-green-dark transition-colors"
          onClick={handleSend}
          disabled={!input.trim() || loading || initializing}
        >
          Enviar
        </button>
      </div>
      <div className="mt-2 flex justify-between items-center">
        <button
          className="text-xs underline text-etus-green disabled:opacity-50 disabled:cursor-not-allowed hover:text-etus-green-dark"
          onClick={handleEscalate}
          disabled={creatingTicket || !sessionId}
        >
          Não resolveu? Abrir chamado com base nesta conversa
        </button>
        {ticketId && (
          <div className="text-xs text-green-400">
            Chamado criado: #{ticketId.substring(0, 8)}
          </div>
        )}
      </div>
    </div>
  );
};

