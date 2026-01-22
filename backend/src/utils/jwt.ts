import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

// Usar process.env diretamente como fallback se env não tiver a variável
const JWT_SECRET = env.JWT_SECRET || process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = env.JWT_REFRESH_EXPIRES_IN || process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  if (!JWT_SECRET || JWT_SECRET.trim() === '') {
    const errorMsg = 'JWT_SECRET não está configurado';
    console.error('❌', errorMsg);
    console.error('Variáveis disponíveis:', {
      JWT_SECRET_env: env.JWT_SECRET ? `definida (${env.JWT_SECRET.length} chars)` : 'não definida',
      JWT_SECRET_process: process.env.JWT_SECRET ? `definida (${process.env.JWT_SECRET.length} chars)` : 'não definida',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ? 'definida' : 'não definida',
    });
    throw new Error(errorMsg);
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  if (!JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET não está configurado');
  }
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET não está configurado');
  }
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  if (!JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET não está configurado');
  }
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
};

