import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { automationService, AutomationRule } from '../services/automation.service';
import { categoryService, type Category } from '../services/category.service';
import { teamService, type Team } from '../services/team.service';
import { tagService, type Tag } from '../services/tag.service';
import { userService, type User } from '../services/user.service';
import ModernLayout from '../components/ModernLayout';
import DarkModal from '../components/DarkModal';
import { Plus, Edit, Trash2 } from 'lucide-react';
import ConditionBuilder from '../components/automation/ConditionBuilder';
import ActionBuilder from '../components/automation/ActionBuilder';

const AutomationAdminPage = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    event: 'ON_TICKET_CREATED',
    conditions: {} as Record<string, any>,
    actions: [] as AutomationRule['actions'],
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const eventOptions = [
    { value: 'ON_TICKET_CREATED', label: 'Ao Criar Ticket' },
    { value: 'ON_TICKET_UPDATED', label: 'Ao Atualizar Ticket' },
    { value: 'ON_STATUS_CHANGED', label: 'Ao Mudar Status' },
    { value: 'ON_PRIORITY_CHANGED', label: 'Ao Mudar Prioridade' },
    { value: 'ON_TEAM_CHANGED', label: 'Ao Mudar Time' },
    { value: 'ON_SLA_BREACH', label: 'Ao Violar SLA' },
    { value: 'ON_SLA_MET', label: 'Ao Cumprir SLA' },
    { value: 'ON_COMMENT_ADDED', label: 'Ao Adicionar Comentário' },
  ];

  const technicians = useMemo(
    () => users.filter((u) => u.role === 'TECHNICIAN'),
    [users]
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const [rulesData, categoriesData, teamsData, tagsData, usersData] = await Promise.all([
          automationService.getAllRules(),
          categoryService.getAllCategories(true),
          teamService.getAllTeams(false),
          tagService.getAllTags({ isActive: true } as any),
          userService.getAllUsers(),
        ]);

        setRules(rulesData);
        setCategories(categoriesData);
        setTeams(teamsData);
        setTags(tagsData);
        setUsers(usersData);
      } catch (err: any) {
        console.error('Erro ao carregar dados de automação:', err);
        setError(err.response?.data?.error || 'Erro ao carregar regras e dados auxiliares');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const conditions = formData.conditions || {};
      const actions = formData.actions || [];

      if (!actions.length) {
        setError('Adicione pelo menos uma ação para a regra.');
        return;
      }

      if (editingRule) {
        await automationService.updateRule(editingRule.id, {
          name: formData.name,
          description: formData.description,
          enabled: formData.enabled,
          event: formData.event,
          conditions,
          actions,
        });
      } else {
        await automationService.createRule({
          name: formData.name,
          description: formData.description,
          enabled: formData.enabled,
          event: formData.event,
          conditions,
          actions,
        });
      }

      setShowModal(false);
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        enabled: true,
        event: 'ON_TICKET_CREATED',
        conditions: {},
        actions: [],
      });
      // Recarregar regras após salvar
      try {
        const data = await automationService.getAllRules();
        setRules(data);
      } catch (err: any) {
        console.error('Erro ao recarregar regras de automação:', err);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar regra');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta regra?')) return;

    try {
      await automationService.deleteRule(id);
      // Recarregar regras após excluir
      const data = await automationService.getAllRules();
      setRules(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir regra');
    }
  };

  const headerActions = (
    <button
      onClick={() => {
        setEditingRule(null);
        setShowModal(true);
      }}
      className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span>Nova Regra</span>
    </button>
  );

  if (loading) {
    return (
      <ModernLayout title="Automações" subtitle="Gerenciar regras de automação" headerActions={headerActions}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  if (user?.role !== 'ADMIN') {
    return (
      <ModernLayout title="Automações" subtitle="Gerenciar regras de automação" headerActions={headerActions}>
        <div className="text-center py-12">
          <p className="text-red-400">Acesso negado. Apenas administradores podem acessar esta página.</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Automações" subtitle="Gerenciar regras de automação" headerActions={headerActions}>
      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg p-6">
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-white">{rule.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        rule.enabled ? 'bg-indigo-600/30 text-indigo-600 dark:text-indigo-400' : 'bg-gray-600/50 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {rule.enabled ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{rule.description}</p>
                  )}
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    <p>
                      <span className="font-medium">Evento:</span>{' '}
                      {eventOptions.find((e) => e.value === rule.event)?.label || rule.event}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium">Condições:</span>{' '}
                      <code className="text-xs bg-slate-50 dark:bg-slate-900/40 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                        {JSON.stringify(rule.conditions)}
                      </code>
                    </p>
                    <p className="mt-1">
                      <span className="font-medium">Ações:</span>{' '}
                      <code className="text-xs bg-slate-50 dark:bg-slate-900/40 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                        {JSON.stringify(rule.actions)}
                      </code>
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingRule(rule);
                      setFormData({
                        name: rule.name,
                        description: rule.description || '',
                        enabled: rule.enabled,
                        event: rule.event,
                        conditions: (rule.conditions || {}) as Record<string, any>,
                        actions: (rule.actions || []) as AutomationRule['actions'],
                      });
                      setShowModal(true);
                    }}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Nenhuma regra de automação criada</p>
          )}
        </div>
      </div>

      {/* Modal */}
      <DarkModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingRule(null);
        }}
        title={editingRule ? 'Editar Regra' : 'Nova Regra de Automação'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit}>
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
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Evento <span className="text-red-400">*</span></label>
              <select
                required
                value={formData.event}
                onChange={(e) => setFormData({ ...formData, event: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {eventOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <ConditionBuilder
              value={formData.conditions}
              onChange={(conditions) => setFormData((prev) => ({ ...prev, conditions }))}
              teams={teams}
              categories={categories}
            />
            <ActionBuilder
              value={formData.actions}
              onChange={(actions) => setFormData((prev) => ({ ...prev, actions }))}
              teams={teams}
              tags={tags}
              technicians={technicians}
            />
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-slate-600 dark:text-slate-300">Regra ativa</span>
              </label>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingRule(null);
              }}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
            >
              {editingRule ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </DarkModal>
    </ModernLayout>
  );
};

export default AutomationAdminPage;
