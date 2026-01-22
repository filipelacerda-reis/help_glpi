import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Log da URL do banco (sem senha) para debug
const dbUrlForLog = env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
console.log('🔗 Prisma usando DATABASE_URL:', dbUrlForLog);

// Extrair informações da senha (sem expor a senha real)
const passwordMatch = env.DATABASE_URL.match(/postgresql:\/\/[^:]+:([^@]+)@/);
if (passwordMatch) {
  const passwordLength = decodeURIComponent(passwordMatch[1]).length;
  console.log('🔑 Senha configurada no DATABASE_URL:', `**** (${passwordLength} chars)`);
} else {
  console.warn('⚠️  Não foi possível extrair informações da senha do DATABASE_URL');
}

// Usar DATABASE_URL do arquivo de configuração
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
  log:
    env.NODE_ENV === 'development'
      ? [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ]
      : [{ level: 'error', emit: 'stdout' }],
});

// Verificar conexão ao inicializar
prisma.$connect()
  .then(() => {
    logger.info('✅ Prisma Client conectado ao banco de dados', {
      databaseUrl: env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'), // Ocultar senha
    });
  })
  .catch((error: any) => {
    logger.error('❌ Erro ao conectar Prisma Client', {
      error: error?.message || String(error),
      errorCode: error?.code,
      errorMeta: error?.meta,
    });
  });

// Log de queries em desenvolvimento
if (env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug('Prisma Query', {
      query: e.query,
      params: e.params,
      durationMs: e.duration,
    } as any);
  });
}

// Log de erros do Prisma
prisma.$use(async (params, next) => {
  const before = Date.now();
  try {
    const result = await next(params);
    const after = Date.now();
    
    if (env.NODE_ENV === 'development') {
      logger.debug('Prisma Operation', {
        model: params.model,
        action: params.action,
        durationMs: after - before,
      } as any);
    }
    
    return result;
  } catch (error: any) {
    // Log detalhado do erro do Prisma
    const errorDetails: any = {
      error: error?.message || String(error),
      errorName: error?.name,
      errorCode: error?.code,
      errorMeta: error?.meta,
      model: params.model,
      action: params.action,
    };
    
    // Tentar serializar o erro completo
    try {
      errorDetails.errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
    } catch (e) {
      errorDetails.errorString = 'Erro ao serializar: ' + String(e);
    }
    
    // Adicionar stack se disponível
    if (error?.stack) {
      errorDetails.stack = error?.stack;
    }
    
    // Passar o erro como segundo parâmetro e os detalhes como terceiro
    logger.error('Prisma Error', error instanceof Error ? error : undefined, errorDetails);
    throw error;
  }
});

export default prisma;

