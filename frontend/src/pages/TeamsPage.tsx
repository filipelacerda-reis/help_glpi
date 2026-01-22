import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { teamService, Team, UserTeam } from '../services/team.service';
import { userService, User } from '../services/user.service';
import { categoryService, Category } from '../services/category.service';
import ModernLayout from '../components/ModernLayout';
import DarkModal from '../components/DarkModal';
import { Plus, UserPlus, Trash2, Edit2 } from 'lucide-react';

const TeamsPage = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryIds: [] as string[],
    ticketTypes: [] as string[],
  });
  const [memberData, setMemberData] = useState({
    userId: '',
    role: 'MEMBER' as 'MEMBER' | 'LEAD',
  });

  const ticketTypeOptions = [
    { value: 'INCIDENT', label: 'Incidente' },
    { value: 'SERVICE_REQUEST', label: 'Solicitação de Serviço' },
    { value: 'PROBLEM', label: 'Problema' },
    { value: 'CHANGE', label: 'Mudança' },
    { value: 'TASK', label: 'Tarefa' },
    { value: 'QUESTION', label: 'Dúvida' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [teamsData, usersData, categoriesData] = await Promise.all([
        teamService.getAllTeams(true),
        userService.getAllUsers(),
        categoryService.getAllCategories(false),
      ]);
      console.log('Teams loaded:', teamsData); // Debug
      console.log('First team categories:', teamsData[0]?.categories); // Debug
      console.log('First team ticketTypes:', teamsData[0]?.ticketTypes); // Debug
      setTeams(teamsData);
      setUsers(usersData);
      setCategories(categoriesData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      console.log('Dados sendo enviados para criar time:', formData); // Debug
      await teamService.createTeam(formData);
      setShowCreateModal(false);
      setFormData({ name: '', description: '', categoryIds: [], ticketTypes: [] });
      loadData();
    } catch (err: any) {
      console.error('Erro ao criar time:', err); // Debug
      setError(err.response?.data?.error || 'Erro ao criar time');
    }
  };

  const handleEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setError('');

    try {
      console.log('Dados sendo enviados para atualizar time:', formData); // Debug
      await teamService.updateTeam(selectedTeam.id, formData);
      setShowEditModal(false);
      setSelectedTeam(null);
      setFormData({ name: '', description: '', categoryIds: [], ticketTypes: [] });
      loadData();
    } catch (err: any) {
      console.error('Erro ao atualizar time:', err); // Debug
      setError(err.response?.data?.error || 'Erro ao atualizar time');
    }
  };

  const openEditModal = (team: Team) => {
    setSelectedTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      categoryIds: team.categories?.map((c) => c.categoryId) || [],
      ticketTypes: team.ticketTypes?.map((tt) => tt.ticketType) || [],
    });
    setShowEditModal(true);
  };

  const toggleCategory = (categoryId: string) => {
    setFormData((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }));
  };

  const toggleTicketType = (ticketType: string) => {
    setFormData((prev) => ({
      ...prev,
      ticketTypes: prev.ticketTypes.includes(ticketType)
        ? prev.ticketTypes.filter((type) => type !== ticketType)
        : [...prev.ticketTypes, ticketType],
    }));
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setError('');

    try {
      await teamService.addMember(selectedTeam.id, memberData);
      setShowAddMemberModal(false);
      setMemberData({ userId: '', role: 'MEMBER' });
      setSelectedTeam(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao adicionar membro');
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    if (!confirm('Deseja realmente remover este membro do time?')) return;

    try {
      await teamService.removeMember(teamId, userId);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao remover membro');
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Deseja realmente excluir este time? Esta ação não pode ser desfeita.')) return;

    try {
      await teamService.deleteTeam(id);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir time');
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <ModernLayout title="Times" subtitle="Gerenciar times do sistema">
        <div className="text-center py-12">
          <p className="text-red-400">Acesso negado. Apenas administradores podem acessar esta página.</p>
        </div>
      </ModernLayout>
    );
  }

  const headerActions = (
    <button
      onClick={() => setShowCreateModal(true)}
      className="inline-flex items-center space-x-2 px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span>Criar Novo Time</span>
    </button>
  );

  if (loading) {
    return (
      <ModernLayout title="Times" subtitle="Gerenciar times do sistema" headerActions={headerActions}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-gray-400">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Times" subtitle="Gerenciar times do sistema" headerActions={headerActions}>
      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-600/50">
          <h2 className="text-lg font-semibold text-white">Lista de Times ({teams.length})</h2>
        </div>
        {teams.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Nenhum time cadastrado. Clique em "Criar Novo Time" para começar.
          </div>
        ) : (
          <ul className="divide-y divide-gray-600/50">
            {teams.map((team) => (
              <li key={team.id} className="p-6 hover:bg-gray-700/30 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-white">{team.name}</h3>
                    {team.description && (
                      <p className="mt-1 text-sm text-gray-400">{team.description}</p>
                    )}
                    {team.users && team.users.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-300 mb-2">Membros:</p>
                        <div className="flex flex-wrap gap-2">
                          {team.users.map((userTeam: UserTeam) => (
                            <span
                              key={`${userTeam.userId}-${userTeam.teamId}`}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-600/50 text-gray-300 border border-gray-600"
                            >
                              {userTeam.user.name}
                              {userTeam.role === 'LEAD' && (
                                <span className="ml-2 text-xs bg-blue-500/30 text-blue-400 px-2 py-0.5 rounded border border-blue-500/50">
                                  Líder
                                </span>
                              )}
                              <button
                                onClick={() => handleRemoveMember(team.id, userTeam.userId)}
                                className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                                title="Remover membro"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-4 space-y-2">
                      <div>
                        <p className="text-sm font-medium text-gray-300 mb-2">Categorias vinculadas:</p>
                        {team.categories && team.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {team.categories.map((tc: any) => (
                              <span
                                key={tc.categoryId || tc.id}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-600/30 text-green-400 border border-green-500/50"
                              >
                                {tc.category?.name || tc.name || 'Categoria sem nome'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">Nenhuma categoria vinculada</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-300 mb-2">Tipos de chamados vinculados:</p>
                        {team.ticketTypes && team.ticketTypes.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {team.ticketTypes.map((tt: any) => {
                              const ticketTypeValue = tt.ticketType || tt;
                              const option = ticketTypeOptions.find((opt) => opt.value === ticketTypeValue);
                              return (
                                <span
                                  key={ticketTypeValue}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-600/30 text-blue-400 border border-blue-500/50"
                                >
                                  {option?.label || ticketTypeValue}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">Nenhum tipo de chamado vinculado</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => openEditModal(team)}
                      className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTeam(team);
                        setShowAddMemberModal(true);
                      }}
                      className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-lg transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Adicionar Membro</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal Criar Time */}
      <DarkModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormData({ name: '', description: '', categoryIds: [], ticketTypes: [] });
        }}
        title="Criar Novo Time"
      >
        <form onSubmit={handleCreateTeam}>
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
              <label className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Categorias Vinculadas
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-600 rounded-lg p-3 bg-gray-700/30">
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma categoria disponível</p>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <label
                        key={category.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-600/30 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={formData.categoryIds.includes(category.id)}
                          onChange={() => toggleCategory(category.id)}
                          className="w-4 h-4 text-etus-green bg-gray-700 border-gray-600 rounded focus:ring-etus-green"
                        />
                        <span className="text-sm text-gray-300">{category.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Selecione as categorias que este time pode usar ao criar tickets
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipos de Chamados Vinculados
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ticketTypeOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-600/30 p-2 rounded border border-gray-600"
                  >
                    <input
                      type="checkbox"
                      checked={formData.ticketTypes.includes(option.value)}
                      onChange={() => toggleTicketType(option.value)}
                      className="w-4 h-4 text-etus-green bg-gray-700 border-gray-600 rounded focus:ring-etus-green"
                    />
                    <span className="text-sm text-gray-300">{option.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Selecione os tipos de chamados que este time pode receber
              </p>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: '', description: '', categoryIds: [], ticketTypes: [] });
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

      {/* Modal Editar Time */}
      <DarkModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTeam(null);
          setFormData({ name: '', description: '', categoryIds: [], ticketTypes: [] });
        }}
        title={`Editar Time: ${selectedTeam?.name || ''}`}
      >
        <form onSubmit={handleEditTeam}>
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
              <label className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Categorias Vinculadas
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-600 rounded-lg p-3 bg-gray-700/30">
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma categoria disponível</p>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <label
                        key={category.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-600/30 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={formData.categoryIds.includes(category.id)}
                          onChange={() => toggleCategory(category.id)}
                          className="w-4 h-4 text-etus-green bg-gray-700 border-gray-600 rounded focus:ring-etus-green"
                        />
                        <span className="text-sm text-gray-300">{category.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Selecione as categorias que este time pode usar ao criar tickets
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipos de Chamados Vinculados
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ticketTypeOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-600/30 p-2 rounded border border-gray-600"
                  >
                    <input
                      type="checkbox"
                      checked={formData.ticketTypes.includes(option.value)}
                      onChange={() => toggleTicketType(option.value)}
                      className="w-4 h-4 text-etus-green bg-gray-700 border-gray-600 rounded focus:ring-etus-green"
                    />
                    <span className="text-sm text-gray-300">{option.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Selecione os tipos de chamados que este time pode receber
              </p>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTeam(null);
                  setFormData({ name: '', description: '', categoryIds: [], ticketTypes: [] });
                }}
                className="px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      </DarkModal>

      {/* Modal Adicionar Membro */}
      <DarkModal
        isOpen={showAddMemberModal}
        onClose={() => {
          setShowAddMemberModal(false);
          setSelectedTeam(null);
          setMemberData({ userId: '', role: 'MEMBER' });
        }}
        title={`Adicionar Membro ao Time: ${selectedTeam?.name || ''}`}
      >
        <form onSubmit={handleAddMember}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Usuário <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={memberData.userId}
                onChange={(e) => setMemberData({ ...memberData, userId: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              >
                <option value="">Selecione um usuário</option>
                {users
                  .filter(
                    (u) =>
                      !selectedTeam?.users?.some((ut: UserTeam) => ut.userId === u.id)
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.role}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Papel</label>
              <select
                value={memberData.role}
                onChange={(e) =>
                  setMemberData({
                    ...memberData,
                    role: e.target.value as 'MEMBER' | 'LEAD',
                  })
                }
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              >
                <option value="MEMBER">Membro</option>
                <option value="LEAD">Líder</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedTeam(null);
                  setMemberData({ userId: '', role: 'MEMBER' });
                }}
                className="px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
              >
                Adicionar
              </button>
            </div>
          </div>
        </form>
      </DarkModal>
    </ModernLayout>
  );
};

export default TeamsPage;
