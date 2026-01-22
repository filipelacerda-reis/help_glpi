import { api } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN';
  department?: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  role?: 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN';
  department?: string | null;
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

