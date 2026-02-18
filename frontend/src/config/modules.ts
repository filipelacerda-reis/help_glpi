export const PLATFORM_MODULES = [
  'DASHBOARD',
  'TICKETS',
  'NOTIFICATIONS',
  'JOURNAL',
  'EMPLOYEES',
  'EQUIPMENTS',
  'METRICS',
  'KB',
  'SLA',
  'AUTOMATIONS',
  'TEAMS',
  'USERS',
  'TAGS',
  'CATEGORIES',
  'ADMIN',
  'FINANCE',
  'HR',
  'PROCUREMENT',
] as const;

export type PlatformModule = (typeof PLATFORM_MODULES)[number];
export type UserRole = 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN';

export const MODULE_LABELS: Record<PlatformModule, string> = {
  DASHBOARD: 'Dashboard',
  TICKETS: 'Chamados',
  NOTIFICATIONS: 'Notificações',
  JOURNAL: 'Meu Diário',
  EMPLOYEES: 'Funcionários',
  EQUIPMENTS: 'Equipamentos',
  METRICS: 'Métricas',
  KB: 'Base de Conhecimento',
  SLA: 'SLA',
  AUTOMATIONS: 'Automações',
  TEAMS: 'Times',
  USERS: 'Usuários',
  TAGS: 'Tags',
  CATEGORIES: 'Categorias',
  ADMIN: 'Administração',
  FINANCE: 'Financeiro',
  HR: 'Recursos Humanos',
  PROCUREMENT: 'Compras',
};

const DEFAULT_MODULES_BY_ROLE: Record<UserRole, PlatformModule[]> = {
  REQUESTER: ['DASHBOARD', 'TICKETS', 'NOTIFICATIONS'],
  TECHNICIAN: ['DASHBOARD', 'TICKETS', 'NOTIFICATIONS', 'JOURNAL'],
  TRIAGER: ['DASHBOARD', 'TICKETS', 'NOTIFICATIONS', 'JOURNAL', 'EMPLOYEES', 'EQUIPMENTS', 'KB', 'METRICS'],
  ADMIN: [...PLATFORM_MODULES],
};

export function getDefaultModulesByRole(role: UserRole): PlatformModule[] {
  return [...DEFAULT_MODULES_BY_ROLE[role]];
}
