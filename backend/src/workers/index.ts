/**
 * Inicializa todos os workers
 * Redis é obrigatório - os workers sempre serão criados
 */
import { isRedisAvailable, redisConnection } from '../lib/queue';
import { logger } from '../utils/logger';

if (!isRedisAvailable() || !redisConnection) {
  logger.error('❌ Redis não disponível. Workers não podem ser inicializados.');
  throw new Error('Redis não disponível. Workers não podem ser inicializados.');
}

import('./email.worker');
import('./sla.worker');
import('./automation.worker');
logger.info('✅ Todos os workers inicializados');

