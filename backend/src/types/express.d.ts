import { UserRole } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
      leadTeamIds?: string[]; // IDs dos times onde o usuário é líder (para filtros de métricas)
      io?: SocketIOServer; // Instância do Socket.io anexada via middleware
      correlationId?: string; // ID de correlação para rastrear requisições
    }
  }
}

export {};

