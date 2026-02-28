import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { slaService, SlaPolicy, BusinessCalendar } from '../services/sla.service';
import { teamService } from '../services/team.service';
import { categoryService } from '../services/category.service';
import ModernLayout from '../components/ModernLayout';
import DarkModal from '../components/DarkModal';
import { Plus, Edit, Trash2, Calendar } from 'lucide-react';

const SlaAdminPage = () => {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [calendars, setCalendars] = useState<BusinessCalendar[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SlaPolicy | null>(null);
  const [editingCalendar, setEditingCalendar] = useState<BusinessCalendar | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    appliesTo: {
      teamId: '',
      categoryId: '',
      priority: '',
      ticketType: '',
      requesterTeamId: '',
    },
    targetFirstResponseBusinessMinutes: '',
    targetResolutionBusinessMinutes: '',
    calendarId: '',
    active: true,
  });
  const [calendarFormData, setCalendarFormData] = useState({
    name: '',
    timezone: 'America/Sao_Paulo',
    schedule: {
      monday: { open: '09:00', close: '18:00', enabled: true },
      tuesday: { open: '09:00', close: '18:00', enabled: true },
      wednesday: { open: '09:00', close: '18:00', enabled: true },
      thursday: { open: '09:00', close: '18:00', enabled: true },
      friday: { open: '09:00', close: '18:00', enabled: true },
      saturday: { open: '09:00', close: '18:00', enabled: false },
      sunday: { open: '09:00', close: '18:00', enabled: false },
    },
    isDefault: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [policiesData, calendarsData, teamsData, categoriesData] = await Promise.all([
        slaService.getAllPolicies(),
        slaService.getAllCalendars(),
        teamService.getAllTeams(),
        categoryService.getAllCategories(),
      ]);
      setPolicies(policiesData);
      setCalendars(calendarsData);
      setTeams(teamsData);
      setCategories(categoriesData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const policyData = {
        name: formData.name,
        description: formData.description || undefined,
        appliesTo: {
          teamId: formData.appliesTo.teamId || undefined,
          categoryId: formData.appliesTo.categoryId || undefined,
          priority: formData.appliesTo.priority || undefined,
          ticketType: formData.appliesTo.ticketType || undefined,
          requesterTeamId: formData.appliesTo.requesterTeamId || undefined,
        },
        targetFirstResponseBusinessMinutes: formData.targetFirstResponseBusinessMinutes
          ? parseInt(formData.targetFirstResponseBusinessMinutes)
          : undefined,
        targetResolutionBusinessMinutes: parseInt(formData.targetResolutionBusinessMinutes),
        calendarId: formData.calendarId,
        active: formData.active,
      };

      if (editingPolicy) {
        await slaService.updatePolicy(editingPolicy.id, policyData);
      } else {
        await slaService.createPolicy(policyData);
      }

      setShowPolicyModal(false);
      setEditingPolicy(null);
      setFormData({
        name: '',
        description: '',
        appliesTo: {
          teamId: '',
          categoryId: '',
          priority: '',
          ticketType: '',
          requesterTeamId: '',
        },
        targetFirstResponseBusinessMinutes: '',
        targetResolutionBusinessMinutes: '',
        calendarId: '',
        active: true,
      });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || `Erro ao ${editingPolicy ? 'atualizar' : 'criar'} política`);
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta política de SLA? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await slaService.deletePolicy(policyId);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir política');
    }
  };

  const handleDeleteCalendar = async (calendarId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este calendário? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await slaService.deleteCalendar(calendarId);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir calendário');
    }
  };

  const handleSaveCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const calendarData = {
        name: calendarFormData.name,
        timezone: calendarFormData.timezone,
        schedule: calendarFormData.schedule,
        isDefault: calendarFormData.isDefault,
      };

      if (editingCalendar) {
        await slaService.updateCalendar(editingCalendar.id, calendarData);
      } else {
        await slaService.createCalendar(calendarData);
      }

      setShowCalendarModal(false);
      setEditingCalendar(null);
      setCalendarFormData({
        name: '',
        timezone: 'America/Sao_Paulo',
        schedule: {
          monday: { open: '09:00', close: '18:00', enabled: true },
          tuesday: { open: '09:00', close: '18:00', enabled: true },
          wednesday: { open: '09:00', close: '18:00', enabled: true },
          thursday: { open: '09:00', close: '18:00', enabled: true },
          friday: { open: '09:00', close: '18:00', enabled: true },
          saturday: { open: '09:00', close: '18:00', enabled: false },
          sunday: { open: '09:00', close: '18:00', enabled: false },
        },
        isDefault: false,
      });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || `Erro ao ${editingCalendar ? 'atualizar' : 'criar'} calendário`);
    }
  };

  const headerActions = (
    <div className="flex gap-2">
      <button
        onClick={() => {
          setEditingCalendar(null);
          setShowCalendarModal(true);
        }}
        className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 rounded-lg text-sm font-medium text-white transition-colors"
      >
        <Calendar className="w-4 h-4" />
        <span>Novo Calendário</span>
      </button>
      <button
        onClick={() => {
          setEditingPolicy(null);
          setShowPolicyModal(true);
        }}
        className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>Nova Política</span>
      </button>
    </div>
  );

  if (loading) {
    return (
      <ModernLayout title="SLA" subtitle="Gerenciar políticas e calendários de SLA" headerActions={headerActions}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  if (user?.role !== 'ADMIN') {
    return (
      <ModernLayout title="SLA" subtitle="Gerenciar políticas e calendários de SLA" headerActions={headerActions}>
        <div className="text-center py-12">
          <p className="text-red-400">Acesso negado. Apenas administradores podem acessar esta página.</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="SLA" subtitle="Gerenciar políticas e calendários de SLA" headerActions={headerActions}>
      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Calendários */}
      <div className="bg-white dark:bg-slate-800 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Calendários de Negócio</h2>
        <div className="space-y-4">
          {calendars.map((calendar) => (
            <div key={calendar.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-white">{calendar.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{calendar.timezone}</p>
                  {calendar.isDefault && (
                    <span className="inline-block mt-1 px-2 py-1 text-xs bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 rounded">
                      Padrão
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingCalendar(calendar);
                      setShowCalendarModal(true);
                    }}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCalendar(calendar.id)}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {calendars.length === 0 && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              Nenhum calendário cadastrado
            </div>
          )}
        </div>
      </div>

      {/* Políticas */}
      <div className="bg-white dark:bg-slate-800 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Políticas de SLA</h2>
        <div className="space-y-4">
          {policies.map((policy) => (
            <div key={policy.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium text-white">{policy.name}</h3>
                  {policy.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{policy.description}</p>
                  )}
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    <p>Resolução: {policy.targetResolutionBusinessMinutes} min</p>
                    {policy.targetFirstResponseBusinessMinutes && (
                      <p>Primeira Resposta: {policy.targetFirstResponseBusinessMinutes} min</p>
                    )}
                    <p className={`mt-1 ${policy.active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {policy.active ? 'Ativa' : 'Inativa'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <button
                    onClick={() => {
                      setEditingPolicy(policy);
                      setFormData({
                        name: policy.name,
                        description: policy.description || '',
                        appliesTo: policy.appliesTo as any,
                        targetFirstResponseBusinessMinutes: policy.targetFirstResponseBusinessMinutes?.toString() || '',
                        targetResolutionBusinessMinutes: policy.targetResolutionBusinessMinutes.toString(),
                        calendarId: policy.calendarId,
                        active: policy.active,
                      });
                      setShowPolicyModal(true);
                    }}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePolicy(policy.id)}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {policies.length === 0 && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              Nenhuma política cadastrada
            </div>
          )}
        </div>
      </div>

      {/* Modal de Política */}
      <DarkModal
        isOpen={showPolicyModal}
        onClose={() => {
          setShowPolicyModal(false);
          setEditingPolicy(null);
        }}
        title={editingPolicy ? 'Editar Política' : 'Nova Política de SLA'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSavePolicy}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nome <span className="text-red-400">*</span></label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Time</label>
                <select
                  value={formData.appliesTo.teamId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      appliesTo: { ...formData.appliesTo, teamId: e.target.value },
                    })
                  }
                  className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Todos</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Categoria</label>
                <select
                  value={formData.appliesTo.categoryId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      appliesTo: { ...formData.appliesTo, categoryId: e.target.value },
                    })
                  }
                  className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Todas</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Tempo de Resolução (min) <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  required
                  value={formData.targetResolutionBusinessMinutes}
                  onChange={(e) =>
                    setFormData({ ...formData, targetResolutionBusinessMinutes: e.target.value })
                  }
                  className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Tempo de Primeira Resposta (min)
                </label>
                <input
                  type="number"
                  value={formData.targetFirstResponseBusinessMinutes}
                  onChange={(e) =>
                    setFormData({ ...formData, targetFirstResponseBusinessMinutes: e.target.value })
                  }
                  className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Calendário <span className="text-red-400">*</span></label>
              <select
                required
                value={formData.calendarId}
                onChange={(e) => setFormData({ ...formData, calendarId: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Selecione um calendário</option>
                {calendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-slate-600 dark:text-slate-300">Política ativa</span>
              </label>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowPolicyModal(false);
                setEditingPolicy(null);
              }}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
            >
              {editingPolicy ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </DarkModal>

      {/* Modal de Calendário */}
      <DarkModal
        isOpen={showCalendarModal}
        onClose={() => {
          setShowCalendarModal(false);
          setEditingCalendar(null);
        }}
        title={editingCalendar ? 'Editar Calendário' : 'Novo Calendário'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveCalendar}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nome <span className="text-red-400">*</span></label>
              <input
                type="text"
                required
                value={calendarFormData.name}
                onChange={(e) => setCalendarFormData({ ...calendarFormData, name: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Timezone</label>
              <input
                type="text"
                value={calendarFormData.timezone}
                onChange={(e) => setCalendarFormData({ ...calendarFormData, timezone: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={calendarFormData.isDefault}
                  onChange={(e) => setCalendarFormData({ ...calendarFormData, isDefault: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-slate-600 dark:text-slate-300">Calendário padrão</span>
              </label>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              <p>Horários configurados: Segunda a Sexta, 09:00-18:00</p>
              <p className="text-xs mt-1">Configuração avançada de horários por dia será implementada em versão futura.</p>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowCalendarModal(false);
                setEditingCalendar(null);
              }}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
            >
              {editingCalendar ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </DarkModal>
    </ModernLayout>
  );
};

export default SlaAdminPage;
