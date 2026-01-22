import winston from 'winston';
import { env } from '../config/env';

// Formato customizado para desenvolvimento (legível)
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] : ${message} `;
  
  if (Object.keys(metadata).length > 0) {
    // Se houver correlationId, destaca-o
    if (metadata.correlationId) {
      msg = `${timestamp} [${level}] [${metadata.correlationId}] : ${message} `;
      delete metadata.correlationId;
    }
    
    if (Object.keys(metadata).length > 0) {
        msg += JSON.stringify(metadata, null, 2);
    }
  }
  return msg;
});

// Formato JSON estruturado para produção
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Configuração do Winston
const winstonLogger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: env.NODE_ENV === 'production' 
    ? jsonFormat
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        customFormat
      ),
  transports: [
    new winston.transports.Console(),
    // Podemos adicionar transports de arquivo ou remotos aqui futuramente
  ],
});

interface LogMetadata {
  correlationId?: string;
  userId?: string;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  errorType?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

class LoggerWrapper {
  /**
   * Enriquece metadados com informações contextuais padrão
   */
  private enrichMetadata(metadata?: LogMetadata): LogMetadata {
    return {
      ...metadata,
      // Metadados contextuais sempre incluídos quando disponíveis
      timestamp: new Date().toISOString(),
    };
  }

  info(message: string, data?: LogMetadata): void {
    const enrichedData = this.enrichMetadata(data);
    winstonLogger.info(message, enrichedData);
  }

  warn(message: string, data?: LogMetadata): void {
    const enrichedData = this.enrichMetadata(data);
    winstonLogger.warn(message, enrichedData);
  }

  error(message: string, error?: Error | any, data?: LogMetadata): void {
    const enrichedData = this.enrichMetadata(data);
    
    if (error instanceof Error) {
      winstonLogger.error(message, {
        ...enrichedData,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });
    } else if (error) {
      winstonLogger.error(message, {
        ...enrichedData,
        error: String(error),
      });
    } else {
      winstonLogger.error(message, enrichedData);
    }
  }

  debug(message: string, data?: LogMetadata): void {
    const enrichedData = this.enrichMetadata(data);
    winstonLogger.debug(message, enrichedData);
  }
  
  // Método para acessar o logger original se necessário (ex: para streams do morgan)
  getRawLogger() {
    return winstonLogger;
  }
}

export const logger = new LoggerWrapper();
