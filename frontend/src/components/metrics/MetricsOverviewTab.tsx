import { MetricsResponse, MetricsFilters } from '../../types/metrics.types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

interface MetricsOverviewTabProps {
  metrics: MetricsResponse;
  filters: MetricsFilters;
}

const COLORS = ['#8DF768', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export const MetricsOverviewTab: React.FC<MetricsOverviewTabProps> = ({ metrics, filters }) => {
  const navigate = useNavigate();

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours === 0) return `${mins}min`;
    return `${hours}h ${mins}min`;
  };

  const handlePriorityClick = (priority: string) => {
    navigate(`/tickets?priority=${priority}&startDate=${filters.startDate || ''}&endDate=${filters.endDate || ''}`);
  };

  const handleTeamClick = (teamId: string) => {
    navigate(`/tickets?teamSolicitanteId=${teamId}&startDate=${filters.startDate || ''}&endDate=${filters.endDate || ''}`);
  };

  const comparison = metrics.comparison;
  const hasComparison = !!comparison;

  return (
    <div className="space-y-6">
      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 hover:bg-gray-700/40 transition-colors">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Tickets Criados</h3>
          <p className="text-3xl font-bold text-white">{metrics.overview.createdCount}</p>
          {hasComparison && (
            <p className="text-xs text-gray-400 mt-2">
              Anterior: {comparison.overview.createdCount}
            </p>
          )}
        </div>
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 hover:bg-gray-700/40 transition-colors">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Tickets Resolvidos</h3>
          <p className="text-3xl font-bold text-white">{metrics.overview.resolvedCount}</p>
          {hasComparison && (
            <p className="text-xs text-gray-400 mt-2">
              Anterior: {comparison.overview.resolvedCount}
            </p>
          )}
        </div>
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 hover:bg-gray-700/40 transition-colors">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Backlog Atual</h3>
          <p className="text-3xl font-bold text-white">{metrics.overview.backlogCount}</p>
        </div>
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 hover:bg-gray-700/40 transition-colors">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">MTTA</h3>
          <p className="text-3xl font-bold text-white">
            {formatMinutes(metrics.overview.mtta)}
          </p>
          {hasComparison && comparison.overview.mtta !== null && (
            <p className="text-xs text-gray-400 mt-2">
              Anterior: {formatMinutes(comparison.overview.mtta)}
            </p>
          )}
        </div>
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 hover:bg-gray-700/40 transition-colors">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">MTTR</h3>
          <p className="text-3xl font-bold text-white">
            {formatMinutes(metrics.overview.mttr)}
          </p>
          {hasComparison && comparison.overview.mttr !== null && (
            <p className="text-xs text-gray-400 mt-2">
              Anterior: {formatMinutes(comparison.overview.mttr)}
            </p>
          )}
        </div>
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 hover:bg-gray-700/40 transition-colors">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">% SLA</h3>
          <p className="text-3xl font-bold text-white">
            {metrics.overview.slaCompliancePercent.toFixed(1)}%
          </p>
          {hasComparison && (
            <p className="text-xs text-gray-400 mt-2">
              Anterior: {comparison.overview.slaCompliancePercent.toFixed(1)}%
            </p>
          )}
        </div>
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 hover:bg-gray-700/40 transition-colors">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">% Reabertura</h3>
          <p className="text-3xl font-bold text-white">
            {metrics.overview.reopenRatePercent.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Gráfico de linha: Criados vs Resolvidos */}
      <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Tendência: Criados vs Resolvidos</h2>
        {metrics.overview.trendCreatedVsResolved.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.overview.trendCreatedVsResolved}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #4B5563',
                  borderRadius: '8px',
                  color: '#F3F4F6'
                }} 
              />
              <Legend wrapperStyle={{ color: '#F3F4F6' }} />
              <Line type="monotone" dataKey="created" stroke="#8DF768" strokeWidth={2} name="Criados" />
              <Line type="monotone" dataKey="resolved" stroke="#3B82F6" strokeWidth={2} name="Resolvidos" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-400">Nenhum dado disponível</div>
        )}
      </div>

      {/* Gráficos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por prioridade */}
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Distribuição por Prioridade</h2>
          {metrics.overview.priorityDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.overview.priorityDistribution}
                  dataKey="count"
                  nameKey="priority"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                  onClick={(data) => handlePriorityClick(data.priority)}
                  style={{ cursor: 'pointer' }}
                >
                  {metrics.overview.priorityDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #4B5563',
                    borderRadius: '8px',
                    color: '#F3F4F6'
                  }} 
                />
                <Legend wrapperStyle={{ color: '#F3F4F6' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-400">Nenhum dado disponível</div>
          )}
        </div>

        {/* Tickets por time solicitante */}
        <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Tickets por Time Solicitante</h2>
          {metrics.overview.ticketsByRequesterTeam.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={metrics.overview.ticketsByRequesterTeam.slice(0, 10)}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                <XAxis type="number" stroke="#9CA3AF" />
                <YAxis dataKey="teamName" type="category" width={120} stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #4B5563',
                    borderRadius: '8px',
                    color: '#F3F4F6'
                  }} 
                />
                <Bar
                  dataKey="count"
                  fill="#8DF768"
                  onClick={(data) => handleTeamClick(data.teamId)}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-400">Nenhum dado disponível</div>
          )}
        </div>
      </div>
    </div>
  );
};

