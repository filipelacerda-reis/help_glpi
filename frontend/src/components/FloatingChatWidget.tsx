import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createAssistantSession,
  sendAssistantMessage,
} from '../services/assistant.service';
import { MessageSquare, X, Minimize2 } from 'lucide-react';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export const FloatingChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cria sessão ao montar
    (async () => {
      try {
        setInitializing(true);
        setSessionError(null);
        const { sessionId } = await createAssistantSession();
        setSessionId(sessionId);
        setMessages([
          {
            id: 'initial-assistant',
            role: 'assistant',
            content: 'Olá! Sou seu assistente virtual. Como posso ajudar hoje?',
          },
        ]);
      } catch (error: any) {
        console.error('Erro ao criar sessão do assistente:', error);
        setSessionError(
          error.response?.data?.error ||
          'Erro ao inicializar assistente. Tente recarregar a página.'
        );
        setSessionId('error-mode');
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    let currentSessionId = sessionId;
    if (!currentSessionId || currentSessionId === 'error-mode') {
      try {
        const { sessionId: newSessionId } = await createAssistantSession();
        currentSessionId = newSessionId;
        setSessionId(newSessionId);
        setSessionError(null);
      } catch (error: any) {
        console.error('[FloatingChatWidget] Erro ao criar sessão ao enviar:', error);
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

      let errorContent = 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';

      if (error.response?.status === 503) {
        const errorMessage = error.response?.data?.error || '';
        if (errorMessage.includes('quota') || errorMessage.includes('cota') || errorMessage.includes('limite')) {
          errorContent = 'A cota da API foi excedida. Por favor, verifique sua conta ou entre em contato com o administrador do sistema.';
        } else if (errorMessage.includes('inválida')) {
          errorContent = 'Chave de API inválida. Verifique a configuração ou entre em contato com o administrador.';
        } else if (errorMessage.includes('Ambos os provedores falharam')) {
          errorContent = 'Erro ao gerar resposta do assistente virtual. Ambos os provedores (OpenAI e Gemini) falharam.';
        }
      } else if (error.response?.status === 500) {
        errorContent = 'Erro interno do servidor ao processar a mensagem. Tente novamente mais tarde.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: errorContent,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = () => {
    if (!sessionId || messages.length === 0) return;
    
    // Gerar título a partir da primeira mensagem do usuário
    const firstUserMessage = messages.find(m => m.role === 'user');
    const title = firstUserMessage?.content.slice(0, 120) || 'Solicitação via assistente virtual';
    
    // Gerar descrição com todo o histórico do chat
    const description = messages
      .map((m) => {
        const prefix = m.role === 'user' ? '**Usuário:**' : m.role === 'assistant' ? '**Assistente:**' : '**Sistema:**';
        return `${prefix}\n\n${m.content}`;
      })
      .join('\n\n---\n\n');
    
    // Redirecionar para a tela de criação de tickets com dados pré-preenchidos
    navigate('/tickets/new', {
      state: {
        title,
        description,
        fromChat: true,
      },
    });
  };

  return (
    <>
      {/* Botão Flutuante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-etus-green hover:bg-etus-green-dark text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50"
          aria-label="Abrir assistente virtual"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Painel de Chat */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-50 transition-all ${
            isMinimized ? 'h-16' : 'h-[600px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700 rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-etus-green" />
              <div className="font-semibold text-white">Assistente Virtual</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700/30 rounded transition-colors"
                aria-label={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                <Minimize2 className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsMinimized(false);
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700/30 rounded transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Conteúdo do Chat */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {initializing && (
                  <div className="text-gray-400 text-center py-4 text-sm">
                    Inicializando assistente...
                  </div>
                )}
                {sessionError && (
                  <div className="text-red-400 text-center py-4 text-xs">
                    {sessionError}
                  </div>
                )}
                {!initializing && !sessionError && messages.length === 0 && (
                  <div className="text-gray-400 text-center py-4 text-sm">
                    Olá! Como posso ajudá-lo hoje?
                  </div>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`px-4 py-2 rounded-lg max-w-[80%] text-sm ${
                        m.role === 'user'
                          ? 'bg-gray-800 text-white border border-gray-600'
                          : 'bg-gray-700 text-gray-100 border border-gray-600'
                      }`}
                      style={m.role === 'user' ? { backgroundColor: '#1f2937', color: '#ffffff' } : undefined}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="px-4 py-2 rounded-lg bg-gray-700 text-gray-100 text-sm flex items-center">
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                      Assistente digitando...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border rounded px-3 py-2 text-sm bg-gray-700 text-white border-gray-600 focus:outline-none focus:ring-2 focus:ring-etus-green disabled:opacity-50 disabled:cursor-not-allowed"
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
                  />
                  <button
                    className="px-4 py-2 rounded-lg bg-etus-green text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={handleSend}
                    disabled={!input.trim() || loading || initializing}
                  >
                    Enviar
                  </button>
                </div>
                <div className="mt-3 flex justify-between items-center text-xs">
                  <button
                    className="text-etus-green hover:underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    onClick={handleEscalate}
                    disabled={!sessionId || messages.length === 0}
                  >
                    Não resolveu? Abrir chamado
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

