import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userService, User } from '../services/user.service';
import ModernLayout from '../components/ModernLayout';
import DarkModal from '../components/DarkModal';
import { Plus, Edit, Trash2 } from 'lucide-react';

const UsersPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'REQUESTER' as 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN',
    department: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'REQUESTER' as 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN',
    department: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

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
        name: '',
        email: '',
        password: '',
        role: 'REQUESTER',
        department: '',
      });
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar usuário');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role as 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN',
      department: user.department || '',
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
      };

      if (editFormData.password) {
        updateData.password = editFormData.password;
      }

      await userService.updateUser(editingUser.id, updateData);
      setShowEditModal(false);
      setEditingUser(null);
      setEditFormData({
        name: '',
        email: '',
        password: '',
        role: 'REQUESTER',
        department: '',
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

  const headerActions = (
    <button
      onClick={() => setShowCreateModal(true)}
      className="inline-flex items-center space-x-2 px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span>Criar Novo Usuário</span>
    </button>
  );

  if (loading) {
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Papel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Departamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-700/20 divide-y divide-gray-600/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {u.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {u.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(u.role)}`}>
                      {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {u.department || '-'}
                  </td>
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
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Nenhum usuário encontrado
          </div>
        )}
      </div>

      {/* Modal Criar Usuário */}
      <DarkModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormData({
            name: '',
            email: '',
            password: '',
            role: 'REQUESTER',
            department: '',
          });
        }}
        title="Criar Novo Usuário"
      >
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
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value as 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN',
                  })
                }
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              >
                <option value="REQUESTER">Solicitante</option>
                <option value="TECHNICIAN">Técnico</option>
                <option value="TRIAGER">Triagista</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Departamento
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    name: '',
                    email: '',
                    password: '',
                    role: 'REQUESTER',
                    department: '',
                  });
                }}
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

      {/* Modal Editar Usuário */}
      <DarkModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
          setEditFormData({
            name: '',
            email: '',
            password: '',
            role: 'REQUESTER',
            department: '',
          });
        }}
        title="Editar Usuário"
      >
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nova Senha
              </label>
              <input
                type="password"
                minLength={6}
                value={editFormData.password}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
                placeholder="Deixe em branco para manter a senha atual"
              />
              <p className="mt-1 text-xs text-gray-400">
                Deixe em branco para manter a senha atual
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Papel <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={editFormData.role}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    role: e.target.value as 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN',
                  })
                }
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              >
                <option value="REQUESTER">Solicitante</option>
                <option value="TECHNICIAN">Técnico</option>
                <option value="TRIAGER">Triagista</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Departamento
              </label>
              <input
                type="text"
                value={editFormData.department}
                onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                  setEditFormData({
                    name: '',
                    email: '',
                    password: '',
                    role: 'REQUESTER',
                    department: '',
                  });
                }}
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
