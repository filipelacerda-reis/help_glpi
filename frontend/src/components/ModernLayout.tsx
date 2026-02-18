import { useState, ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { teamService } from '../services/team.service';
import NotificationBell from './NotificationBell';
import {
  ChevronDown,
  ChevronRight,
  Home,
  FileText,
  BarChart3,
  FolderKanban,
  Target,
  Tag,
  Layers,
  UserCog,
  UsersRound,
  Briefcase,
  Laptop,
  Zap,
  Bell,
  LogOut,
  BookOpen,
  Settings,
  Wallet,
  Users,
  ShoppingCart,
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
  icon: any;
  roles: string[];
  module: PlatformModule;
  moduleKey?: ModuleKey;
  submoduleKey?: SubmoduleKey;
  allowTeamLead?: boolean;
};

type MenuSection = {
  id: string;
  label: string;
  items: MenuItem[];
};

const ModernLayout = ({
  children,
  title,
  subtitle,
  headerActions,
  rightSidebar,
  showRightSidebar = false,
}: ModernLayoutProps) => {
  const { user, logout, hasModule, hasEntitlement } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    operations: true,
    assets: true,
    corporate: true,
    governance: true,
    admin: true,
  });

  // Verificar se o usuário é líder de algum time
  useEffect(() => {
    const checkTeamLead = async () => {
      if (user?.role === 'ADMIN') {
        setIsTeamLead(true);
        return;
      }
      try {
        const leadTeamIds = await teamService.getUserLeadTeams();
        setIsTeamLead(leadTeamIds.length > 0);
      } catch (error) {
        console.error('Erro ao verificar times do líder:', error);
        setIsTeamLead(false);
      }
    };

    if (user) {
      checkTeamLead();
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      REQUESTER: 'Solicitante',
      TECHNICIAN: 'Técnico',
      TRIAGER: 'Triagista',
      ADMIN: 'Administrador',
    };
    return labels[role] || role;
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const menuItems: MenuItem[] = [
    { path: '/', label: 'Dashboard', icon: Home, roles: ['ADMIN', 'TRIAGER', 'TECHNICIAN', 'REQUESTER'], module: 'DASHBOARD' },
    { path: '/tickets', label: 'Tickets', icon: FileText, roles: ['ADMIN', 'TRIAGER', 'TECHNICIAN', 'REQUESTER'], module: 'TICKETS' },
    { path: '/my/journal', label: 'Meu Diário', icon: BookOpen, roles: ['ADMIN', 'TRIAGER', 'TECHNICIAN'], module: 'JOURNAL' },
    { path: '/notifications', label: 'Notificações', icon: Bell, roles: ['ADMIN', 'TRIAGER', 'TECHNICIAN', 'REQUESTER'], module: 'NOTIFICATIONS' },
    { path: '/employees', label: 'Funcionários', icon: Briefcase, roles: ['ADMIN', 'TRIAGER', 'TECHNICIAN'], module: 'EMPLOYEES', moduleKey: 'HR', submoduleKey: 'HR_EMPLOYEES' },
    { path: '/equipments', label: 'Equipamentos', icon: Laptop, roles: ['ADMIN', 'TRIAGER', 'TECHNICIAN'], module: 'EQUIPMENTS', moduleKey: 'ASSETS', submoduleKey: 'ASSETS_EQUIPMENT' },
    { path: '/metrics', label: 'Métricas', icon: BarChart3, roles: ['ADMIN'], module: 'METRICS', allowTeamLead: true },
    { path: '/kb', label: 'Base de Conhecimento', icon: FolderKanban, roles: ['ADMIN', 'TRIAGER'], module: 'KB' },
    { path: '/sla', label: 'SLA', icon: Target, roles: ['ADMIN'], module: 'SLA' },
    { path: '/teams', label: 'Times', icon: UsersRound, roles: ['ADMIN'], module: 'TEAMS' },
    { path: '/users', label: 'Usuários', icon: UserCog, roles: ['ADMIN'], module: 'USERS', moduleKey: 'ADMIN', submoduleKey: 'ADMIN_USERS' },
    { path: '/tags', label: 'Tags', icon: Tag, roles: ['ADMIN'], module: 'TAGS' },
    { path: '/categories', label: 'Categorias', icon: Layers, roles: ['ADMIN'], module: 'CATEGORIES' },
    { path: '/automations', label: 'Automações', icon: Zap, roles: ['ADMIN'], module: 'AUTOMATIONS' },
    { path: '/admin/sso', label: 'Administração', icon: Settings, roles: ['ADMIN'], module: 'ADMIN', moduleKey: 'ADMIN', submoduleKey: 'ADMIN_SSO' },
    { path: '/finance', label: 'Financeiro', icon: Wallet, roles: ['ADMIN', 'TRIAGER'], module: 'FINANCE', moduleKey: 'FINANCE', submoduleKey: 'FINANCE_REPORTS' },
    { path: '/hr', label: 'RH', icon: Users, roles: ['ADMIN', 'TRIAGER'], module: 'HR', moduleKey: 'HR', submoduleKey: 'HR_REPORTS' },
    { path: '/procurement', label: 'Compras', icon: ShoppingCart, roles: ['ADMIN', 'TRIAGER'], module: 'PROCUREMENT', moduleKey: 'FINANCE', submoduleKey: 'FINANCE_PURCHASE_REQUESTS' },
  ];

  const hasAccess = (item: MenuItem) => {
    if (!user?.role) return false;
    const entitlementAllowed =
      item.moduleKey && item.submoduleKey
        ? hasEntitlement(item.moduleKey, item.submoduleKey, 'READ')
        : false;
    if (!hasModule(item.module) && !entitlementAllowed) return false;
    if (item.allowTeamLead && !item.roles.includes(user.role)) {
      return isTeamLead;
    }
    return item.roles.includes(user.role);
  };

  const getItem = (path: string) => menuItems.find((item) => item.path === path)!;

  const menuSections: MenuSection[] = [
    {
      id: 'operations',
      label: 'Operação',
      items: [getItem('/'), getItem('/tickets'), getItem('/my/journal'), getItem('/notifications')],
    },
    {
      id: 'assets',
      label: 'Ativos e Pessoas',
      items: [getItem('/employees'), getItem('/equipments')],
    },
    {
      id: 'governance',
      label: 'Conhecimento e Qualidade',
      items: [getItem('/kb'), getItem('/sla'), getItem('/metrics')],
    },
    {
      id: 'corporate',
      label: 'Corporativo',
      items: [getItem('/finance'), getItem('/hr'), getItem('/procurement')],
    },
    {
      id: 'admin',
      label: 'Administração da Plataforma',
      items: [
        getItem('/teams'),
        getItem('/users'),
        getItem('/tags'),
        getItem('/categories'),
        getItem('/automations'),
        getItem('/admin/sso'),
      ],
    },
  ];

  const filteredMenuItems = menuItems.filter(hasAccess);
  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter(hasAccess),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    setOpenSections((prev) => {
      const next = { ...prev };
      for (const section of visibleSections) {
        if (section.items.some((item) => isActive(item.path))) {
          next[section.id] = true;
        }
      }
      return next;
    });
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
      {/* Sidebar Esquerda */}
      <div
        className={`${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } bg-gray-800/50 backdrop-blur-sm border-r border-gray-700/50 transition-all duration-300 flex flex-col`}
      >
        {/* Logo/Header */}
        <div className="p-4 border-b border-gray-700/50">
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-etus-green rounded-lg flex items-center justify-center">
                  <span className="text-gray-900 font-bold text-sm">E</span>
                </div>
                <span className="text-lg font-bold text-white">GLPI ETUS</span>
              </Link>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
              >
                <div className="w-5 h-5 flex flex-col justify-center space-y-1">
                  <div className="w-full h-0.5 bg-gray-300"></div>
                  <div className="w-full h-0.5 bg-gray-300"></div>
                  <div className="w-full h-0.5 bg-gray-300"></div>
                </div>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                <div className="w-full h-0.5 bg-gray-300"></div>
                <div className="w-full h-0.5 bg-gray-300"></div>
                <div className="w-full h-0.5 bg-gray-300"></div>
              </div>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          {sidebarCollapsed ? (
            <div className="space-y-1">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-center p-3 rounded-lg transition-colors ${
                      active
                        ? 'bg-etus-green/30 text-etus-green'
                        : 'hover:bg-etus-green/20 hover:text-etus-green text-gray-300'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {visibleSections.map((section) => {
                const sectionOpen = openSections[section.id] ?? true;
                return (
                  <div key={section.id} className="rounded-lg border border-gray-700/50 bg-gray-800/40">
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase tracking-wide text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      <span>{section.label}</span>
                      {sectionOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {sectionOpen && (
                      <div className="px-2 pb-2 space-y-1">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const active = isActive(item.path);
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                                active
                                  ? 'bg-etus-green/25 text-etus-green border border-etus-green/25'
                                  : 'text-gray-300 hover:bg-etus-green/15 hover:text-etus-green'
                              }`}
                              title={item.label}
                            >
                              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                              <span className="text-sm">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-700/50">
          {!sidebarCollapsed ? (
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-etus-green to-etus-green-dark flex items-center justify-center text-gray-900 font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-gray-400 truncate">{getRoleLabel(user?.role || '')}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-etus-green to-etus-green-dark flex items-center justify-center text-gray-900 font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <NotificationBell />
            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            )}
            {sidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="w-full p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4 mx-auto" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Área Central */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {(title || headerActions) && (
          <div className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700/50 p-4">
            <div className="flex justify-between items-center">
              <div>
                {title && <h1 className="text-2xl font-bold text-white">{title}</h1>}
                {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
              </div>
              {headerActions && <div className="flex gap-2">{headerActions}</div>}
            </div>
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">{children}</div>
        </div>
      </div>

      {/* Sidebar Direita (opcional) */}
      {showRightSidebar && rightSidebar && (
        <div className="w-80 bg-gray-800/50 backdrop-blur-sm border-l border-gray-700/50 p-6 overflow-y-auto">
          {rightSidebar}
        </div>
      )}
    </div>
  );
};

export default ModernLayout;
