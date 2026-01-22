import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Flag para indicar se Redis está disponível
let redisAvailable = false;

// Cliente Redis compartilhado (lazy initialization)
let redisClient: Redis | null = null;
let redisConnection: Redis | null = null;

// Função para criar cliente Redis com tratamento de erros
function createRedisClient(): Redis | null {
  try {
    const client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB,
      maxRetriesPerRequest: null, // Necessário para BullMQ
      retryStrategy: (times) => {
        // Limitar tentativas de reconexão
        if (times > 3) {
          logger.warn('Redis: Máximo de tentativas de reconexão atingido. Redis será desabilitado.');
          redisAvailable = false;
          return null; // Para de tentar reconectar
        }
        return Math.min(times * 200, 2000);
      },
      enableReadyCheck: false, // Não bloquear na inicialização
      lazyConnect: true, // Não conectar automaticamente
    });

    // Tratamento de erros de conexão
    client.on('error', (error: Error) => {
      logger.warn('Redis: Erro de conexão (Redis será desabilitado)', {
        error: error.message,
        code: (error as any).code || 'UNKNOWN',
      });
      redisAvailable = false;
    });

    client.on('connect', () => {
      logger.info('Redis: Conectado com sucesso');
      redisAvailable = true;
    });

    client.on('close', () => {
      logger.warn('Redis: Conexão fechada');
      redisAvailable = false;
    });

    return client;
  } catch (error: any) {
    logger.warn('Redis: Erro ao criar cliente (Redis será desabilitado)', {
      error: error?.message || String(error),
      code: error?.code || 'UNKNOWN',
    });
    redisAvailable = false;
    return null;
  }
}

// Inicializar cliente Redis
redisClient = createRedisClient();
redisConnection = redisClient;

// Opções padrão para todas as filas (serão criadas dinamicamente quando Redis estiver disponível)

// Filas (serão inicializadas apenas se Redis estiver disponível)
export let emailQueue: Queue | null = null;
export let slaQueue: Queue | null = null;
export let automationQueue: Queue | null = null;

// Função para criar filas (Redis é obrigatório)
function createQueues(): void {
  if (!redisConnection) {
    throw new Error('Redis não disponível. Não é possível criar filas.');
  }

  try {
    const queueOptions: QueueOptions = {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Manter jobs completos por 24 horas
          count: 1000, // Manter últimos 1000 jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Manter jobs falhados por 7 dias
        },
      },
    };
    
    emailQueue = new Queue('email', queueOptions);
    slaQueue = new Queue('sla', queueOptions);
    automationQueue = new Queue('automation', queueOptions);
    
    logger.info('✅ Filas criadas com sucesso', {
      email: !!emailQueue,
      sla: !!slaQueue,
      automation: !!automationQueue,
    });
  } catch (error) {
    logger.error('❌ Erro ao criar filas', error);
    throw error;
  }
}

// Função para inicializar todas as filas
export async function initializeQueues(): Promise<void> {
  if (!redisClient) {
    logger.error('❌ Redis não configurado. Redis é obrigatório para o funcionamento da aplicação.');
    logger.error('💡 Configure REDIS_HOST e REDIS_PORT no arquivo .env');
    throw new Error('Redis não configurado. Configure REDIS_HOST e REDIS_PORT no .env');
  }

  try {
    // Tentar conectar ao Redis
    await redisClient.connect();
    
    // Verificar conexão Redis
    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      redisAvailable = true;
      createQueues();
      logger.info('✅ Filas inicializadas com sucesso', {
        queues: ['email', 'sla', 'automation'],
        redis: `${env.REDIS_HOST}:${env.REDIS_PORT}`,
      });
    } else {
      throw new Error('Redis ping falhou');
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || '';
    
    logger.error('❌ Erro ao conectar ao Redis', {
      error: errorMessage,
      code: errorCode,
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    });
    
    logger.error('💡 Redis é obrigatório para o funcionamento da aplicação.');
    logger.error('💡 Verifique se o Redis está instalado e rodando:');
    logger.error('   - Windows: redis-server deve estar em execução');
    logger.error('   - Linux/Mac: sudo systemctl start redis ou brew services start redis');
    logger.error('   - Docker: docker run -d -p 6379:6379 redis');
    
    // Limpar cliente Redis
    if (redisClient) {
      try {
        await redisClient.quit().catch(() => {});
      } catch {}
    }
    redisClient = null;
    redisConnection = null;
    redisAvailable = false;
    
    // Lançar erro para impedir que o servidor inicie sem Redis
    throw new Error(`Falha ao conectar ao Redis: ${errorMessage}`);
  }
}

// Função para fechar todas as filas (útil para graceful shutdown)
export async function closeQueues(): Promise<void> {
  try {
    const promises: Promise<void>[] = [];
    
    if (emailQueue) promises.push(emailQueue.close());
    if (slaQueue) promises.push(slaQueue.close());
    if (automationQueue) promises.push(automationQueue.close());
    if (redisClient) {
      promises.push(
        redisClient.quit().then(() => undefined).catch(() => undefined)
      );
    }

    await Promise.all(promises);
    logger.info('✅ Filas e conexão Redis fechadas com sucesso');
  } catch (error) {
    logger.error('❌ Erro ao fechar filas', error);
  }
}

// Exportar todas as filas
export const queues = {
  email: emailQueue,
  sla: slaQueue,
  automation: automationQueue,
};

// Exportar flag de disponibilidade
export function isRedisAvailable(): boolean {
  return redisAvailable;
}

// Exportar cliente Redis (pode ser null)
export { redisClient, redisConnection };

