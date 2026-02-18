import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userService, User } from '../services/user.service';
import ModernLayout from '../components/ModernLayout';
import DarkModal from '../components/DarkModal';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { getDefaultModulesByRole, MODULE_LABELS, PLATFORM_MODULES, PlatformModule, UserRole } from '../config/modules';
import {
  EntitlementCatalogEntry,
  ModuleKey,
  UserEntitlement,
} from '../config/entitlements';
import { adminEntitlementsService } from '../services/adminEntitlements.service';

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: string;
  enabledModules: PlatformModule[];
  entitlements: UserEntitlement[];
};

const EMPTY_FORM: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'REQUESTER',
  department: '',
  enabledModules: getDefaultModulesByRole('REQUESTER') as PlatformModule[],
  entitlements: [],
};

const groupByModule = (catalog: EntitlementCatalogEntry[]) => {
  const groups: Record<ModuleKey, EntitlementCatalogEntry[]> = {
    ADMIN: [],
    ITSM: [],
    HR: [],
    FINANCE: [],
    ASSETS: [],
    COMPLIANCE: [],
  };

  for (const entry of catalog) {
    groups[entry.module].push(entry);
  }

  return groups;
};

const setEntitlementLevel = (
  current: UserEntitlement[],
  entry: EntitlementCatalogEntry,
  level: 'NONE' | 'READ' | 'WRITE'
) => {
  const filtered = current.filter(
    (item) => !(item.module === entry.module && item.submodule === entry.submodule)
  );

  if (level === 'NONE') {
    return filtered;
  }

  return [...filtered, { module: entry.module, submodule: entry.submodule, level }];
};

const getEntitlementLevel = (entitlements: UserEntitlement[], entry: EntitlementCatalogEntry) => {
  const found = entitlements.find(
    (item) => item.module === entry.module && item.submodule === entry.submodule
  );
  return found?.level || 'NONE';
};

const defaultEntitlementsByRole = (
  role: UserRole,
  catalog: EntitlementCatalogEntry[]
): UserEntitlement[] => {
  if (catalog.length === 0) return [];

  if (role === 'ADMIN') {
    return catalog.map((entry) => ({
      module: entry.module,
      submodule: entry.submodule,
      level: 'WRITE',
    }));
  }

  const allow = (module: ModuleKey, level: 'READ' | 'WRITE') =>
    catalog
      .filter((entry) => entry.module === module)
      .map((entry) => ({ module: entry.module, submodule: entry.submodule, level } as UserEntitlement));

  if (role === 'TRIAGER') {
    return [...allow('ITSM', 'WRITE'), ...allow('ASSETS', 'WRITE')];
  }

  if (role === 'TECHNICIAN') {
    return catalog
      .filter((entry) => ['ITSM_TICKETS', 'ASSETS_EQUIPMENT', 'ASSETS_ASSIGNMENTS'].includes(entry.submodule))
      .map((entry) => ({
        module: entry.module,
        submodule: entry.submodule,
        level: entry.submodule === 'ITSM_TICKETS' ? 'WRITE' : 'READ',
      }));
  }

  return catalog
    .filter((entry) => ['ITSM_TICKETS', 'HR_POLICIES', 'ASSETS_ASSIGNMENTS'].includes(entry.submodule))
    .map((entry) => ({
      module: entry.module,
      submodule: entry.submodule,
      level: entry.submodule === 'ITSM_TICKETS' ? 'WRITE' : 'READ',
    }));
};

const UsersPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormState>(EMPTY_FORM);
  const [editFormData, setEditFormData] = useState<UserFormState>(EMPTY_FORM);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [entitlementCatalog, setEntitlementCatalog] = useState<EntitlementCatalogEntry[]>([]);

  const entitlementGroups = useMemo(() => groupByModule(entitlementCatalog), [entitlementCatalog]);

  useEffect(() => {
    loadUsers();
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      const catalog = await adminEntitlementsService.getEntitlementCatalog();
      setEntitlementCatalog(catalog);
      setFormData((prev) => ({
        ...prev,
        entitlements: defaultEntitlementsByRole(prev.role, catalog),
      }));
      setEditFormData((prev) => ({
        ...prev,
        entitlements: defaultEntitlementsByRole(prev.role, catalog),
      }));
    } catch {
      setError('Erro ao carregar catálogo de permissões');
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await userService.getAllUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await userService.createUser(formData);
      setShowCreateModal(false);
      setFormData({
        ...EMPTY_FORM,
        enabledModules: getDefaultModulesByRole('REQUESTER'),
        entitlements: defaultEntitlementsByRole('REQUESTER', entitlementCatalog),
      });
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar usuário');
    }
  };

  const handleEditUser = (targetUser: User) => {
    setEditingUser(targetUser);
    setEditFormData({
      name: targetUser.name,
      email: targetUser.email,
      password: '',
      role: targetUser.role as UserRole,
      department: targetUser.department || '',
      enabledModules:
        targetUser.enabledModules?.length
          ? targetUser.enabledModules
          : getDefaultModulesByRole(targetUser.role as UserRole),
      entitlements:
        targetUser.entitlements?.length
          ? targetUser.entitlements
          : defaultEntitlementsByRole(targetUser.role as UserRole, entitlementCatalog),
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError('');

    try {
      const updateData: any = {
        name: editFormData.name,
        email: editFormData.email,
        role: editFormData.role,
        department: editFormData.department || null,
        enabledModules: editFormData.enabledModules,
        entitlements: editFormData.entitlements,
      };

      if (editFormData.password) {
        updateData.password = editFormData.password;
      }

      await userService.updateUser(editingUser.id, updateData);
      setShowEditModal(false);
      setEditingUser(null);
      setEditFormData({
        ...EMPTY_FORM,
        enabledModules: getDefaultModulesByRole('REQUESTER'),
        entitlements: defaultEntitlementsByRole('REQUESTER', entitlementCatalog),
      });
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar usuário');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await userService.deleteUser(id);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir usuário');
    }
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

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      REQUESTER: 'bg-blue-500/30 text-blue-400',
      TECHNICIAN: 'bg-green-500/30 text-green-400',
      TRIAGER: 'bg-yellow-500/30 text-yellow-400',
      ADMIN: 'bg-red-500/30 text-red-400',
    };
    return colors[role] || 'bg-gray-600/50 text-gray-300';
  };

  const handleRoleChange = (target: 'create' | 'edit', role: UserRole) => {
    const defaults = getDefaultModulesByRole(role);
    const defaultEntitlements = defaultEntitlementsByRole(role, entitlementCatalog);

    if (target === 'create') {
      setFormData((prev) => ({ ...prev, role, enabledModules: defaults, entitlements: defaultEntitlements }));
      return;
    }

    setEditFormData((prev) => ({
      ...prev,
      role,
      enabledModules: defaults,
      entitlements: defaultEntitlements,
    }));
  };

  const toggleModule = (target: 'create' | 'edit', module: PlatformModule) => {
    if (target === 'create') {
      if (formData.role === 'ADMIN') return;
      setFormData((prev) => {
        const exists = prev.enabledModules.includes(module);
        return {
          ...prev,
          enabledModules: exists
            ? prev.enabledModules.filter((m) => m !== module)
            : [...prev.enabledModules, module],
        };
      });
      return;
    }

    if (editFormData.role === 'ADMIN') return;
    setEditFormData((prev) => {
      const exists = prev.enabledModules.includes(module);
      return {
        ...prev,
        enabledModules: exists
          ? prev.enabledModules.filter((m) => m !== module)
          : [...prev.enabledModules, module],
      };
    });
  };

  const updateEntitlement = (
    target: 'create' | 'edit',
    entry: EntitlementCatalogEntry,
    level: 'NONE' | 'READ' | 'WRITE'
  ) => {
    if (target === 'create') {
      setFormData((prev) => ({
        ...prev,
        entitlements: setEntitlementLevel(prev.entitlements, entry, level),
      }));
      return;
    }

    setEditFormData((prev) => ({
      ...prev,
      entitlements: setEntitlementLevel(prev.entitlements, entry, level),
    }));
  };

  const headerActions = (
    <button
      onClick={() => setShowCreateModal(true)}
      className="inline-flex items-center space-x-2 px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span>Criar Novo Usuário</span>
    </button>
  );

  const resetCreateForm = () => {
    setShowCreateModal(false);
    setFormData({
      ...EMPTY_FORM,
      enabledModules: getDefaultModulesByRole('REQUESTER'),
      entitlements: defaultEntitlementsByRole('REQUESTER', entitlementCatalog),
    });
  };

  const resetEditForm = () => {
    setShowEditModal(false);
    setEditingUser(null);
    setEditFormData({
      ...EMPTY_FORM,
      enabledModules: getDefaultModulesByRole('REQUESTER'),
      entitlements: defaultEntitlementsByRole('REQUESTER', entitlementCatalog),
    });
  };

  if (loading || catalogLoading) {
    return (
      <ModernLayout title="Usuários" subtitle="Gerenciar usuários do sistema" headerActions={headerActions}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-gray-400">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  if (user?.role !== 'ADMIN') {
    return (
      <ModernLayout title="Usuários" subtitle="Gerenciar usuários do sistema" headerActions={headerActions}>
        <div className="text-center py-12">
          <p className="text-red-400">Acesso negado. Apenas administradores podem acessar esta página.</p>
        </div>
      </ModernLayout>
    );
  }

  const renderEntitlementEditor = (
    target: 'create' | 'edit',
    currentEntitlements: UserEntitlement[],
    readOnly: boolean
  ) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-300">Acesso por módulo/submódulo</label>
        <span className="text-xs text-gray-400">{currentEntitlements.length} submódulo(s) com acesso</span>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-600/50 bg-gray-800/40 p-3 space-y-3">
        {(Object.keys(entitlementGroups) as ModuleKey[]).map((moduleKey) => {
          const entries = entitlementGroups[moduleKey];
          if (entries.length === 0) return null;

          return (
            <div key={moduleKey}>
              <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">{moduleKey}</h4>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const level = getEntitlementLevel(currentEntitlements, entry);
                  return (
                    <div key={entry.submodule} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                      <span className="text-sm text-gray-200">{entry.label}</span>
                      <select
                        value={level}
                        disabled={readOnly}
                        onChange={(e) =>
                          updateEntitlement(target, entry, e.target.value as 'NONE' | 'READ' | 'WRITE')
                        }
                        className="md:col-span-2 block w-full bg-gray-700/60 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
                      >
                        <option value="NONE">Sem acesso</option>
                        <option value="READ">READ</option>
                        <option value="WRITE">WRITE</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <ModernLayout title="Usuários" subtitle="Gerenciar usuários do sistema" headerActions={headerActions}>
      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-600/50">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Papel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Departamento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Módulos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Submódulos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Criado em</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-gray-700/20 divide-y divide-gray-600/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{u.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{u.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(u.role)}`}>
                      {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{u.department || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{u.effectiveModules?.length || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{u.entitlements?.length || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditUser(u)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <div className="text-center py-12 text-gray-400">Nenhum usuário encontrado</div>}
      </div>

      <DarkModal isOpen={showCreateModal} onClose={resetCreateForm} title="Criar Novo Usuário">
        <form onSubmit={handleCreateUser}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nome <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Senha <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Papel <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.role}
                onChange={(e) => handleRoleChange('create', e.target.value as UserRole)}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              >
                <option value="REQUESTER">Solicitante</option>
                <option value="TECHNICIAN">Técnico</option>
                <option value="TRIAGER">Triagista</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Departamento</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Módulos liberados (legado)</label>
                <span className="text-xs text-gray-400">
                  {formData.role === 'ADMIN' ? 'Administrador tem acesso total' : `${formData.enabledModules.length} selecionado(s)`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto rounded-lg border border-gray-600/50 bg-gray-800/40 p-3">
                {PLATFORM_MODULES.map((moduleKey) => (
                  <label
                    key={moduleKey}
                    className={`flex items-center gap-2 text-sm ${
                      formData.role === 'ADMIN' ? 'text-gray-500' : 'text-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.role === 'ADMIN' || formData.enabledModules.includes(moduleKey)}
                      disabled={formData.role === 'ADMIN'}
                      onChange={() => toggleModule('create', moduleKey)}
                      className="rounded border-gray-500 bg-gray-700 text-etus-green focus:ring-etus-green"
                    />
                    <span>{MODULE_LABELS[moduleKey]}</span>
                  </label>
                ))}
              </div>
            </div>

            {renderEntitlementEditor('create', formData.entitlements, formData.role === 'ADMIN')}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={resetCreateForm}
                className="px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
              >
                Criar
              </button>
            </div>
          </div>
        </form>
      </DarkModal>

      <DarkModal isOpen={showEditModal} onClose={resetEditForm} title="Editar Usuário">
        <form onSubmit={handleUpdateUser}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nome <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nova Senha</label>
              <input
                type="password"
                minLength={6}
                value={editFormData.password}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
                placeholder="Deixe em branco para manter a senha atual"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Papel <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={editFormData.role}
                onChange={(e) => handleRoleChange('edit', e.target.value as UserRole)}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              >
                <option value="REQUESTER">Solicitante</option>
                <option value="TECHNICIAN">Técnico</option>
                <option value="TRIAGER">Triagista</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Departamento</label>
              <input
                type="text"
                value={editFormData.department}
                onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Módulos liberados (legado)</label>
                <span className="text-xs text-gray-400">
                  {editFormData.role === 'ADMIN' ? 'Administrador tem acesso total' : `${editFormData.enabledModules.length} selecionado(s)`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto rounded-lg border border-gray-600/50 bg-gray-800/40 p-3">
                {PLATFORM_MODULES.map((moduleKey) => (
                  <label
                    key={moduleKey}
                    className={`flex items-center gap-2 text-sm ${
                      editFormData.role === 'ADMIN' ? 'text-gray-500' : 'text-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editFormData.role === 'ADMIN' || editFormData.enabledModules.includes(moduleKey)}
                      disabled={editFormData.role === 'ADMIN'}
                      onChange={() => toggleModule('edit', moduleKey)}
                      className="rounded border-gray-500 bg-gray-700 text-etus-green focus:ring-etus-green"
                    />
                    <span>{MODULE_LABELS[moduleKey]}</span>
                  </label>
                ))}
              </div>
            </div>

            {renderEntitlementEditor('edit', editFormData.entitlements, editFormData.role === 'ADMIN')}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={resetEditForm}
                className="px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </form>
      </DarkModal>
    </ModernLayout>
  );
};

export default UsersPage;
