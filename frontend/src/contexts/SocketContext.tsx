import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../services/api';
import { useAuth } from './AuthContext';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      return;
    }

    const socketInstance: Socket = io(API_URL, {
      transports: ['websocket'],
      auth: {
        token,
      },
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    socketInstance.on('connect_error', (err: Error) => {
      console.error('Erro na conexão Socket.io:', err);
    });

    return () => {
      socketInstance.disconnect();
      setConnected(false);
    };
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      socket,
      connected,
    }),
    [socket, connected]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket deve ser usado dentro de um SocketProvider');
  }
  return context;
};


