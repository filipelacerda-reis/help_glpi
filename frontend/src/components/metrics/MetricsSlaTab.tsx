import { MetricsResponse } from '../../types/metrics.types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { CheckCircle, XCircle } from 'lucide-react';

interface MetricsSlaTabProps {
  metrics: MetricsResponse;
}

const COLORS = ['#8DF768', '#FF8042'];

export const MetricsSlaTab: React.FC<MetricsSlaTabProps> = ({ metrics }) => {
  const slaData = [
    {
      name: 'Dentro do SLA',
      value: metrics.sla.globalCompliancePercent,
    },
    {
      name: 'Fora do SLA',
      value: 100 - metrics.sla.globalCompliancePercent,
    },
  ];

  const sloStatus = metrics.sla.sloStatus || 'NOT_MET';
  const targetCompliance = metrics.sla.targetCompliance || 98.5;
  const isSloMet = sloStatus === 'MET';

  return (
    <div className="space-y-6">
      {/* Gauge/Donut Global com SLO */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Compliance Global de SLA</h2>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            isSloMet 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isSloMet ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              SLO {isSloMet ? 'Atingido' : 'Não Atingido'}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center mb-4">
          <div className="text-center">
            <div className={`text-5xl font-bold mb-2 ${
              isSloMet ? 'text-green-600' : 'text-red-600'
            }`}>
              {metrics.sla.globalCompliancePercent.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500">Dentro do SLA</div>
            <div className="text-xs text-gray-400 mt-1">
              Meta SLO: {targetCompliance.toFixed(1)}%
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={slaData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {slaData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Por Prioridade */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">SLA por Prioridade</h2>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 border border-blue-600"></div>
              <span>Meta SLO: {targetCompliance.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        {metrics.sla.byPriority.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.sla.byPriority}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="priority" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <ReferenceLine 
                y={targetCompliance} 
                stroke="#3b82f6" 
                strokeDasharray="5 5" 
                label={{ value: `Meta SLO: ${targetCompliance.toFixed(1)}%`, position: 'right' }}
              />
              <Bar dataKey="compliancePercent" fill="#8DF768" name="% Compliance" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">Nenhum dado disponível</div>
        )}
      </div>

      {/* Tabela por Time */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">SLA por Time</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% SLA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fora de SLA</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.sla.byTeam.map((item) => (
                <tr key={item.teamId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.teamName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.compliancePercent.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.total}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{item.outOfSla}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Violation Buckets */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Violações de SLA por Tempo</h2>
        <div className="grid grid-cols-3 gap-4">
          {metrics.sla.violationBuckets.map((bucket) => (
            <div key={bucket.bucket} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{bucket.count}</div>
              <div className="text-sm text-gray-500 mt-1">
                {bucket.bucket === 'UP_TO_1H' && 'Até 1h'}
                {bucket.bucket === 'BETWEEN_1H_4H' && '1h - 4h'}
                {bucket.bucket === 'MORE_THAN_4H' && 'Mais de 4h'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

