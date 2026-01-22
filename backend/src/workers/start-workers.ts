/**
 * Script para iniciar workers separadamente
 * Útil para rodar workers em processos separados em produção
 * 
 * Uso: tsx src/workers/start-workers.ts
 */

import './index';
import { logger } from '../utils/logger';

logger.info('🚀 Workers iniciados como processo separado');

// Manter processo vivo
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down workers...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down workers...');
  process.exit(0);
});

