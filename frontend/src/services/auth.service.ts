import { api } from './api';
import { PlatformModule } from '../config/modules';
import { UserEntitlement } from '../config/entitlements';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  role?: string;
  department?: string;
  enabledModules?: PlatformModule[];
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string | null;
    enabledModules: PlatformModule[];
    effectiveModules: PlatformModule[];
    effectivePermissions?: string[];
    entitlements?: UserEntitlement[];
  };
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  async login(data: LoginDto): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  async register(data: RegisterDto): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/users/me');
    return response.data;
  },
};
