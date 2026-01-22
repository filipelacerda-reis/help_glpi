import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Estender a interface Request para incluir o ID de correlação
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Gerar ou recuperar ID de correlação
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  req.correlationId = correlationId;

  // Adicionar ID aos headers da resposta
  res.setHeader('X-Correlation-ID', correlationId);

  // Logar início da requisição
  const startTime = Date.now();
  
  // Logar apenas endpoints de API para não poluir (ignorar healthchecks se houver)
  if (req.path.startsWith('/api')) {
      logger.info(`Incoming ${req.method} ${req.path}`, {
        correlationId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
  }

  // Interceptar finalização da resposta para logar tempo e status
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
        const duration = Date.now() - startTime;
        const message = `Completed ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`;
        
        const meta = {
            correlationId,
            statusCode: res.statusCode,
            duration,
        };

        if (res.statusCode >= 400) {
            logger.warn(message, meta);
        } else {
            logger.info(message, meta);
        }
    }
  });

  next();
};

