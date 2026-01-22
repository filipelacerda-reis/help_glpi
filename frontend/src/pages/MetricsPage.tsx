import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { metricsService } from '../services/metrics.service';
import { teamService } from '../services/team.service';
import { reportPresetService } from '../services/reportPreset.service';
import { ReportPreset } from '../types/metrics.types';
import { MetricsFilterBar } from '../components/MetricsFilterBar';
import { MetricsFilters, MetricsResponse } from '../types/metrics.types';
import { MetricsOverviewTab } from '../components/metrics/MetricsOverviewTab';
import { MetricsByTeamTab } from '../components/metrics/MetricsByTeamTab';
import { MetricsByTechnicianTab } from '../components/metrics/MetricsByTechnicianTab';
import { MetricsByCategoryTab } from '../components/metrics/MetricsByCategoryTab';
import { MetricsSlaTab } from '../components/metrics/MetricsSlaTab';
import { MetricsBacklogTab } from '../components/metrics/MetricsBacklogTab';
import { SavePresetModal } from '../components/metrics/SavePresetModal';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Users,
  FolderKanban,
  TrendingUp,
  Clock,
  Target,
  FileText,
  Settings,
  Home,
  CheckCircle2,
} from 'lucide-react';

type TabType = 'overview' | 'byTeam' | 'byTechnician' | 'byCategory' | 'sla' | 'backlog';

