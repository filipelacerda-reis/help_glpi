import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { requestContextStore } from '../shared/http/requestContext.store';
import { auditEventPipelineService } from '../domains/compliance/services/auditEventPipeline.service';
import { metricsRegistry } from '../shared/observability/metrics.registry';
import { startSpan } from '../shared/observability/tracing';

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
  const model = params.model || '';
  const action = params.action || '';
  const span = startSpan('db.prisma', {
    'db.system': 'postgresql',
    'db.operation': `${model}.${action}`,
  });
  const criticalModelDomain: Record<string, string> = {
    User: 'iam',
    Role: 'iam',
    Permission: 'iam',
    UserRoleAssignment: 'iam',
    RolePermission: 'iam',
    UserAttribute: 'iam',
    Employee: 'hr',
    OnboardingCase: 'hr',
    OffboardingCase: 'hr',
    CaseTask: 'hr',
    Policy: 'hr',
    PolicyAcknowledgement: 'hr',
    CostCenter: 'finance',
    Vendor: 'finance',
    PurchaseRequest: 'finance',
    PurchaseRequestItem: 'finance',
    PurchaseOrder: 'finance',
    Invoice: 'finance',
    Approval: 'finance',
    AssetLedger: 'finance',
    AssetMovement: 'finance',
    Equipment: 'assets',
    EquipmentAssignment: 'assets',
    StockLocation: 'assets',
    StockMovement: 'assets',
    Delivery: 'assets',
    DeliveryItem: 'assets',
    PlatformSetting: 'config',
    AuthProviderConfig: 'iam',
  };
  const auditableActions = new Set([
    'create',
    'update',
    'delete',
    'upsert',
    'createMany',
    'updateMany',
    'deleteMany',
  ]);

  const isAuditable = Boolean(criticalModelDomain[model] && auditableActions.has(action));
  const delegateName = model ? model.charAt(0).toLowerCase() + model.slice(1) : '';
  let beforeData: unknown = null;

  if (
    isAuditable &&
    ['update', 'delete', 'upsert'].includes(action) &&
    params.args?.where &&
    (prisma as any)[delegateName]?.findUnique
  ) {
    try {
      beforeData = await (prisma as any)[delegateName].findUnique({
        where: params.args.where,
      });
    } catch {
      beforeData = null;
    }
  }

  try {
    const result = await next(params);
    const after = Date.now();
    const durationSeconds = (after - before) / 1000;

    metricsRegistry.observeHistogram(
      'db_query_duration_seconds',
      'Prisma operation duration in seconds',
      durationSeconds,
      {
        model,
        action,
      }
    );
    metricsRegistry.incCounter('db_queries_total', 'Total Prisma operations', {
      model,
      action,
      status: 'success',
    });
    
    if (env.NODE_ENV === 'development') {
      logger.debug('Prisma Operation', {
        model: params.model,
        action: params.action,
        durationMs: after - before,
      } as any);
    }

    const context = requestContextStore.get();
    if (isAuditable && context?.requestId) {
      const resourceId =
        (result as any)?.id ||
        params.args?.where?.id ||
        params.args?.where?.key ||
        params.args?.where?.email ||
        null;
      const afterData = action === 'delete' ? null : result;

      await auditEventPipelineService.enqueue({
        actorUserId: context.userId,
        actorEmail: context.userEmail,
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId,
        correlationId: context.correlationId,
        domain: criticalModelDomain[model],
        action: `${model}.${action}`,
        resourceType: model,
        resourceId: resourceId ? String(resourceId) : undefined,
        beforeJson: beforeData,
        afterJson: afterData,
        metadataJson: {
          source: 'prisma-middleware',
        },
        idempotencyKey: `${context.requestId}:${model}:${action}:${resourceId || 'bulk'}`,
      });
    }

    span?.setAttribute?.('db.status', 'success');
    span?.end();
    
    return result;
  } catch (error: any) {
    metricsRegistry.incCounter('db_queries_total', 'Total Prisma operations', {
      model,
      action,
      status: 'error',
    });
    span?.recordException?.(error);
    span?.setStatus?.({ code: 2, message: error?.message || 'db_error' });
    span?.end();
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
