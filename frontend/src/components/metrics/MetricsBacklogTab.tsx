import { MetricsResponse } from '../../types/metrics.types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Link } from 'react-router-dom';

interface MetricsBacklogTabProps {
  metrics: MetricsResponse;
}

export const MetricsBacklogTab: React.FC<MetricsBacklogTabProps> = ({ metrics }) => {
  const formatAge = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    if (days === 0) return `${hours}h`;
    return `${days}d ${hours}h`;
  };

  const ageBucketLabels: Record<string, string> = {
    '0_8H': '0-8h',
    '8H_24H': '8-24h',
    '1_3D': '1-3 dias',
    '3_7D': '3-7 dias',
    GT_7D: '>7 dias',
  };

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500">Backlog Total</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">{metrics.backlog.totalOpen}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500">Idade Média do Backlog</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatAge(metrics.backlog.avgAgeMinutes)}
          </p>
        </div>
      </div>

      {/* Gráfico de tendência */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tendência: Criados vs Resolvidos</h2>
        {metrics.overview.trendCreatedVsResolved.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.overview.trendCreatedVsResolved}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="created" stroke="#8DF768" name="Criados" />
              <Line type="monotone" dataKey="resolved" stroke="#0088FE" name="Resolvidos" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">Nenhum dado disponível</div>
        )}
      </div>

      {/* Distribuição por buckets de idade */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Backlog por Idade</h2>
        {metrics.backlog.ageBuckets.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.backlog.ageBuckets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                tickFormatter={(value) => ageBucketLabels[value] || value}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8DF768" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">Nenhum dado disponível</div>
        )}
      </div>

      {/* Tabela de tickets mais antigos */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Tickets Mais Antigos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Idade</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.backlog.oldestTickets.map((ticket) => (
                <tr key={ticket.ticketId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <Link
                      to={`/tickets/${ticket.ticketId}`}
                      className="text-etus-green hover:text-etus-green-dark"
                    >
                      {ticket.ticketId.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticket.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ticket.teamName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ticket.priority || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatAge(ticket.ageMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

