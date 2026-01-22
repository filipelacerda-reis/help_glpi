import { env } from '../config/env';
import { logger } from '../utils/logger';

let GoogleGenerativeAI: any = null;
let geminiClient: any = null;

try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
  
  // Tentar múltiplas fontes para a API key
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  
  if (apiKey && apiKey.trim() !== '') {
    geminiClient = new GoogleGenerativeAI(apiKey.trim());
    logger.info('✅ Gemini client inicializado com sucesso', {
      keyLength: apiKey.length,
      keyPrefix: apiKey.substring(0, 10) + '...',
    });
  } else {
    logger.warn('⚠️  GEMINI_API_KEY não configurada. Fallback para Gemini não estará disponível.');
    logger.debug('Verificando variáveis de ambiente:', {
      env_GEMINI_API_KEY: env.GEMINI_API_KEY ? 'definida' : 'não definida',
      process_env_GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'definida' : 'não definida',
    });
  }
} catch (error: any) {
  logger.warn('⚠️  Erro ao inicializar Gemini client', {
    error: error?.message || String(error),
  });
  logger.warn('💡 Instale o módulo: npm install @google/generative-ai');
}

export { geminiClient };

