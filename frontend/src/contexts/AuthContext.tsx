import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, AuthResponse } from '../services/auth.service';
import { PlatformModule } from '../config/modules';
import {
  AccessLevel,
  ModuleKey,
  SubmoduleKey,
  UserEntitlement,
  hasEntitlement as checkEntitlement,
} from '../config/entitlements';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  active?: boolean;
  enabledModules: PlatformModule[];
  effectiveModules: PlatformModule[];
  effectivePermissions?: string[];
  entitlements?: UserEntitlement[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasModule: (module: PlatformModule) => boolean;
  hasPermission: (permission: string) => boolean;
  hasEntitlement: (module: ModuleKey, submodule: SubmoduleKey, level?: AccessLevel) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response: AuthResponse = await authService.login({ email, password });
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const response: AuthResponse = await authService.register({ name, email, password });
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasModule = (module: PlatformModule) => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return user.effectiveModules?.includes(module) ?? false;
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return user.effectivePermissions?.includes(permission) ?? false;
  };

  const hasEntitlement = (module: ModuleKey, submodule: SubmoduleKey, level: AccessLevel = 'READ') => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return checkEntitlement(user.entitlements, module, submodule, level);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        hasModule,
        hasPermission,
        hasEntitlement,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
