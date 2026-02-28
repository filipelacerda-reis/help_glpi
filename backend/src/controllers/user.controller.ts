import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { z } from 'zod';
import { AccessLevel, ModuleKey, SubmoduleKey, UserRole } from '@prisma/client';

const entitlementSchema = z.object({
  module: z.nativeEnum(ModuleKey),
  submodule: z.nativeEnum(SubmoduleKey),
  level: z.nativeEnum(AccessLevel),
});

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role: z.nativeEnum(UserRole),
  department: z.string().optional(),
  enabledModules: z.array(z.string()).optional(),
  entitlements: z.array(entitlementSchema).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(UserRole).optional(),
  department: z.string().optional().nullable(),
  active: z.boolean().optional(),
  enabledModules: z.array(z.string()).optional(),
  entitlements: z.array(entitlementSchema).optional(),
});

export const userController = {
  async getCurrentUser(req: Request, res: Response) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const user = await userService.getCurrentUser(req.userId);
    res.json(user);
  },

  async getAllUsers(req: Request, res: Response) {
    const filters: any = {};
    if (req.query.role) {
      filters.role = req.query.role;
    }
    if (req.query.department) {
      filters.department = req.query.department;
    }

    const users = await userService.getAllUsers(filters);
    res.json(users);
  },

  async getUserById(req: Request, res: Response) {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    res.json(user);
  },

  async createUser(req: Request, res: Response) {
    const data = createUserSchema.parse(req.body);
    const user = await userService.createUser(data);
    res.status(201).json(user);
  },

  async updateUser(req: Request, res: Response) {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(id, data);
    res.json(user);
  },

  async deleteUser(req: Request, res: Response) {
    const { id } = req.params;
    await userService.deleteUser(id);
    res.status(204).send();
  },
};
