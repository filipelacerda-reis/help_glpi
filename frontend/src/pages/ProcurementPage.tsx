import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import ModernLayout from '../components/ModernLayout';
import CorporateFiltersBar from '../components/CorporateFiltersBar';
import { CHART_COLORS, CHART_LABEL_STYLE, CHART_TOOLTIP_STYLE } from '../config/charts';
import { corporateService, CorporateFilters, ProcurementOverview } from '../services/corporate.service';

const ProcurementPage = () => {
  const [data, setData] = useState<ProcurementOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<CorporateFilters>({ months: 12, comparePrevious: true });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setData(await corporateService.getProcurementOverview(filters));
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao carregar módulo de compras');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters]);

  return (
    <ModernLayout title="Compras" subtitle="Demanda de reposição e riscos operacionais">
      <CorporateFiltersBar filters={filters} onChange={setFilters} />
      {loading && <div className="text-slate-600 dark:text-slate-300">Carregando dados de compras...</div>}
      {error && <div className="text-red-400">{error}</div>}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Retornos atrasados</p>
              <p className="text-xl font-semibold text-white">{data.overdueReturns}</p>
            </div>
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Garantia vence em 45 dias</p>
              <p className="text-xl font-semibold text-white">{data.warrantyExpiring45Days}</p>
            </div>
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ativos aposentados/perdidos</p>
              <p className="text-xl font-semibold text-white">{data.retiredOrLostCount}</p>
            </div>
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Chamados operacionais pendentes</p>
              <p className="text-xl font-semibold text-white">{data.pendingOperationalTickets}</p>
            </div>
          </div>

          {data.comparison && (
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Comparação de chamados pendentes no período</p>
              <p className="text-lg text-white mt-1">
                {data.comparison.pendingTickets.current} vs {data.comparison.pendingTickets.previous}
              </p>
              <p className={`text-sm mt-1 ${data.comparison.pendingTickets.delta >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {data.comparison.pendingTickets.delta >= 0 ? '+' : ''}
                {data.comparison.pendingTickets.delta}
                {data.comparison.pendingTickets.deltaPercent !== null ? ` (${data.comparison.pendingTickets.deltaPercent}%)` : ''}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Demanda de reposição por tipo</h3>
              <div className="h-72">
                {data.replacementDemandByType.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Sem demanda crítica de reposição no momento.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.replacementDemandByType}>
                      <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                      <XAxis dataKey="type" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} />
                      <Legend />
                      <Bar dataKey="count" name="Demanda" fill={CHART_COLORS[3]} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Indicadores de risco</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { metric: 'Retornos atrasados', total: data.overdueReturns },
                      { metric: 'Garantias (45d)', total: data.warrantyExpiring45Days },
                      { metric: 'Aposentados/Perdidos', total: data.retiredOrLostCount },
                      { metric: 'Chamados pendentes', total: data.pendingOperationalTickets },
                    ]}
                  >
                    <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                    <XAxis dataKey="metric" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} />
                    <Legend />
                    <Bar dataKey="total" name="Quantidade" fill={CHART_COLORS[4]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Evolução de chamados pendentes</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.openTicketsByMonth}>
                  <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Pendências" stroke={CHART_COLORS[5]} strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </ModernLayout>
  );
};

export default ProcurementPage;

