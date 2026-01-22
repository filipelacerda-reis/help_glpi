import { useState, useEffect } from 'react';
import { MetricsFilters } from '../types/metrics.types';
import { teamService, Team } from '../services/team.service';
import { categoryService, Category } from '../services/category.service';
import { userService, User } from '../services/user.service';

interface MetricsFilterBarProps {
  filters: MetricsFilters;
  onChange: (filters: MetricsFilters) => void;
  onSavePreset?: () => void;
  userRole?: string;
  allowedTeamIds?: string[]; // IDs dos times permitidos (para líderes de time)
}

type DatePreset = 'today' | 'last7days' | 'thisMonth' | 'last30days' | 'lastQuarter' | 'custom';

export const MetricsFilterBar: React.FC<MetricsFilterBarProps> = ({
  filters,
  onChange,
  onSavePreset,
  userRole,
  allowedTeamIds,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('last30days');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyDatePreset(datePreset);
  }, [datePreset]);

  const loadData = async () => {
    try {
      const [teamsData, categoriesData, techniciansData] = await Promise.all([
        teamService.getAllTeams(),
        categoryService.getAllCategories(),
        userService.getAllUsers().then(users => users.filter(u => u.role === 'TECHNICIAN' || u.role === 'TRIAGER' || u.role === 'ADMIN')).catch(() => []),
      ]);
      
      // Filtrar times: ADMIN vê todos, líder de time vê apenas os seus
      let filteredTeams = teamsData;
      if (userRole !== 'ADMIN' && allowedTeamIds && allowedTeamIds.length > 0) {
        filteredTeams = teamsData.filter(team => allowedTeamIds.includes(team.id));
      }
      
      setTeams(filteredTeams);
      setCategories(categoriesData);
      setTechnicians(techniciansData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyDatePreset = (preset: DatePreset) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let startDate: Date;
    let endDate: Date = today;

    switch (preset) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'last7days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last30days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'lastQuarter':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        // Não alterar datas se for custom
        return;
      default:
        return;
    }

    onChange({
      ...filters,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  };

  const handleFilterChange = (key: keyof MetricsFilters, value: any) => {
    onChange({ ...filters, [key]: value });
    if (key === 'startDate' || key === 'endDate') {
      setDatePreset('custom');
    }
  };

  const clearFilters = () => {
    const cleared: MetricsFilters = {
      businessHours: false,
      comparePreviousPeriod: false,
    };
    onChange(cleared);
    setDatePreset('last30days');
  };

  if (loading) {
    return <div className="text-center py-4">Carregando filtros...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Filtros</h2>
        <div className="flex gap-2">
          {onSavePreset && (
            <button
              onClick={onSavePreset}
              className="px-3 py-1.5 text-xs border border-gray-600 rounded-lg text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              Salvar
            </button>
          )}
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs border border-gray-600 rounded-lg text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Período */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Período</label>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
          >
            <option value="today">Hoje</option>
            <option value="last7days">Últimos 7 dias</option>
            <option value="thisMonth">Este mês</option>
            <option value="last30days">Últimos 30 dias</option>
            <option value="lastQuarter">Último trimestre</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {datePreset === 'custom' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Data Inicial</label>
              <input
                type="date"
                value={filters.startDate ? filters.startDate.split('T')[0] : ''}
                onChange={(e) =>
                  handleFilterChange('startDate', e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined)
                }
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Data Final</label>
              <input
                type="date"
                value={filters.endDate ? filters.endDate.split('T')[0] : ''}
                onChange={(e) =>
                  handleFilterChange('endDate', e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined)
                }
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
          </>
        )}

        {/* Time */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Time</label>
          <select
            value={filters.teamId || ''}
            onChange={(e) => handleFilterChange('teamId', e.target.value || undefined)}
            className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
            required={userRole !== 'ADMIN' && allowedTeamIds && allowedTeamIds.length > 1}
          >
            {userRole === 'ADMIN' && <option value="">Todos</option>}
            {userRole !== 'ADMIN' && allowedTeamIds && allowedTeamIds.length > 1 && (
              <option value="">Selecione um time</option>
            )}
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          {userRole !== 'ADMIN' && allowedTeamIds && allowedTeamIds.length > 1 && !filters.teamId && (
            <p className="mt-1 text-xs text-yellow-400">Selecione um time para visualizar as métricas</p>
          )}
        </div>

        {/* Técnico */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Técnico</label>
          <select
            value={filters.technicianId || ''}
            onChange={(e) => handleFilterChange('technicianId', e.target.value || undefined)}
            className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
          >
            <option value="">Todos</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
        </div>

        {/* Categoria */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Categoria</label>
          <select
            value={filters.categoryId || ''}
            onChange={(e) => handleFilterChange('categoryId', e.target.value || undefined)}
            className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
          >
            <option value="">Todas</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Prioridade */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Prioridade</label>
          <select
            value={filters.priority || ''}
            onChange={(e) => handleFilterChange('priority', e.target.value || undefined)}
            className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
          >
            <option value="">Todas</option>
            <option value="CRITICAL">Crítica</option>
            <option value="HIGH">Alta</option>
            <option value="MEDIUM">Média</option>
            <option value="LOW">Baixa</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
          <select
            value={Array.isArray(filters.status) ? filters.status[0] : filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
            className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
          >
            <option value="">Todos</option>
            <option value="OPEN">Aberto</option>
            <option value="IN_PROGRESS">Em Atendimento</option>
            <option value="WAITING_REQUESTER">Aguardando Usuário</option>
            <option value="WAITING_THIRD_PARTY">Aguardando Terceiros</option>
            <option value="RESOLVED">Resolvido</option>
            <option value="CLOSED">Fechado</option>
          </select>
        </div>

        {/* SLA Status */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">SLA</label>
          <select
            value={filters.slaStatus || ''}
            onChange={(e) => handleFilterChange('slaStatus', e.target.value || undefined)}
            className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
          >
            <option value="">Todos</option>
            <option value="IN">Dentro do SLA</option>
            <option value="OUT">Fora do SLA</option>
            <option value="NONE">Sem SLA</option>
          </select>
        </div>
      </div>

      {/* Toggles */}
      <div className="mt-4 flex gap-6 flex-wrap">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filters.businessHours || false}
            onChange={(e) => handleFilterChange('businessHours', e.target.checked)}
            className="rounded border-gray-600 bg-gray-700/50 text-etus-green focus:ring-etus-green"
          />
          <span className="ml-2 text-xs text-gray-300">Horas úteis (8x5)</span>
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filters.comparePreviousPeriod || false}
            onChange={(e) => handleFilterChange('comparePreviousPeriod', e.target.checked)}
            className="rounded border-gray-600 bg-gray-700/50 text-etus-green focus:ring-etus-green"
          />
          <span className="ml-2 text-xs text-gray-300">Comparar período anterior</span>
        </label>
      </div>
    </div>
  );
};

