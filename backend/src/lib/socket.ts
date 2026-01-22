import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.query?.token as string | undefined);

      if (!token) {
        logger.warn('Tentativa de conexão Socket.io sem token de autenticação', {
          ip: socket.handshake.address,
        });
        return next(new Error('Unauthorized'));
      }

      const payload = verifyAccessToken(token);

      // Anexar userId aos dados do socket e entrar na sala do usuário
      (socket.data as any).userId = payload.userId;
      socket.join(payload.userId);

      logger.info('Cliente Socket.io autenticado', {
        userId: payload.userId,
        socketId: socket.id,
      });

      return next();
    } catch (error) {
      logger.warn('Falha na autenticação do Socket.io', {
        error: error instanceof Error ? error.message : String(error),
      });
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket.data as any).userId as string | undefined;

    logger.info('Cliente Socket.io conectado', {
      socketId: socket.id,
      userId,
    });

    socket.on('disconnect', (reason) => {
      logger.info('Cliente Socket.io desconectado', {
        socketId: socket.id,
        userId,
        reason,
      });
    });
  });

  return io;
};

export const getIo = (): Server | null => {
  return io;
};


