import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { requestContextStore } from './requestContext.store';

export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId =
    (req.headers[REQUEST_ID_HEADER] as string) ||
    (req.headers[CORRELATION_ID_HEADER] as string) ||
    randomUUID();

  req.requestId = requestId;
  req.correlationId = requestId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', requestId);

  requestContextStore.run(
    {
      requestId,
      correlationId: requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
    () => next()
  );
};