const MetricsPage = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [filters, setFilters] = useState<MetricsFilters>({
    businessHours: false,
    comparePreviousPeriod: false,
  });
  const [presets, setPresets] = useState<ReportPreset[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [leadTeamIds, setLeadTeamIds] = useState<string[]>([]);

  // Sincronizar filtros com URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFilters: MetricsFilters = {
      businessHours: params.get('businessHours') === 'true',
      comparePreviousPeriod: params.get('comparePreviousPeriod') === 'true',
    };

    if (params.get('startDate')) urlFilters.startDate = params.get('startDate')!;
    if (params.get('endDate')) urlFilters.endDate = params.get('endDate')!;
    if (params.get('teamId')) urlFilters.teamId = params.get('teamId')!;
    if (params.get('technicianId')) urlFilters.technicianId = params.get('technicianId')!;
    if (params.get('categoryId')) urlFilters.categoryId = params.get('categoryId')!;
    if (params.get('priority')) urlFilters.priority = params.get('priority')!;
    if (params.get('status')) urlFilters.status = params.get('status')!;
    if (params.get('slaStatus')) urlFilters.slaStatus = params.get('slaStatus')!;

    if (Object.keys(urlFilters).length > 2) {
      setFilters(urlFilters);
    }
  }, []);

  // Verificar se é líder de time e carregar times
  useEffect(() => {
    const checkTeamLead = async () => {
      if (user?.role === 'ADMIN') {
        setIsTeamLead(true);
        setLeadTeamIds([]); // ADMIN não precisa de restrição
        return;
      }
      try {
        const teamIds = await teamService.getUserLeadTeams();
        setIsTeamLead(teamIds.length > 0);
        setLeadTeamIds(teamIds);
        
        // Se for líder de um único time e não houver teamId nos filtros nem na URL, pré-selecionar
        if (teamIds.length === 1) {
          const urlParams = new URLSearchParams(window.location.search);
          const urlTeamId = urlParams.get('teamId');
          
          if (!urlTeamId && !filters.teamId) {
            setFilters(prev => ({ ...prev, teamId: teamIds[0] }));
          }
        }
      } catch (error) {
        console.error('Erro ao verificar times do líder:', error);
        setIsTeamLead(false);
        setLeadTeamIds([]);
      }
    };

    if (user) {
      checkTeamLead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Carregar presets
  useEffect(() => {
    if (user?.role === 'ADMIN' || isTeamLead) {
      loadPresets();
    }
  }, [user, isTeamLead]);

  // Carregar métricas quando filtros mudarem (com debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user?.role === 'ADMIN' || isTeamLead) {
        loadMetrics();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [filters, user, isTeamLead]);

  // Atualizar URL quando filtros mudarem
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, String(v)));
        } else {
          params.set(key, String(value));
        }
      }
    });
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [filters]);

  const loadPresets = async () => {
    try {
      const data = await reportPresetService.getPresets();
      setPresets(data);
    } catch (error) {
      console.error('Erro ao carregar presets:', error);
    }
  };

  const loadMetrics = async () => {
    // Se for líder de múltiplos times e não tiver teamId selecionado, não carregar
    if (user?.role !== 'ADMIN' && leadTeamIds.length > 1 && !filters.teamId) {
      setError('Selecione um time para visualizar as métricas');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await metricsService.getEnterpriseMetrics(filters);
      setMetrics(data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Erro ao carregar métricas';
      setError(errorMessage);
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreset = () => {
    setShowSaveModal(true);
  };

  const handleLoadPreset = useCallback((preset: ReportPreset) => {
    setFilters(preset.filters);
  }, []);

  const handleExport = () => {
    // TODO: Implementar exportação CSV
    alert('Exportação CSV será implementada em breve');
  };

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours === 0) return `${mins}min`;
    return `${hours}h ${mins}min`;
  };

  // Verificar acesso: ADMIN ou líder de time
  if (user?.role !== 'ADMIN' && !isTeamLead) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Acesso negado. Apenas administradores ou líderes de time podem acessar esta página.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Visão Geral', icon: BarChart3 },
    { id: 'byTeam' as TabType, label: 'Por Time', icon: Users },
    { id: 'byTechnician' as TabType, label: 'Por Técnico', icon: Users },
    { id: 'byCategory' as TabType, label: 'Categoria & Tag', icon: FolderKanban },
    { id: 'sla' as TabType, label: 'SLA & SLO', icon: Target },
    { id: 'backlog' as TabType, label: 'Backlog', icon: Clock },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
      {/* Sidebar Esquerda */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-800/50 backdrop-blur-sm border-r border-gray-700/50 transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-700/50">
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
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-etus-green/20 hover:text-etus-green transition-colors"
            title="Dashboard"
          >
            <Home className="w-5 h-5" />
            {!sidebarCollapsed && <span className="text-sm">Dashboard</span>}
          </Link>
          <Link
            to="/tickets"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-etus-green/20 hover:text-etus-green transition-colors"
            title="Tickets"
          >
            <FileText className="w-5 h-5" />
            {!sidebarCollapsed && <span className="text-sm">Tickets</span>}
          </Link>
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-etus-green/30 text-etus-green">
            <BarChart3 className="w-5 h-5" />
            {!sidebarCollapsed && <span className="text-sm font-semibold">Métricas</span>}
          </div>
          <Link
            to="/kb"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-etus-green/20 hover:text-etus-green transition-colors"
            title="Base de Conhecimento"
          >
            <FolderKanban className="w-5 h-5" />
            {!sidebarCollapsed && <span className="text-sm">Base de Conhecimento</span>}
          </Link>
          <Link
            to="/sla"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-etus-green/20 hover:text-etus-green transition-colors"
            title="SLA"
          >
            <Target className="w-5 h-5" />
            {!sidebarCollapsed && <span className="text-sm">SLA</span>}
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-700/50">
          <Link
            to="/settings"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-etus-green/20 hover:text-etus-green transition-colors"
            title="Configurações"
          >
            <Settings className="w-5 h-5" />
            {!sidebarCollapsed && <span className="text-sm">Configurações</span>}
          </Link>
        </div>
      </div>

      {/* Área Central */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700/50 p-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Relatórios e Métricas</h1>
              <p className="text-sm text-gray-400 mt-1">Análise detalhada de performance e indicadores</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSavePreset}
                className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm font-medium text-white transition-colors"
              >
                Salvar Modelo
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
              >
                Exportar
              </button>
            </div>
          </div>

          {/* Presets salvos */}
          {presets.length > 0 && (
            <div className="mb-4">
              <select
                onChange={(e) => {
                  const preset = presets.find((p) => p.id === e.target.value);
                  if (preset) handleLoadPreset(preset);
                }}
                className="block w-full max-w-xs bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
                defaultValue=""
              >
                <option value="">Selecione um modelo...</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-gray-800/30 rounded-lg p-3">
            <MetricsFilterBar 
              filters={filters} 
              onChange={setFilters} 
              onSavePreset={handleSavePreset}
              userRole={user?.role}
              allowedTeamIds={user?.role === 'ADMIN' ? undefined : leadTeamIds}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800/20 border-b border-gray-700/50 px-4">
          <nav className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                    ${
                      activeTab === tab.id
                        ? 'border-etus-green text-etus-green bg-etus-green/10'
                        : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Conteúdo das abas */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
              <p className="mt-4 text-gray-400">Carregando métricas...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={loadMetrics}
                className="px-4 py-2 bg-etus-green text-gray-900 rounded-lg hover:bg-etus-green-dark transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          ) : !metrics ? (
            <div className="text-center py-12 text-gray-400">Nenhuma métrica disponível</div>
          ) : (
            <div className="space-y-6">
              {activeTab === 'overview' && <MetricsOverviewTab metrics={metrics} filters={filters} />}
              {activeTab === 'byTeam' && <MetricsByTeamTab metrics={metrics} />}
              {activeTab === 'byTechnician' && <MetricsByTechnicianTab metrics={metrics} />}
              {activeTab === 'byCategory' && <MetricsByCategoryTab metrics={metrics} />}
              {activeTab === 'sla' && <MetricsSlaTab metrics={metrics} />}
              {activeTab === 'backlog' && <MetricsBacklogTab metrics={metrics} />}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Direita */}
      <div className="w-80 bg-gray-800/50 backdrop-blur-sm border-l border-gray-700/50 p-6 overflow-y-auto">
        {/* Perfil do Usuário */}
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-etus-green to-etus-green-dark flex items-center justify-center text-gray-900 font-bold text-lg">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h3 className="text-white font-semibold">{user?.name || 'Usuário'}</h3>
              <p className="text-xs text-gray-400">{user?.role === 'ADMIN' ? 'Administrador' : user?.role}</p>
            </div>
          </div>
        </div>

        {/* KPIs Rápidos */}
        {metrics && (
          <>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">KPIs Principais</h4>
              <div className="space-y-3">
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Tickets Criados</span>
                    <FileText className="w-4 h-4 text-etus-green" />
                  </div>
                  <p className="text-2xl font-bold text-white">{metrics.overview.createdCount}</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Tickets Resolvidos</span>
                    <CheckCircle2 className="w-4 h-4 text-etus-green" />
                  </div>
                  <p className="text-2xl font-bold text-white">{metrics.overview.resolvedCount}</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Backlog</span>
                    <Clock className="w-4 h-4 text-orange-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{metrics.overview.backlogCount}</p>
                </div>
              </div>
            </div>

            {/* Métricas de Tempo */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">Tempos Médios</h4>
              <div className="space-y-3">
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">MTTA</span>
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-xl font-bold text-white">{formatMinutes(metrics.overview.mtta)}</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">MTTR</span>
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-xl font-bold text-white">{formatMinutes(metrics.overview.mttr)}</p>
                </div>
              </div>
            </div>

            {/* SLA Compliance */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">SLA Compliance</h4>
              <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Taxa de Compliance</span>
                  <Target className="w-4 h-4 text-etus-green" />
                </div>
                <div className="relative w-full h-3 bg-gray-700 rounded-full overflow-hidden mt-3">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-etus-green to-etus-green-dark transition-all duration-500"
                    style={{ width: `${metrics.overview.slaCompliancePercent}%` }}
                  ></div>
                </div>
                <p className="text-2xl font-bold text-white mt-2">{metrics.overview.slaCompliancePercent.toFixed(1)}%</p>
              </div>
            </div>

            {/* Top Times */}
            {metrics.byTeam.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">Top Times</h4>
                <div className="space-y-2">
                  {metrics.byTeam.items.slice(0, 5).map((team, index) => (
                    <div key={team.teamId} className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white truncate">{team.teamName}</span>
                        <span className="text-xs text-gray-400">#{index + 1}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-etus-green transition-all duration-500"
                            style={{ width: `${Math.min((team.resolved / (team.created || 1)) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-400">{team.resolved}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de salvar preset */}
      {showSaveModal && (
        <SavePresetModal
          filters={filters}
          onClose={() => setShowSaveModal(false)}
          onSave={async (name, description) => {
            await reportPresetService.createPreset({ name, description, filters });
            await loadPresets();
            setShowSaveModal(false);
          }}
        />
      )}
    </div>
  );
};

export default MetricsPage;
