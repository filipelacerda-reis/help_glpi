// IMPORTANTE: Carregar variáveis de ambiente PRIMEIRO, antes de qualquer outra importação
import './config/env';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'express-async-errors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import passport from 'passport';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { attachIo } from './middleware/socket';
import { requestContextMiddleware } from './shared/http/requestContext.middleware';
import { httpObservabilityMiddleware } from './shared/http/httpObservability.middleware';
import { metricsRegistry } from './shared/observability/metrics.registry';
import { initializeTelemetry } from './shared/observability/tracing';
import { authRoutes } from './routes/auth.routes';
import { samlAuthRoutes } from './routes/auth.saml.routes';
import { auth0AuthRoutes } from './routes/auth.auth0.routes';
import { userRoutes } from './routes/user.routes';
import { ticketRoutes } from './routes/ticket.routes';
import { categoryRoutes } from './routes/category.routes';
import { teamRoutes } from './routes/team.routes';
import { adminRoutes } from './routes/admin.routes';
import { adminSettingsRoutes } from './routes/admin.settings.routes';
import { notificationRoutes } from './routes/notification.routes';
import { tagRoutes } from './routes/tag.routes';
import { ticketEventRoutes } from './routes/ticketEvent.routes';
import { ticketRelationRoutes } from './routes/ticketRelation.routes';
import { worklogRoutes } from './routes/worklog.routes';
import { satisfactionRoutes } from './routes/satisfaction.routes';
import { slaRoutes } from './routes/sla.routes';
import { automationRoutes } from './routes/automation.routes';
import { kbRoutes } from './routes/kb.routes';
import { reportPresetRoutes } from './routes/reportPreset.routes';
import { technicianJournalRoutes } from './routes/technicianJournal.routes';
import { assistantRouter } from './routes/assistant.routes';
import { employeeRoutes } from './routes/employee.routes';
import { equipmentRoutes } from './routes/equipment.routes';
import { financeRoutes } from './routes/finance.routes';
import { hrRoutes } from './routes/hr.routes';
import { procurementRoutes } from './routes/procurement.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { logger } from './utils/logger';
import { initializeQueues, closeQueues, getQueueJobCountsSnapshot, isRedisAvailable, redisClient } from './lib/queue';
import { initSocket } from './lib/socket';
import prisma from './lib/prisma';

import { env } from './config/env';

const app = express();
const PORT = env.PORT;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Permitir carregar imagens/uploads
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // Limite de 1000 requisições por IP
  message: 'Muitas requisições deste IP, tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(requestContextMiddleware);
app.use(httpObservabilityMiddleware);
app.use(requestLogger);
app.use(attachIo);

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
// Garantir que os diretórios de uploads existam
const uploadsDirs = [
  path.join(process.cwd(), 'uploads', 'tickets'),
  path.join(process.cwd(), 'uploads', 'journal'),
];
uploadsDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info('Diretório de uploads criado', { path: dir });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'backend',
    timestamp: new Date().toISOString(),
  });
});
app.get('/readyz', async (_req, res) => {
  const checks: Record<string, { ok: boolean; error?: string }> = {
    db: { ok: false },
    redis: { ok: false },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db.ok = true;
  } catch (error: any) {
    checks.db = { ok: false, error: error?.message || String(error) };
  }

  try {
    if (!redisClient || !isRedisAvailable()) {
      checks.redis = { ok: false, error: 'redis-not-available' };
    } else {
      const pong = await redisClient.ping();
      checks.redis.ok = pong === 'PONG';
      if (pong !== 'PONG') checks.redis.error = `unexpected-ping:${pong}`;
    }
  } catch (error: any) {
    checks.redis = { ok: false, error: error?.message || String(error) };
  }

  const ready = checks.db.ok && checks.redis.ok;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});
app.get('/metrics', async (_req, res) => {
  try {
    const queueSnapshots = await getQueueJobCountsSnapshot();
    for (const entry of queueSnapshots) {
      for (const [state, value] of Object.entries(entry.counts)) {
        metricsRegistry.setGauge(
          'queue_jobs',
          'Queue jobs by state',
          { queue: entry.queue, state },
          Number(value || 0)
        );
      }
    }

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.status(200).send(metricsRegistry.renderPrometheus());
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'metrics_error' });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', samlAuthRoutes);
app.use('/api/auth', auth0AuthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminSettingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/tickets', ticketEventRoutes);
app.use('/api/tickets', ticketRelationRoutes);
app.use('/api/tickets', worklogRoutes);
app.use('/api/tickets', satisfactionRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/automation-rules', automationRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/report-presets', reportPresetRoutes);
app.use('/api', technicianJournalRoutes);
app.use('/api/assistant', assistantRouter);
app.use('/api/employees', employeeRoutes);
app.use('/api/equipments', equipmentRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/webhooks', webhookRoutes);

// Error handler
app.use(errorHandler);

// Inicializar filas e workers
let server: http.Server;

async function startServer() {
  try {
    initializeTelemetry();

    // Inicializar filas (obrigatório - se falhar, servidor não inicia)
    await initializeQueues();

    // Inicializar workers (apenas em produção ou se explicitamente habilitado)
    if (env.NODE_ENV === 'production' || process.env.ENABLE_WORKERS === 'true') {
      // Importar workers (eles se auto-inicializam)
      await import('./workers');
    }

    // Criar servidor HTTP e inicializar Socket.io
    server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`, {
        environment: env.NODE_ENV,
        port: PORT,
        workersEnabled: env.NODE_ENV === 'production' || process.env.ENABLE_WORKERS === 'true',
      });
    });

    // Tratamento de erro para porta em uso
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use`, {
          port: PORT,
          error: error.message,
        });
        logger.info(`💡 Try running: npm run kill-port`);
        logger.info(`💡 Or change PORT in .env file`);
        process.exit(1);
      } else {
        logger.error('❌ Server error', error);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  if (server) {
    server.close();
  }
  await closeQueues();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  if (server) {
    server.close();
  }
  await closeQueues();
  process.exit(0);
});

startServer();
