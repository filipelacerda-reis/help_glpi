import { UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { getDefaultModulesByRole, getEffectiveModules, sanitizeModules } from '../config/modules';
import { authorizationService } from '../domains/iam/services/authorization.service';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  department?: string;
  enabledModules?: string[];
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    department: string | null;
    enabledModules: string[];
    effectiveModules: string[];
    effectivePermissions?: string[];
    entitlements?: Array<{
      module: string;
      submodule: string;
      level: string;
    }>;
  };
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  async register(data: RegisterDto): Promise<AuthResponse> {
    logger.debug('Tentativa de registro', { email: data.email, role: data.role });

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      logger.warn('Tentativa de registro com email já cadastrado', { email: data.email });
      throw new AppError('Email já cadastrado', 400);
    }

    const passwordHash = await hashPassword(data.password);

    const role = data.role || UserRole.REQUESTER;
    const requestedModules = sanitizeModules(data.enabledModules);
    const enabledModules =
      role === UserRole.ADMIN
        ? getDefaultModulesByRole(UserRole.ADMIN)
        : requestedModules.length > 0
          ? requestedModules
          : getDefaultModulesByRole(role);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role,
        department: data.department,
        enabledModules,
      },
    });

    logger.info('Usuário registrado com sucesso', { userId: user.id, email: user.email, role: user.role });

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const authz = await authorizationService.resolveContext(user.id);
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        enabledModules: user.enabledModules,
        effectiveModules: getEffectiveModules(user.role, user.enabledModules),
        effectivePermissions: authz?.permissions || [],
        entitlements: authz?.entitlements || [],
      },
      accessToken: generateAccessToken(tokenPayload),
      refreshToken: generateRefreshToken(tokenPayload),
    };
  },

  async login(data: LoginDto): Promise<AuthResponse> {
    try {
      logger.debug('Tentativa de login', { email: data.email });

      let user;
      try {
        user = await prisma.user.findUnique({
          where: { email: data.email },
        });
      } catch (dbError: any) {
        // Log direto no console para debug
        console.error('❌ ERRO DO PRISMA (detalhes):', {
          name: dbError?.name,
          message: dbError?.message,
          code: dbError?.code,
          meta: dbError?.meta,
          clientVersion: dbError?.clientVersion,
        });
        
        // Log detalhado do erro
        const errorInfo: any = {
          errorName: dbError?.name,
          errorCode: dbError?.code,
          errorMeta: dbError?.meta,
          email: data.email,
        };
        
        // Adicionar mensagem de erro
        if (dbError?.message) {
          errorInfo.errorMessage = dbError.message;
        }
        
        // Tentar serializar o erro completo
        try {
          errorInfo.errorFull = JSON.stringify(dbError, Object.getOwnPropertyNames(dbError));
        } catch (e) {
          errorInfo.errorFull = 'Erro ao serializar: ' + String(e);
        }
        
        // Log usando o formato correto do logger
        logger.error('Erro ao buscar usuário no banco', dbError instanceof Error ? dbError : undefined, errorInfo);
        
        // Se for erro de autenticação, dar mensagem mais específica
        if (dbError?.code === 'P1000' || dbError?.message?.includes('Authentication failed')) {
          throw new AppError('Erro de autenticação com o banco de dados. Verifique as credenciais no .env', 500);
        }
        
        throw new AppError('Erro ao conectar com o banco de dados', 500);
      }

      if (!user) {
        logger.warn('Tentativa de login com email não encontrado', { email: data.email });
        throw new AppError('Email ou senha inválidos', 401);
      }

      let isValidPassword = false;
      try {
        isValidPassword = await comparePassword(data.password, user.passwordHash);
      } catch (passwordError: any) {
        logger.error('Erro ao comparar senha', {
          error: passwordError?.message || String(passwordError),
          stack: passwordError?.stack,
          email: data.email,
          userId: user.id,
        });
        throw new AppError('Erro ao validar senha', 500);
      }

      if (!isValidPassword) {
        logger.warn('Tentativa de login com senha inválida', { email: data.email, userId: user.id });
        throw new AppError('Email ou senha inválidos', 401);
      }

      logger.info('Login realizado com sucesso', { userId: user.id, email: user.email, role: user.role });

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      // Gerar tokens com tratamento de erro
      let accessToken: string;
      let refreshToken: string;
      
      try {
        accessToken = generateAccessToken(tokenPayload);
        refreshToken = generateRefreshToken(tokenPayload);
        logger.debug('Tokens gerados com sucesso', { userId: user.id });
      } catch (tokenError: any) {
        logger.error('Erro ao gerar tokens JWT', {
          error: tokenError?.message || String(tokenError),
          stack: tokenError?.stack,
          userId: user.id,
          jwtSecretDefined: !!process.env.JWT_SECRET,
          jwtRefreshSecretDefined: !!process.env.JWT_REFRESH_SECRET,
        });
        throw new AppError('Erro ao gerar token de autenticação', 500);
      }

      const authz = await authorizationService.resolveContext(user.id);
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          enabledModules: user.enabledModules,
          effectiveModules: getEffectiveModules(user.role, user.enabledModules),
          effectivePermissions: authz?.permissions || [],
          entitlements: authz?.entitlements || [],
        },
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      // Se já for AppError, re-lançar
      if (error instanceof AppError) {
        throw error;
      }
      // Logar erro inesperado com mais detalhes
      logger.error('Erro inesperado no login', {
        error: error?.message || String(error),
        stack: error?.stack,
        email: data.email,
        errorName: error?.name,
        errorCode: error?.code,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      throw new AppError('Erro interno ao processar login', 500);
    }
  },
};
