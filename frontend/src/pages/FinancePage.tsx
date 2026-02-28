import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import ModernLayout from '../components/ModernLayout';
import CorporateFiltersBar from '../components/CorporateFiltersBar';
import { CHART_COLORS, CHART_LABEL_STYLE, CHART_TOOLTIP_STYLE } from '../config/charts';
import { corporateService, CorporateFilters, FinanceOverview } from '../services/corporate.service';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

const FinancePage = () => {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<CorporateFilters>({ months: 12, comparePrevious: true });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setData(await corporateService.getFinanceOverview(filters));
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao carregar módulo financeiro');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters]);

  return (
    <ModernLayout title="Financeiro" subtitle="Visão consolidada de custos e ativos">
      <CorporateFiltersBar filters={filters} onChange={setFilters} />
      {loading && <div className="text-slate-600 dark:text-slate-300">Carregando dados financeiros...</div>}
      {error && <div className="text-red-400">{error}</div>}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Valor total em ativos</p>
              <p className="text-xl font-semibold text-white">{formatCurrency(data.totalAssetValue)}</p>
            </div>
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Valor alocado</p>
              <p className="text-xl font-semibold text-white">{formatCurrency(data.assignedAssetValue)}</p>
            </div>
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Valor em estoque</p>
              <p className="text-xl font-semibold text-white">{formatCurrency(data.inStockAssetValue)}</p>
            </div>
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Chamados operacionais abertos</p>
              <p className="text-xl font-semibold text-white">{data.openTickets}</p>
            </div>
          </div>

          {data.comparison && (
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Comparação de compras no período</p>
              <p className="text-lg text-white mt-1">
                {formatCurrency(data.comparison.purchases.current)} vs {formatCurrency(data.comparison.purchases.previous)}
              </p>
              <p className={`text-sm mt-1 ${data.comparison.purchases.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.comparison.purchases.delta >= 0 ? '+' : ''}
                {formatCurrency(data.comparison.purchases.delta)}
                {data.comparison.purchases.deltaPercent !== null ? ` (${data.comparison.purchases.deltaPercent}%)` : ''}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Distribuição por tipo de equipamento</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.byType} dataKey="totalValue" nameKey="type" outerRadius={90} innerRadius={45}>
                    {data.byType.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Compras por mês</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.purchasesByMonth}>
                    <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                    <XAxis dataKey="month" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} />
                    <Line type="monotone" dataKey="total" stroke={CHART_COLORS[0]} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Movimentação de entregas</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { status: 'Ativos', total: data.assignments.active },
                      { status: 'Devolvidos', total: data.assignments.returned },
                    ]}
                  >
                    <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                    <XAxis dataKey="status" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} />
                    <Legend />
                    <Bar dataKey="total" name="Quantidade" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </ModernLayout>
  );
};

export default FinancePage;

