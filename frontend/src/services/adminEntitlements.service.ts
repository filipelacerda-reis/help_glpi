import { api } from './api';
import { EntitlementCatalogEntry, UserEntitlement } from '../config/entitlements';

export type PermissionCatalogEntry = { key: string };

export const adminEntitlementsService = {
  async getPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
    const response = await api.get<PermissionCatalogEntry[]>('/admin/permission-catalog');
    return response.data;
  },

  async getEntitlementCatalog(): Promise<EntitlementCatalogEntry[]> {
    const response = await api.get<EntitlementCatalogEntry[]>('/admin/entitlement-catalog');
    return response.data;
  },

  async getUserEntitlements(userId: string): Promise<UserEntitlement[]> {
    const response = await api.get<UserEntitlement[]>(`/admin/users/${userId}/entitlements`);
    return response.data;
  },

  async replaceUserEntitlements(userId: string, entitlements: UserEntitlement[]): Promise<UserEntitlement[]> {
    const response = await api.put<UserEntitlement[]>(`/admin/users/${userId}/entitlements`, { entitlements });
    return response.data;
  },
};

