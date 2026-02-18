import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import ModernLayout from '../components/ModernLayout';
import CorporateFiltersBar from '../components/CorporateFiltersBar';
import { CHART_COLORS, CHART_LABEL_STYLE, CHART_TOOLTIP_STYLE } from '../config/charts';
import { corporateService, CorporateFilters, HrOverview } from '../services/corporate.service';

const HrPage = () => {
  const [data, setData] = useState<HrOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<CorporateFilters>({ months: 12, comparePrevious: true });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setData(await corporateService.getHrOverview(filters));
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao carregar módulo de RH');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters]);

  return (
    <ModernLayout title="RH" subtitle="Visão de colaboradores, times e alocação de ativos">
      <CorporateFiltersBar filters={filters} onChange={setFilters} />
      {loading && <div className="text-gray-300">Carregando dados de RH...</div>}
      {error && <div className="text-red-400">{error}</div>}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400">Total de colaboradores</p>
              <p className="text-xl font-semibold text-white">{data.totalEmployees}</p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400">Colaboradores ativos</p>
              <p className="text-xl font-semibold text-white">{data.activeEmployees}</p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400">Novas admissões (30 dias)</p>
              <p className="text-xl font-semibold text-white">{data.newHiresLast30Days}</p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400">Colaboradores com ativos</p>
              <p className="text-xl font-semibold text-white">{data.employeesWithAssets}</p>
            </div>
          </div>

          {data.comparison && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400">Comparação de admissões no período</p>
              <p className="text-lg text-white mt-1">
                {data.comparison.hires.current} vs {data.comparison.hires.previous}
              </p>
              <p className={`text-sm mt-1 ${data.comparison.hires.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.comparison.hires.delta >= 0 ? '+' : ''}
                {data.comparison.hires.delta}
                {data.comparison.hires.deltaPercent !== null ? ` (${data.comparison.hires.deltaPercent}%)` : ''}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Colaboradores por time</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byTeam}>
                    <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                    <XAxis dataKey="team" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} />
                    <Legend />
                    <Bar dataKey="count" name="Colaboradores" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Top funções</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.byRole} dataKey="count" nameKey="roleTitle" outerRadius={95} innerRadius={45}>
                      {data.byRole.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Admissões por mês</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.hiresByMonth}>
                  <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Admissões" stroke={CHART_COLORS[2]} strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </ModernLayout>
  );
};

export default HrPage;

