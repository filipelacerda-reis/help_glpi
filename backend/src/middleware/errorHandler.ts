import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  FORBIDDEN_ERROR = 'FORBIDDEN_ERROR',
}

export type ErrorCategory = 'VALIDATION' | 'BUSINESS' | 'AUTH' | 'SYSTEM';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errorType: ErrorType;
  type: ErrorCategory;
  context?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    errorType: ErrorType = ErrorType.INTERNAL_ERROR,
    type?: ErrorCategory,
    context?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errorType = errorType;
    // Determinar categoria automaticamente se não fornecida
    this.type = type || this.inferCategory(errorType, statusCode);
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  private inferCategory(errorType: ErrorType, statusCode: number): ErrorCategory {
    // Mapear ErrorType para ErrorCategory
    if (errorType === ErrorType.VALIDATION_ERROR) return 'VALIDATION';
    if (errorType === ErrorType.AUTH_ERROR || errorType === ErrorType.FORBIDDEN_ERROR) return 'AUTH';
    if (errorType === ErrorType.NOT_FOUND_ERROR) return 'BUSINESS';
    if (errorType === ErrorType.DATABASE_ERROR || errorType === ErrorType.INTERNAL_ERROR) return 'SYSTEM';
    // Fallback baseado em statusCode
    if (statusCode < 400) return 'SYSTEM';
    if (statusCode < 500) return 'BUSINESS';
    return 'SYSTEM';
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof ZodError) {
    const message = err.errors?.[0]?.message || 'Dados inválidos';
    logger.warn('Erro de validação (Zod)', {
      correlationId: req.correlationId,
      userId: req.userId,
      path: req.path,
      method: req.method,
      statusCode: 400,
      message,
    });

    res.status(400).json({ error: message });
    return;
  }

  // Coletar metadados contextuais da requisição
  const requestMeta = {
    correlationId: req.correlationId,
    userId: req.userId,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };

  if (err instanceof AppError) {
    // Usar a propriedade type para decidir o nível de log
    // VALIDATION e BUSINESS: warn (erros esperados de negócio/validação)
    // AUTH e SYSTEM: error (erros de sistema/segurança que precisam atenção)
    const logLevel = (err.type === 'VALIDATION' || err.type === 'BUSINESS') ? 'warn' : 'error';

    const logData = {
      ...requestMeta,
      errorType: err.errorType,
      errorCategory: err.type,
      statusCode: err.statusCode,
      message: err.message,
      context: err.context,
      ...(err.statusCode >= 500 && err.stack ? { stack: err.stack } : {}),
    };

    if (logLevel === 'warn') {
      logger.warn(`AppError [${err.errorType}] [${err.type}]`, logData);
    } else {
      logger.error(`AppError [${err.errorType}] [${err.type}]`, err, logData);
    }

    res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && err.context ? { context: err.context } : {}),
    });
    return;
  }

  // Erros inesperados são sempre logs de erro com stack trace completo
  logger.error('Erro inesperado', err, {
    ...requestMeta,
    errorType: ErrorType.INTERNAL_ERROR,
    body: req.body,
    query: req.query,
    params: req.params,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Erro interno do servidor',
  });
};
