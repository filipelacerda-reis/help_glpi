import { openaiClient } from '../../lib/openaiClient';
import { geminiClient } from '../../lib/geminiClient';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const SUPPORT_SYSTEM_PROMPT = `
Você é um assistente virtual de suporte técnico, prestativo e objetivo.

DIRETRIZES:
- Responda de forma clara, objetiva e útil, focando em resolver o problema do usuário.
- Analise a pergunta cuidadosamente antes de responder.
- Se o problema for técnico (erros de site, problemas de conexão, etc.), ofereça soluções práticas e passos para diagnóstico.
- Se não souber algo com certeza, seja honesto e sugira onde o usuário pode encontrar ajuda.
- Evite mencionar especificamente "ETUS/GLPI" a menos que seja relevante para a pergunta.
- NÃO invente informações ou faça suposições sem base.
- Se a questão for complexa ou requerer acesso interno que você não tem, sugira que o usuário abra um chamado para suporte especializado.

OBJETIVO: Ajudar o usuário a resolver seu problema da melhor forma possível, seja ele relacionado à plataforma ou não.
`;

/**
 * Tenta gerar resposta usando OpenAI GPT
 */
async function generateWithOpenAI(messages: LlmMessage[]): Promise<string> {
  if (!openaiClient) {
    throw new Error('OpenAI client não disponível');
  }

  // Lista de modelos OpenAI para tentar em ordem
  const openaiModels = ['gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4-turbo-preview'];
  
  let lastError: any = null;
  
  for (const modelName of openaiModels) {
    try {
      logger.debug(`Tentando usar modelo OpenAI: ${modelName}`);
      const completion = await openaiClient.chat.completions.create({
        model: modelName,
        temperature: 0.3,
        messages,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        logger.info(`✅ Resposta recebida do OpenAI com sucesso usando ${modelName}`, { textLength: content.length });
        return content;
      }
      
      throw new Error('OpenAI retornou resposta vazia');
    } catch (error: any) {
      const errorStatus = error?.status || error?.response?.status;
      const errorCode = error?.code || error?.response?.data?.error?.code;
      const errorMessage = error?.message || String(error);
      
      logger.warn(`Erro ao usar OpenAI com modelo ${modelName}`, {
        status: errorStatus,
        code: errorCode,
        message: errorMessage.substring(0, 500),
      });
      
      lastError = error;
      
      // Se for erro recuperável (403, 404), tentar próximo modelo
      const isRecoverableError = 
        errorStatus === 403 || 
        errorStatus === 404 ||
        errorCode === 'model_not_found' ||
        errorMessage.includes('does not have access') ||
        errorMessage.includes('not found');
      
      if (isRecoverableError && openaiModels.indexOf(modelName) < openaiModels.length - 1) {
        logger.debug(`Modelo ${modelName} não disponível, tentando próximo modelo...`);
        continue; // Tentar próximo modelo
      }
      
      // Se não for recuperável ou for o último modelo, lançar erro
      throw error;
    }
  }
  
  // Se chegou aqui, todos os modelos falharam
  throw lastError || new Error('Todos os modelos OpenAI falharam');
}

/**
 * Tenta gerar resposta usando Google Gemini (fallback)
 */
async function generateWithGemini(messages: LlmMessage[]): Promise<string> {
  if (!geminiClient) {
    throw new Error('Gemini client não disponível');
  }

  // Construir prompt combinando system prompt e histórico
  const systemPrompt = messages.find(m => m.role === 'system')?.content || SUPPORT_SYSTEM_PROMPT;
  
  // Pegar apenas as últimas mensagens para não exceder limite de tokens
  const recentMessages = messages.slice(-10); // últimas 10 mensagens
  const conversationHistory = recentMessages
    .filter(m => m.role !== 'system')
    .map(m => {
      if (m.role === 'user') {
        return `Usuário: ${m.content}`;
      } else {
        return `Assistente: ${m.content}`;
      }
    })
    .join('\n');

  const prompt = `${systemPrompt}\n\n${conversationHistory}\n\nAssistente:`;

  // Lista de modelos Gemini para tentar em ordem (gemini-2.5-flash como prioridade)
  const geminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  
  let lastError: any = null;
  
  for (const modelName of geminiModels) {
    try {
      logger.debug(`Tentando usar modelo Gemini: ${modelName}`);
      const model = geminiClient.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature: 0.3,
        },
      });
      
      logger.debug('Enviando requisição para Gemini', { 
        promptLength: prompt.length,
        messageCount: recentMessages.length,
        model: modelName,
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      logger.info(`✅ Resposta recebida do Gemini com sucesso usando ${modelName}`, { textLength: text?.length || 0 });
      
      if (!text || text.trim().length === 0) {
        throw new Error('Gemini retornou resposta vazia');
      }
      
      return text.trim();
    } catch (error: any) {
      const errorStatus = error?.status || error?.statusCode;
      const errorCode = error?.code;
      const errorMessage = error?.message || String(error);
      const fullError = JSON.stringify(error, Object.getOwnPropertyNames(error));
      
      logger.warn(`Erro ao usar Gemini com modelo ${modelName}`, {
        status: errorStatus,
        code: errorCode,
        message: errorMessage.substring(0, 500),
        fullError: fullError.substring(0, 1000),
      });
      
      lastError = error;
      
      // Se for erro recuperável (404, 503, 429), tentar próximo modelo
      const isRecoverableError = 
        errorStatus === 404 || 
        errorStatus === 503 || 
        errorStatus === 429 ||
        errorCode === 'NOT_FOUND' ||
        errorMessage.includes('not found') ||
        errorMessage.includes('model not found');
      
      if (isRecoverableError && geminiModels.indexOf(modelName) < geminiModels.length - 1) {
        logger.debug(`Modelo ${modelName} não disponível, tentando próximo modelo...`);
        continue; // Tentar próximo modelo
      }
      
      // Se não for recuperável ou for o último modelo, lançar erro
      throw error;
    }
  }
  
  // Se chegou aqui, todos os modelos falharam
  throw lastError || new Error('Todos os modelos Gemini falharam');
}

