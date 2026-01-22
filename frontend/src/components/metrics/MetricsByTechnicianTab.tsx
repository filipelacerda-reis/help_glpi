import { MetricsResponse } from '../../types/metrics.types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface MetricsByTechnicianTabProps {
  metrics: MetricsResponse;
}

export const MetricsByTechnicianTab: React.FC<MetricsByTechnicianTabProps> = ({ metrics }) => {
  const navigate = useNavigate();

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours === 0) return `${mins}min`;
    return `${hours}h ${mins}min`;
  };

  const handleTechnicianClick = (technicianId: string) => {
    navigate(`/tickets?technicianId=${technicianId}`);
  };

  const topTechnicians = [...metrics.byTechnician.items]
    .sort((a, b) => b.resolved - a.resolved)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Tabela */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Métricas por Técnico</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Técnico</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Atribuídos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resolvidos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Backlog</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MTTA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MTTR</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% SLA</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.byTechnician.items.map((item) => (
                <tr
                  key={item.technicianId}
                  onClick={() => handleTechnicianClick(item.technicianId)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.technicianName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.teamName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.assigned}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.resolved}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.backlog}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatMinutes(item.mtta)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatMinutes(item.mttr)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.slaCompliancePercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico Top N técnicos */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Técnicos por Tickets Resolvidos</h2>
        {topTechnicians.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topTechnicians} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="technicianName" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="resolved" fill="#8DF768" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">Nenhum dado disponível</div>
        )}
      </div>
    </div>
  );
};

