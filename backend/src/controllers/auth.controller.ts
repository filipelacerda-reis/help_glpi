import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { z, ZodError } from 'zod';
import { AppError, ErrorType } from '../middleware/errorHandler';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role: z.enum(['REQUESTER', 'TECHNICIAN', 'TRIAGER', 'ADMIN']).optional(),
  department: z.string().optional(),
  enabledModules: z.array(z.string()).optional(),
});

export const authController = {
  async login(req: Request, res: Response) {
    // Usar safeParse para evitar try/catch e deixar express-async-errors capturar
    const validationResult = loginSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map((err) => {
        if (err.path.includes('email')) {
          return 'Email inválido. Por favor, informe um email válido.';
        }
        if (err.path.includes('password')) {
          return err.message;
        }
        return err.message;
      });
      throw new AppError(errorMessages.join(', '), 400, ErrorType.VALIDATION_ERROR);
    }

    const result = await authService.login(validationResult.data);
    res.json(result);
  },

  async register(req: Request, res: Response) {
    // Usar safeParse para evitar try/catch e deixar express-async-errors capturar
    const validationResult = registerSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map((err) => {
        if (err.path.includes('email')) {
          return 'Email inválido. Por favor, informe um email válido.';
        }
        if (err.path.includes('password')) {
          return err.message;
        }
        if (err.path.includes('name')) {
          return err.message;
        }
        return err.message;
      });
      throw new AppError(errorMessages.join(', '), 400, ErrorType.VALIDATION_ERROR);
    }

    const result = await authService.register(validationResult.data);
    res.status(201).json(result);
  },
};
