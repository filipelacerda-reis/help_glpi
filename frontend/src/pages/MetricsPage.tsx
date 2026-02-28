import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { metricsService } from '../services/metrics.service';
import { teamService } from '../services/team.service';
import { reportPresetService } from '../services/reportPreset.service';
import { ReportPreset, MetricsFilters, MetricsResponse } from '../types/metrics.types';
import { MetricsFilterBar } from '../components/MetricsFilterBar';
import { MetricsOverviewTab } from '../components/metrics/MetricsOverviewTab';
import { MetricsByTeamTab } from '../components/metrics/MetricsByTeamTab';
import { MetricsByTechnicianTab } from '../components/metrics/MetricsByTechnicianTab';
import { MetricsByCategoryTab } from '../components/metrics/MetricsByCategoryTab';
import { MetricsSlaTab } from '../components/metrics/MetricsSlaTab';
import { MetricsBacklogTab } from '../components/metrics/MetricsBacklogTab';
import { SavePresetModal } from '../components/metrics/SavePresetModal';
import ModernLayout from '../components/ModernLayout';
import { BarChart3, Users, FolderKanban, Clock, Target, Download, Save } from 'lucide-react';

type TabType = 'overview' | 'byTeam' | 'byTechnician' | 'byCategory' | 'sla' | 'backlog';

const primaryButtonClass =
  'bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5';
const secondaryButtonClass =
  'bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium transition-all border border-slate-200 shadow-sm hover:shadow-md dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700';

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
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [leadTeamIds, setLeadTeamIds] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as TabType | null;
    if (tab && ['overview', 'byTeam', 'byTechnician', 'byCategory', 'sla', 'backlog'].includes(tab)) {
      setActiveTab(tab);
    }

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

    if (Object.keys(urlFilters).length > 2) setFilters(urlFilters);
  }, []);

  useEffect(() => {
    const checkTeamLead = async () => {
      if (user?.role === 'ADMIN') {
        setIsTeamLead(true);
        setLeadTeamIds([]);
        return;
      }
      try {
        const teamIds = await teamService.getUserLeadTeams();
        setIsTeamLead(teamIds.length > 0);
        setLeadTeamIds(teamIds);

        if (teamIds.length === 1) {
          const urlParams = new URLSearchParams(window.location.search);
          const urlTeamId = urlParams.get('teamId');
          if (!urlTeamId && !filters.teamId) {
            setFilters((prev) => ({ ...prev, teamId: teamIds[0] }));
          }
        }
      } catch {
        setIsTeamLead(false);
        setLeadTeamIds([]);
      }
    };

    if (user) checkTeamLead();
  }, [user]);

  useEffect(() => {
    if (user?.role === 'ADMIN' || isTeamLead) loadPresets();
  }, [user, isTeamLead]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (user?.role === 'ADMIN' || isTeamLead) loadMetrics();
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, user, isTeamLead]);

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
        else params.set(key, String(value));
      }
    });
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [filters]);

  const loadPresets = async () => {
    try {
      const data = await reportPresetService.getPresets();
      setPresets(data);
    } catch {
      // noop
    }
  };

  const loadMetrics = async () => {
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
    } catch (err: unknown) {
      const maybeError = err as { response?: { data?: { error?: string } } };
      const errorMessage = maybeError.response?.data?.error || 'Erro ao carregar métricas';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPreset = useCallback((preset: ReportPreset) => {
    setFilters(preset.filters);
  }, []);

  const handleExport = () => {
    alert('Exportação CSV será implementada em breve');
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Visão Geral', icon: BarChart3 },
    { id: 'byTeam' as TabType, label: 'Por Time', icon: Users },
    { id: 'byTechnician' as TabType, label: 'Por Técnico', icon: Users },
    { id: 'byCategory' as TabType, label: 'Categoria & Tag', icon: FolderKanban },
    { id: 'sla' as TabType, label: 'SLA & SLO', icon: Target },
    { id: 'backlog' as TabType, label: 'Backlog', icon: Clock },
  ];

  if (user?.role !== 'ADMIN' && !isTeamLead) {
    return (
      <ModernLayout title="Métricas e Relatórios" subtitle="Análise detalhada de performance e indicadores do Help Desk">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-rose-600 dark:text-rose-300">
            Acesso negado. Apenas administradores ou líderes de time podem acessar esta página.
          </p>
        </div>
      </ModernLayout>
    );
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {presets.length > 0 && (
        <select
          onChange={(e) => {
            const preset = presets.find((p) => p.id === e.target.value);
            if (preset) handleLoadPreset(preset);
          }}
          className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          defaultValue=""
        >
          <option value="">Modelo de filtro</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      )}
      <button onClick={() => setShowSaveModal(true)} className={`${primaryButtonClass} inline-flex items-center gap-2`}>
        <Save className="h-4 w-4" />
        Salvar Modelo
      </button>
      <button onClick={handleExport} className={`${secondaryButtonClass} inline-flex items-center gap-2`}>
        <Download className="h-4 w-4" />
        Exportar
      </button>
    </div>
  );

  return (
    <ModernLayout
      title="Métricas e Relatórios"
      subtitle="Análise detalhada de performance e indicadores do Help Desk"
      headerActions={headerActions}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <MetricsFilterBar
            filters={filters}
            onChange={setFilters}
            userRole={user?.role}
            allowedTeamIds={user?.role === 'ADMIN' ? undefined : leadTeamIds}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-200 px-6 dark:border-slate-700">
            <nav className="flex gap-6 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      'inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap',
                      activeTab === tab.id
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="py-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
                <p className="mt-4 text-slate-500 dark:text-slate-400">Carregando métricas...</p>
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <p className="mb-4 text-rose-600 dark:text-rose-300">{error}</p>
                <button onClick={loadMetrics} className={primaryButtonClass}>
                  Tentar Novamente
                </button>
              </div>
            ) : !metrics ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400">Nenhuma métrica disponível</div>
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
      </div>

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
    </ModernLayout>
  );
};

export default MetricsPage;
