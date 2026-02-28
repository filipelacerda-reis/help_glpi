import { api } from './api';
import { PlatformModule } from '../config/modules';
import { UserEntitlement } from '../config/entitlements';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  active: boolean;
  enabledModules: PlatformModule[];
  effectiveModules: PlatformModule[];
  entitlements?: UserEntitlement[];
  effectivePermissions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN';
  department?: string;
  enabledModules?: PlatformModule[];
  entitlements?: UserEntitlement[];
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  role?: 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN';
  department?: string | null;
  active?: boolean;
  enabledModules?: PlatformModule[];
  entitlements?: UserEntitlement[];
}

export const userService = {
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/users/me');
    return response.data;
  },

  async getAllUsers(): Promise<User[]> {
    const response = await api.get<User[]>('/users');
    return response.data;
  },

  async getUserById(id: string): Promise<User> {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  async createUser(data: CreateUserDto): Promise<User> {
    const response = await api.post<User>('/users', data);
    return response.data;
  },

  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const response = await api.patch<User>(`/users/${id}`, data);
    return response.data;
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
