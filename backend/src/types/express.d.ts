import { UserRole } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import type { PlatformModule } from '../config/modules';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
      userEffectiveModules?: PlatformModule[];
      leadTeamIds?: string[]; // IDs dos times onde o usuário é líder (para filtros de métricas)
      io?: SocketIOServer; // Instância do Socket.io anexada via middleware
      correlationId?: string; // ID de correlação para rastrear requisições
      requestId?: string;
      userPermissions?: string[];
      userEntitlements?: Array<{
        module: string;
        submodule: string;
        level: string;
      }>;
      auth?: {
        userId: string;
        role: UserRole;
        permissions: string[];
        entitlements: Array<{
          module: string;
          submodule: string;
          level: string;
        }>;
        attributes: {
          employeeId?: string | null;
          businessUnit?: string | null;
          costCenterId?: string | null;
          location?: string | null;
          managerUserId?: string | null;
        };
      };
      userAttributes?: {
        employeeId?: string | null;
        businessUnit?: string | null;
        costCenterId?: string | null;
        location?: string | null;
        managerUserId?: string | null;
      };
    }
  }
}

export {};
