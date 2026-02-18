import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'express-async-errors';
import { errorHandler } from '../../middleware/errorHandler';
import { requestLogger } from '../../middleware/requestLogger';
import { attachIo } from '../../middleware/socket';
import { requestContextMiddleware } from '../../shared/http/requestContext.middleware';
import { httpObservabilityMiddleware } from '../../shared/http/httpObservability.middleware';
import { metricsRegistry } from '../../shared/observability/metrics.registry';
import { authRoutes } from '../../routes/auth.routes';
import { userRoutes } from '../../routes/user.routes';
import { ticketRoutes } from '../../routes/ticket.routes';
import { categoryRoutes } from '../../routes/category.routes';
import { teamRoutes } from '../../routes/team.routes';
import { adminRoutes } from '../../routes/admin.routes';
import { adminSettingsRoutes } from '../../routes/admin.settings.routes';
import { notificationRoutes } from '../../routes/notification.routes';
import { tagRoutes } from '../../routes/tag.routes';
import { ticketEventRoutes } from '../../routes/ticketEvent.routes';
import { ticketRelationRoutes } from '../../routes/ticketRelation.routes';
import { worklogRoutes } from '../../routes/worklog.routes';
import { satisfactionRoutes } from '../../routes/satisfaction.routes';
import { slaRoutes } from '../../routes/sla.routes';
import { automationRoutes } from '../../routes/automation.routes';
import { kbRoutes } from '../../routes/kb.routes';
import { reportPresetRoutes } from '../../routes/reportPreset.routes';
import { technicianJournalRoutes } from '../../routes/technicianJournal.routes';
import { assistantRouter } from '../../routes/assistant.routes';
import { employeeRoutes } from '../../routes/employee.routes';
import { equipmentRoutes } from '../../routes/equipment.routes';
import { financeRoutes } from '../../routes/finance.routes';
import { hrRoutes } from '../../routes/hr.routes';
import { procurementRoutes } from '../../routes/procurement.routes';
import path from 'path';

/**
 * Cria uma instância do Express app para testes
 * Sem inicializar servidor HTTP ou Socket.io
 */
export function createTestApp(): express.Application {
  const app = express();

  // Middleware básico
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));
  app.use(cors());
  
  // Rate limiting mais permissivo para testes
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000,
  });
  app.use(limiter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestContextMiddleware);
  app.use(httpObservabilityMiddleware);
  app.use(requestLogger);
  app.use(attachIo);

  // Servir arquivos estáticos (uploads)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'backend-test', timestamp: new Date().toISOString() });
  });
  app.get('/readyz', (_req, res) => {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        db: { ok: true },
        redis: { ok: true },
      },
    });
  });
  app.get('/metrics', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.status(200).send(metricsRegistry.renderPrometheus());
  });

  // Routes
  app.use('/api/auth', authRoutes);
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

  // Error handler
  app.use(errorHandler);

  return app;
}
