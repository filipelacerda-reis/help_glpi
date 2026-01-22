import { env } from '../config/env';
import { logger } from '../utils/logger';

let OpenAI: any = null;
let openaiClient: any = null;

try {
  OpenAI = require('openai').default;
  
  // Tentar múltiplas fontes para a API key
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  
  if (apiKey && apiKey.trim() !== '') {
    openaiClient = new OpenAI({
      apiKey: apiKey.trim(),
    });
    logger.info('✅ OpenAI client inicializado com sucesso', {
      keyLength: apiKey.length,
      keyPrefix: apiKey.substring(0, 7) + '...',
    });
  } else {
    logger.warn('⚠️  OPENAI_API_KEY não configurada. Funcionalidades do assistente virtual não estarão disponíveis.');
    logger.debug('Verificando variáveis de ambiente:', {
      env_OPENAI_API_KEY: env.OPENAI_API_KEY ? 'definida' : 'não definida',
      process_env_OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'definida' : 'não definida',
    });
  }
} catch (error: any) {
  logger.warn('⚠️  Erro ao inicializar OpenAI client', {
    error: error?.message || String(error),
  });
  logger.warn('💡 Instale o módulo: npm install openai');
}

export { openaiClient };