/**
 * Gera resposta do assistente, tentando OpenAI primeiro e usando Gemini como fallback
 */
export async function generateSupportReply(
  history: LlmMessage[],
): Promise<string> {
  // Verificar se pelo menos um cliente está disponível
  if (!openaiClient && !geminiClient) {
    throw new AppError(
      'Assistente virtual não está configurado. Configure OPENAI_API_KEY ou GEMINI_API_KEY.',
      503
    );
  }

  const messages: LlmMessage[] = [
    { role: 'system', content: SUPPORT_SYSTEM_PROMPT },
    ...history,
  ];

  // Tentar Gemini primeiro (gemini-2.5-flash como prioridade)
  if (geminiClient) {
    try {
      logger.debug('Tentando gerar resposta com Gemini (prioridade)');
      const response = await generateWithGemini(messages);
      logger.debug('Resposta gerada com sucesso usando Gemini');
      return response;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const errorStatus = error?.status || error?.statusCode;
      const errorCode = error?.code;
      
      logger.warn('Erro ao usar Gemini, tentando OpenAI como fallback', {
        message: errorMessage.substring(0, 500),
        status: errorStatus,
        code: errorCode,
      });

      // Se for erro recuperável (404, 503, 429, modelo não encontrado, etc), tentar OpenAI
      const isRecoverableError =
        errorStatus === 404 ||
        errorStatus === 503 ||
        errorStatus === 429 ||
        errorCode === 'NOT_FOUND' ||
        errorMessage.includes('not found') ||
        errorMessage.includes('model not found');

      if (isRecoverableError && openaiClient) {
        try {
          logger.debug('Tentando gerar resposta com OpenAI (fallback)');
          const response = await generateWithOpenAI(messages);
          logger.debug('Resposta gerada com sucesso usando OpenAI (fallback)');
          return response;
        } catch (openaiError: any) {
          const openaiErrorMessage = openaiError?.message || String(openaiError);
          const openaiErrorStatus = openaiError?.status || openaiError?.response?.status;
          const openaiErrorCode = openaiError?.code || openaiError?.response?.data?.error?.code;

          logger.error('Erro ao usar OpenAI como fallback', {
            error: openaiErrorMessage,
            errorStatus: openaiErrorStatus,
            errorCode: openaiErrorCode,
            errorName: openaiError?.constructor?.name,
            errorDetails: openaiError?.response?.data || openaiError?.cause || openaiError,
            stack: openaiError?.stack,
          });

          // Se OpenAI também falhar, lançar erro informativo
          throw new AppError(
            `Erro ao gerar resposta do assistente virtual. Ambos os provedores falharam. Gemini: ${errorMessage.substring(0, 100)}. OpenAI: ${openaiErrorMessage.substring(0, 100)}`,
            500
          );
        }
      }

      // Se não for erro recuperável ou OpenAI não estiver disponível, lançar erro
      if (errorStatus === 401 || errorCode === 'invalid_api_key') {
        throw new AppError(
          'Chave de API do Gemini inválida. Verifique a configuração.',
          503
        );
      } else if (errorStatus === 429 || errorCode === 'rate_limit_exceeded') {
        throw new AppError(
          'Limite de requisições do Gemini excedido. Tente novamente em alguns instantes.',
          503
        );
      } else {
        throw new AppError(
          `Erro ao gerar resposta do assistente virtual: ${errorMessage}`,
          500
        );
      }
    }
  }

  // Se Gemini não estiver disponível, usar OpenAI diretamente
  if (openaiClient) {
    try {
      logger.debug('Usando OpenAI (Gemini não disponível)');
      const response = await generateWithOpenAI(messages);
      logger.debug('Resposta gerada com sucesso usando OpenAI');
      return response;
    } catch (error: any) {
      logger.error('Erro ao usar OpenAI', {
        error: error?.message || String(error),
      });
      throw new AppError(
        'Erro ao gerar resposta do assistente virtual usando OpenAI.',
        500
      );
    }
  }

  throw new AppError(
    'Nenhum provedor de IA disponível. Configure OPENAI_API_KEY ou GEMINI_API_KEY.',
    503
  );
}

