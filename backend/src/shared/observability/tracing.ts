import { env } from '../../config/env';
import { logger } from '../../utils/logger';

type SpanLike = {
  end: () => void;
  recordException?: (error: unknown) => void;
  setAttribute?: (key: string, value: string | number | boolean) => void;
  setStatus?: (status: { code: number; message?: string }) => void;
};

let otelApi: any = null;

try {
  // Optional dependency. If present, we use OpenTelemetry API.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  otelApi = require('@opentelemetry/api');
} catch {
  otelApi = null;
}

let initialized = false;

export function initializeTelemetry() {
  if (initialized) return;
  initialized = true;

  logger.info('Observability initialized', {
    otelEnabled: env.OTEL_ENABLED,
    otelApiAvailable: Boolean(otelApi),
    otelServiceName: env.OTEL_SERVICE_NAME,
    otelExporterEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || null,
  });
}

export function startSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>
): SpanLike | null {
  if (!env.OTEL_ENABLED || !otelApi) return null;

  try {
    const tracer = otelApi.trace.getTracer(env.OTEL_SERVICE_NAME || 'glpi-backend');
    const span = tracer.startSpan(name);
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value as any);
      }
    }
    return span;
  } catch {
    return null;
  }
}

