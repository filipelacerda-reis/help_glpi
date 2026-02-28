import { ReactNode, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import { FloatingChatWidget } from './FloatingChatWidget';
import {
  Home,
  Ticket,
  BarChart3,
  Users,
  Tags,
  FolderKanban,
  Bell,
  BookOpen,
  Building2,
  Laptop,
  Wallet,
  ShoppingCart,
  Shield,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { PlatformModule } from '../config/modules';
import { ModuleKey, SubmoduleKey } from '../config/entitlements';

interface ModernLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  rightSidebar?: ReactNode;
  showRightSidebar?: boolean;
}

type MenuItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: PlatformModule;
  roles: Array<'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN'>;
  moduleKey?: ModuleKey;
  submoduleKey?: SubmoduleKey;
};

const menuItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: Home, module: 'DASHBOARD', roles: ['REQUESTER', 'TECHNICIAN', 'TRIAGER', 'ADMIN'] },
  { path: '/tickets', label: 'Tickets', icon: Ticket, module: 'TICKETS', roles: ['REQUESTER', 'TECHNICIAN', 'TRIAGER', 'ADMIN'] },
  { path: '/metrics', label: 'Métricas', icon: BarChart3, module: 'METRICS', roles: ['TECHNICIAN', 'TRIAGER', 'ADMIN'] },
  { path: '/teams', label: 'Times', icon: Users, module: 'TEAMS', roles: ['ADMIN'] },
  { path: '/users', label: 'Usuários', icon: Shield, module: 'USERS', roles: ['ADMIN'], moduleKey: 'ADMIN', submoduleKey: 'ADMIN_USERS' },
  { path: '/categories', label: 'Categorias', icon: FolderKanban, module: 'CATEGORIES', roles: ['ADMIN'] },
  { path: '/tags', label: 'Tags', icon: Tags, module: 'TAGS', roles: ['ADMIN'] },
  { path: '/notifications', label: 'Notificações', icon: Bell, module: 'NOTIFICATIONS', roles: ['REQUESTER', 'TECHNICIAN', 'TRIAGER', 'ADMIN'] },
  { path: '/my/journal', label: 'Meu Diário', icon: BookOpen, module: 'JOURNAL', roles: ['TECHNICIAN', 'TRIAGER', 'ADMIN'] },
  { path: '/employees', label: 'Funcionários', icon: Building2, module: 'EMPLOYEES', roles: ['TECHNICIAN', 'TRIAGER', 'ADMIN'], moduleKey: 'HR', submoduleKey: 'HR_EMPLOYEES' },
  { path: '/equipments', label: 'Equipamentos', icon: Laptop, module: 'EQUIPMENTS', roles: ['TECHNICIAN', 'TRIAGER', 'ADMIN'], moduleKey: 'ASSETS', submoduleKey: 'ASSETS_EQUIPMENT' },
  { path: '/finance', label: 'Financeiro', icon: Wallet, module: 'FINANCE', roles: ['TRIAGER', 'ADMIN'], moduleKey: 'FINANCE', submoduleKey: 'FINANCE_REPORTS' },
  { path: '/procurement', label: 'Compras', icon: ShoppingCart, module: 'PROCUREMENT', roles: ['TRIAGER', 'ADMIN'], moduleKey: 'FINANCE', submoduleKey: 'FINANCE_PURCHASE_REQUESTS' },
  { path: '/admin/sso', label: 'Administração', icon: Shield, module: 'ADMIN', roles: ['ADMIN'], moduleKey: 'ADMIN', submoduleKey: 'ADMIN_SSO' },
];

const ModernLayout = ({ children, title, subtitle, headerActions, rightSidebar, showRightSidebar = false }: ModernLayoutProps) => {
  const { user, logout, hasModule, hasEntitlement } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const allowedItems = useMemo(() => {
    if (!user) return [];
    return menuItems.filter((item) => {
      const roleAllowed = item.roles.includes(user.role as (typeof item.roles)[number]);
      const entitlementAllowed =
        item.moduleKey && item.submoduleKey ? hasEntitlement(item.moduleKey, item.submoduleKey, 'READ') : false;
      return roleAllowed && (hasModule(item.module) || entitlementAllowed);
    });
  }, [user, hasEntitlement, hasModule]);

  const active = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`));

  const breadcrumb = location.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1));

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <aside
        className={`h-full shrink-0 border-r border-slate-200 bg-white/90 backdrop-blur-xl transition-all duration-300 dark:border-slate-700 dark:bg-slate-800/80 ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
          {!collapsed && (
            <button onClick={() => navigate('/')} className="text-left">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Help GLPI</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Service Desk</p>
            </button>
          )}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="h-[calc(100%-8rem)] overflow-y-auto p-3">
          <ul className="space-y-1.5">
            {allowedItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      active(item.path)
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/70 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-700">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/80">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span>Início</span>
                {breadcrumb.map((b, index) => (
                  <span key={`${b}-${index}`} className="inline-flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    <span>{b}</span>
                  </span>
                ))}
              </div>
              <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{title || 'Help GLPI'}</h1>
              {subtitle && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>

            <div className="ml-4 flex items-center gap-3">
              {headerActions}
              <NotificationBell />
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="max-w-[120px] truncate text-xs font-medium text-slate-700 dark:text-slate-200">{user?.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{user?.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className={`mx-auto w-full max-w-[1600px] p-6 ${showRightSidebar ? 'grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]' : ''}`}>
            <div className="min-w-0">{children}</div>
            {showRightSidebar && rightSidebar && <aside className="hidden xl:block">{rightSidebar}</aside>}
          </div>
        </main>
      </div>
      <FloatingChatWidget />
    </div>
  );
};

export default ModernLayout;
