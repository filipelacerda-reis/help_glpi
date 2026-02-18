import { NextFunction, Request, Response } from 'express';
import { metricsRegistry } from '../observability/metrics.registry';
import { startSpan } from '../observability/tracing';

export const httpObservabilityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = process.hrtime.bigint();
  const span = startSpan('http.request', {
    'http.method': req.method,
    'http.route': req.path,
    'http.request_id': req.requestId || req.correlationId || 'unknown',
  });

  res.on('finish', () => {
    const elapsedNs = Number(process.hrtime.bigint() - startedAt);
    const elapsedSeconds = elapsedNs / 1_000_000_000;
    const statusCode = res.statusCode;

    metricsRegistry.incCounter(
      'http_requests_total',
      'Total HTTP requests',
      {
        method: req.method,
        route: req.path,
        status_code: statusCode,
      }
    );

    metricsRegistry.observeHistogram(
      'http_request_duration_seconds',
      'HTTP request duration in seconds',
      elapsedSeconds,
      {
        method: req.method,
        route: req.path,
        status_code: statusCode,
      }
    );

    if (span) {
      span.setAttribute?.('http.status_code', statusCode);
      if (statusCode >= 500) {
        span.setStatus?.({ code: 2, message: `HTTP ${statusCode}` });
      }
      span.end();
    }
  });

  next();
};

