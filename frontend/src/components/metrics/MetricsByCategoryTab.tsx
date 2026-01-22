import { MetricsResponse } from '../../types/metrics.types';
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MetricsByCategoryTabProps {
  metrics: MetricsResponse;
}

export const MetricsByCategoryTab: React.FC<MetricsByCategoryTabProps> = ({ metrics }) => {

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    const hours = Math.floor(minutes / 60);
    return `${hours.toFixed(1)}h`;
  };

  const topCategories = [...metrics.byCategoryAndTag.byCategory]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Gráfico Top 10 Categorias */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Categorias por Volume</h2>
        {topCategories.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCategories} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="categoryName" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="count" fill="#8DF768" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">Nenhum dado disponível</div>
        )}
      </div>

      {/* Gráfico Volume + MTTR por Categoria */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Volume e MTTR por Categoria</h2>
        {topCategories.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={topCategories}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="categoryName" angle={-45} textAnchor="end" height={100} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="count" fill="#8DF768" name="Volume" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="mttr"
                stroke="#0088FE"
                name="MTTR (min)"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">Nenhum dado disponível</div>
        )}
      </div>

      {/* Tabela de Tags */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Métricas por Tag</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volume</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MTTR</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% SLA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Reabertura</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.byCategoryAndTag.byTag.slice(0, 20).map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.tag}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatMinutes(item.mttr)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.slaCompliancePercent.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.reopenRatePercent.toFixed(1)}%
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

