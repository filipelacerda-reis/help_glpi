import { useEffect, useMemo, useState } from 'react';
import ModernLayout from '../components/ModernLayout';
import { useAuth } from '../contexts/AuthContext';
import {
  employeeService,
  Employee,
  EmployeeDetails,
  EmployeeEquipmentsFilter,
  EmployeeEquipmentsSortBy,
  EmployeeEquipmentsSortDir,
} from '../services/employee.service';
import {
  equipmentService,
  Equipment,
  EquipmentAlertsData,
  EquipmentCondition,
  EquipmentDashboardData,
  EquipmentStatus,
  EquipmentType,
} from '../services/equipment.service';

const EQUIPMENT_TYPES: EquipmentType[] = [
  'NOTEBOOK',
  'DESKTOP',
  'MONITOR',
  'KEYBOARD',
  'MOUSE',
  'HEADSET',
  'HUB_USB',
  'DOCK',
  'PHONE',
  'TABLET',
  'CHARGER',
  'OTHER',
];

const CONDITIONS: EquipmentCondition[] = ['NEW', 'GOOD', 'FAIR', 'DAMAGED'];
const FINAL_STATUSES: EquipmentStatus[] = ['IN_STOCK', 'MAINTENANCE', 'RETIRED', 'LOST'];
const EMPLOYEE_MODAL_FILTERS: EmployeeEquipmentsFilter[] = ['ACTIVE', 'RETURNED', 'ALL'];
const EMPLOYEE_MODAL_SORTS: EmployeeEquipmentsSortBy[] = [
  'ASSIGNED_AT',
  'RETURNED_AT',
  'ASSET_TAG',
  'EQUIPMENT_TYPE',
];

const typeLabel: Record<EquipmentType, string> = {
  NOTEBOOK: 'Notebook',
  DESKTOP: 'Desktop',
  MONITOR: 'Monitor',
  KEYBOARD: 'Teclado',
  MOUSE: 'Mouse',
  HEADSET: 'Headset',
  HUB_USB: 'Hub USB',
  DOCK: 'Dock',
  PHONE: 'Telefone',
  TABLET: 'Tablet',
  CHARGER: 'Carregador',
  OTHER: 'Outro',
};

const statusLabel: Record<EquipmentStatus, string> = {
  IN_STOCK: 'Em estoque',
  ASSIGNED: 'Entregue',
  MAINTENANCE: 'Manutenção',
  RETIRED: 'Baixado',
  LOST: 'Extraviado',
};

const conditionLabel: Record<EquipmentCondition, string> = {
  NEW: 'Novo',
  GOOD: 'Bom',
  FAIR: 'Regular',
  DAMAGED: 'Danificado',
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
};

const employeeFilterLabel: Record<EmployeeEquipmentsFilter, string> = {
  ACTIVE: 'Ativos',
  RETURNED: 'Devolvidos',
  ALL: 'Todos',
};

const employeeSortLabel: Record<EmployeeEquipmentsSortBy, string> = {
  ASSIGNED_AT: 'Data de entrega',
  RETURNED_AT: 'Data de devolução',
  ASSET_TAG: 'Patrimônio',
  EQUIPMENT_TYPE: 'Tipo',
};

const EquipmentsPage = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'TRIAGER';

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dashboard, setDashboard] = useState<EquipmentDashboardData | null>(null);
  const [alerts, setAlerts] = useState<EquipmentAlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [form, setForm] = useState({
    invoiceNumber: '',
    purchaseDate: '',
    equipmentType: 'NOTEBOOK' as EquipmentType,
    assetTag: '',
    value: '',
    serialNumber: '',
    brand: '',
    model: '',
    condition: 'NEW' as EquipmentCondition,
    warrantyEndDate: '',
    notes: '',
  });

  const [assigningEquipmentId, setAssigningEquipmentId] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    expectedReturnAt: '',
    deliveryCondition: 'GOOD' as EquipmentCondition,
    deliveryTermNumber: '',
    notes: '',
  });

  const [returningAssignmentId, setReturningAssignmentId] = useState<string | null>(null);
  const [returnForm, setReturnForm] = useState({
    returnCondition: 'GOOD' as EquipmentCondition,
    finalStatus: 'IN_STOCK' as EquipmentStatus,
    notes: '',
  });
  const [viewingEmployeeId, setViewingEmployeeId] = useState<string | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<EmployeeDetails | null>(null);
  const [employeeModalLoading, setEmployeeModalLoading] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeEquipmentsFilter>('ACTIVE');
  const [employeeSortBy, setEmployeeSortBy] = useState<EmployeeEquipmentsSortBy>('ASSIGNED_AT');
  const [employeeSortDir, setEmployeeSortDir] = useState<EmployeeEquipmentsSortDir>('desc');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [equipmentsData, employeesData, dashboardData, alertsData] = await Promise.all([
        equipmentService.getAll(),
        employeeService.getAll({ active: true }),
        equipmentService.getDashboard(30),
        equipmentService.getAlerts(30),
      ]);
      setEquipments(equipmentsData);
      setEmployees(employeesData);
      setDashboard(dashboardData);
      setAlerts(alertsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dados de equipamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEquipments = useMemo(() => {
    if (!query.trim()) return equipments;
    const q = query.toLowerCase();
    return equipments.filter(
      (equipment) =>
        equipment.assetTag.toLowerCase().includes(q) ||
        equipment.invoiceNumber.toLowerCase().includes(q) ||
        (equipment.serialNumber || '').toLowerCase().includes(q) ||
        (equipment.brand || '').toLowerCase().includes(q) ||
        (equipment.model || '').toLowerCase().includes(q)
    );
  }, [equipments, query]);

  const employeeAssignments = useMemo(() => {
    if (!viewingEmployee) return [];

    const q = employeeSearchQuery.trim().toLowerCase();

    const filtered = viewingEmployee.assignments.filter((assignment) => {
      const scopeMatch =
        employeeFilter === 'ACTIVE'
          ? !assignment.returnedAt
          : employeeFilter === 'RETURNED'
            ? !!assignment.returnedAt
            : true;

      if (!scopeMatch) return false;
      if (!q) return true;

      const equipment = assignment.equipment;
      return (
        equipment.assetTag.toLowerCase().includes(q) ||
        equipment.invoiceNumber.toLowerCase().includes(q) ||
        equipment.equipmentType.toLowerCase().includes(q) ||
        (equipment.serialNumber || '').toLowerCase().includes(q) ||
        (equipment.brand || '').toLowerCase().includes(q) ||
        (equipment.model || '').toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      const direction = employeeSortDir === 'asc' ? 1 : -1;

      if (employeeSortBy === 'ASSET_TAG') {
        return a.equipment.assetTag.localeCompare(b.equipment.assetTag) * direction;
      }
      if (employeeSortBy === 'EQUIPMENT_TYPE') {
        return a.equipment.equipmentType.localeCompare(b.equipment.equipmentType) * direction;
      }

      const aDate =
        employeeSortBy === 'RETURNED_AT' ? (a.returnedAt ? new Date(a.returnedAt).getTime() : 0) : new Date(a.assignedAt).getTime();
      const bDate =
        employeeSortBy === 'RETURNED_AT' ? (b.returnedAt ? new Date(b.returnedAt).getTime() : 0) : new Date(b.assignedAt).getTime();
      return (aDate - bDate) * direction;
    });
  }, [employeeFilter, employeeSearchQuery, employeeSortBy, employeeSortDir, viewingEmployee]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setError('');
    try {
      await equipmentService.create({
        invoiceNumber: form.invoiceNumber,
        purchaseDate: form.purchaseDate,
        equipmentType: form.equipmentType,
        assetTag: form.assetTag,
        value: Number(form.value),
        serialNumber: form.serialNumber || undefined,
        brand: form.brand || undefined,
        model: form.model || undefined,
        condition: form.condition,
        warrantyEndDate: form.warrantyEndDate || null,
        notes: form.notes || undefined,
      });

      setForm({
        invoiceNumber: '',
        purchaseDate: '',
        equipmentType: 'NOTEBOOK',
        assetTag: '',
        value: '',
        serialNumber: '',
        brand: '',
        model: '',
        condition: 'NEW',
        warrantyEndDate: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao cadastrar equipamento');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningEquipmentId) return;

    try {
      await equipmentService.assign(assigningEquipmentId, {
        employeeId: assignForm.employeeId,
        expectedReturnAt: assignForm.expectedReturnAt || null,
        deliveryCondition: assignForm.deliveryCondition,
        deliveryTermNumber: assignForm.deliveryTermNumber || undefined,
        notes: assignForm.notes || undefined,
      });
      setAssigningEquipmentId(null);
      setAssignForm({
        employeeId: '',
        expectedReturnAt: '',
        deliveryCondition: 'GOOD',
        deliveryTermNumber: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao entregar equipamento');
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningAssignmentId) return;

    try {
      await equipmentService.returnAssignment(returningAssignmentId, {
        returnCondition: returnForm.returnCondition,
        finalStatus: returnForm.finalStatus,
        notes: returnForm.notes || undefined,
      });
      setReturningAssignmentId(null);
      setReturnForm({
        returnCondition: 'GOOD',
        finalStatus: 'IN_STOCK',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao registrar devolução');
    }
  };

  const handleDownloadTerm = async (assignmentId: string, assetTag: string) => {
    try {
      const blob = await equipmentService.downloadAssignmentTermPdf(assignmentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `termo-entrega-${assetTag}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao baixar termo de entrega');
    }
  };

  const openEmployeeModal = async (employeeId: string) => {
    setEmployeeFilter('ACTIVE');
    setEmployeeSortBy('ASSIGNED_AT');
    setEmployeeSortDir('desc');
    setEmployeeSearchQuery('');
    setViewingEmployeeId(employeeId);
    setViewingEmployee(null);
    setEmployeeModalLoading(true);
    try {
      const data = await employeeService.getById(employeeId);
      setViewingEmployee(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dados do funcionário');
      setViewingEmployeeId(null);
    } finally {
      setEmployeeModalLoading(false);
    }
  };

  const closeEmployeeModal = () => {
    setViewingEmployeeId(null);
    setViewingEmployee(null);
    setEmployeeModalLoading(false);
    setEmployeeFilter('ACTIVE');
    setEmployeeSortBy('ASSIGNED_AT');
    setEmployeeSortDir('desc');
    setEmployeeSearchQuery('');
  };

  const handleDownloadEmployeePdf = async () => {
    if (!viewingEmployee?.id) return;
    try {
      const blob = await employeeService.downloadEquipmentsPdf(viewingEmployee.id, {
        filter: employeeFilter,
        sortBy: employeeSortBy,
        sortDir: employeeSortDir,
        query: employeeSearchQuery.trim() || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = viewingEmployee.name.replace(/\s+/g, '-').toLowerCase();
      link.download = `equipamentos-${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao baixar PDF dos equipamentos');
    }
  };

  return (
    <ModernLayout
      title="Equipamentos"
      subtitle="Controle de patrimônio, entrega e devolução de ativos"
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {dashboard && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-gray-600/50 bg-gray-700/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Total de ativos</div>
              <div className="mt-1 text-2xl font-semibold text-white">{dashboard.totalEquipments}</div>
            </div>
            <div className="rounded-lg border border-gray-600/50 bg-gray-700/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Entregues</div>
              <div className="mt-1 text-2xl font-semibold text-white">{dashboard.assignedCount}</div>
            </div>
            <div className="rounded-lg border border-gray-600/50 bg-gray-700/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Em estoque</div>
              <div className="mt-1 text-2xl font-semibold text-white">{dashboard.inStockCount}</div>
            </div>
            <div className="rounded-lg border border-gray-600/50 bg-gray-700/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Valor total</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                R$ {dashboard.totalValue.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {alerts && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
            <h3 className="mb-3 text-base font-semibold text-white">Alertas operacionais</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-sm text-yellow-200">
                  Garantias vencendo em 30 dias ({alerts.warrantyExpiring.length})
                </div>
                <ul className="space-y-1 text-xs text-gray-200">
                  {alerts.warrantyExpiring.slice(0, 6).map((item) => (
                    <li key={item.id}>
                      {item.assetTag} ({typeLabel[item.equipmentType]}) - vence em{' '}
                      {item.daysToExpire} dia(s){' '}
                      {item.assignedTo ? `- com ${item.assignedTo}` : ''}
                    </li>
                  ))}
                  {alerts.warrantyExpiring.length === 0 && <li>Sem alertas de garantia.</li>}
                </ul>
              </div>
              <div>
                <div className="mb-2 text-sm text-orange-200">
                  Devoluções atrasadas ({alerts.overdueReturns.length})
                </div>
                <ul className="space-y-1 text-xs text-gray-200">
                  {alerts.overdueReturns.slice(0, 6).map((item) => (
                    <li key={item.assignmentId}>
                      {item.assetTag} ({typeLabel[item.equipmentType]}) - {item.employeeName} -{' '}
                      {item.daysOverdue} dia(s) de atraso
                    </li>
                  ))}
                  {alerts.overdueReturns.length === 0 && <li>Sem devoluções atrasadas.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-gray-600/50 bg-gray-700/30 p-4">
          <div className="mb-4">
            <input
              className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
              placeholder="Buscar por patrimônio, NF, serial, marca ou modelo"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="text-gray-300">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-600 text-left text-gray-300">
                    <th className="py-2 pr-4">Patrimônio</th>
                    <th className="py-2 pr-4">Tipo</th>
                    <th className="py-2 pr-4">NF</th>
                    <th className="py-2 pr-4">Valor</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Condição</th>
                    <th className="py-2 pr-4">Responsável</th>
                    {canManage && <th className="py-2">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredEquipments.map((equipment) => {
                    const activeAssignment = equipment.assignments?.[0];
                    return (
                      <tr
                        key={equipment.id}
                        className="border-b border-gray-700/70 text-gray-100"
                      >
                        <td className="py-2 pr-4">{equipment.assetTag}</td>
                        <td className="py-2 pr-4">{typeLabel[equipment.equipmentType]}</td>
                        <td className="py-2 pr-4">{equipment.invoiceNumber}</td>
                        <td className="py-2 pr-4">
                          R$ {Number(equipment.value).toFixed(2)}
                        </td>
                        <td className="py-2 pr-4">{statusLabel[equipment.status]}</td>
                        <td className="py-2 pr-4">{conditionLabel[equipment.condition]}</td>
                        <td className="py-2 pr-4">
                          {activeAssignment?.employee ? (
                            <button
                              type="button"
                              className="underline decoration-dotted text-etus-green hover:text-etus-green-dark"
                              onClick={() => openEmployeeModal(activeAssignment.employee!.id)}
                            >
                              {activeAssignment.employee.name}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        {canManage && (
                          <td className="py-2">
                            {equipment.status === 'ASSIGNED' && activeAssignment ? (
                              <>
                                <button
                                  className="rounded bg-orange-600 px-2 py-1 text-xs"
                                  onClick={() => setReturningAssignmentId(activeAssignment.id)}
                                >
                                  Registrar devolução
                                </button>
                                <button
                                  className="ml-2 rounded bg-gray-600 px-2 py-1 text-xs"
                                  onClick={() =>
                                    handleDownloadTerm(activeAssignment.id, equipment.assetTag)
                                  }
                                >
                                  Baixar termo
                                </button>
                              </>
                            ) : (
                              <button
                                className="rounded bg-etus-green px-2 py-1 text-xs text-gray-900"
                                onClick={() => setAssigningEquipmentId(equipment.id)}
                              >
                                Entregar
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canManage && (
          <form
            onSubmit={handleCreate}
            className="rounded-lg border border-gray-600/50 bg-gray-700/30 p-4"
          >
            <h2 className="mb-4 text-lg font-semibold text-white">Novo Equipamento</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="Nota Fiscal"
                value={form.invoiceNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                required
              />
              <input
                type="date"
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                value={form.purchaseDate}
                onChange={(e) => setForm((prev) => ({ ...prev, purchaseDate: e.target.value }))}
                required
              />
              <select
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                value={form.equipmentType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, equipmentType: e.target.value as EquipmentType }))
                }
              >
                {EQUIPMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel[type]}
                  </option>
                ))}
              </select>
              <input
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="Patrimônio"
                value={form.assetTag}
                onChange={(e) => setForm((prev) => ({ ...prev, assetTag: e.target.value }))}
                required
              />
              <input
                type="number"
                step="0.01"
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="Valor"
                value={form.value}
                onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
                required
              />
              <select
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                value={form.condition}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, condition: e.target.value as EquipmentCondition }))
                }
              >
                {CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {conditionLabel[condition]}
                  </option>
                ))}
              </select>
              <input
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="Serial"
                value={form.serialNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, serialNumber: e.target.value }))}
              />
              <input
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="Marca"
                value={form.brand}
                onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
              />
              <input
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="Modelo"
                value={form.model}
                onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
              />
              <input
                type="date"
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white md:col-span-2"
                value={form.warrantyEndDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, warrantyEndDate: e.target.value }))
                }
              />
              <input
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white md:col-span-3"
                placeholder="Observações"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="mt-4 rounded bg-etus-green px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Cadastrar equipamento'}
            </button>
          </form>
        )}

        {canManage && assigningEquipmentId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 p-4">
            <form
              onSubmit={handleAssign}
              className="w-full max-w-2xl rounded-xl border border-green-500/50 bg-gray-800 p-5 shadow-2xl"
            >
              <h3 className="mb-4 text-base font-semibold text-white">Entrega de equipamento</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                  value={assignForm.employeeId}
                  onChange={(e) =>
                    setAssignForm((prev) => ({ ...prev, employeeId: e.target.value }))
                  }
                  required
                >
                  <option value="">Selecione o funcionário</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} - {employee.roleTitle}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                  value={assignForm.expectedReturnAt}
                  onChange={(e) =>
                    setAssignForm((prev) => ({ ...prev, expectedReturnAt: e.target.value }))
                  }
                />
                <select
                  className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                  value={assignForm.deliveryCondition}
                  onChange={(e) =>
                    setAssignForm((prev) => ({
                      ...prev,
                      deliveryCondition: e.target.value as EquipmentCondition,
                    }))
                  }
                >
                  {CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {conditionLabel[condition]}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                  placeholder="Nº termo de entrega"
                  value={assignForm.deliveryTermNumber}
                  onChange={(e) =>
                    setAssignForm((prev) => ({
                      ...prev,
                      deliveryTermNumber: e.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white md:col-span-2"
                  placeholder="Observações"
                  value={assignForm.notes}
                  onChange={(e) =>
                    setAssignForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
              <div className="mt-5 flex gap-2">
                <button className="rounded bg-etus-green px-4 py-2 text-sm font-semibold text-gray-900">
                  Confirmar entrega
                </button>
                <button
                  type="button"
                  className="rounded bg-gray-600 px-4 py-2 text-sm text-white"
                  onClick={() => setAssigningEquipmentId(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {canManage && returningAssignmentId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 p-4">
            <form
              onSubmit={handleReturn}
              className="w-full max-w-xl rounded-xl border border-orange-500/50 bg-gray-800 p-5 shadow-2xl"
            >
              <h3 className="mb-4 text-base font-semibold text-white">Devolução de equipamento</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                  value={returnForm.returnCondition}
                  onChange={(e) =>
                    setReturnForm((prev) => ({
                      ...prev,
                      returnCondition: e.target.value as EquipmentCondition,
                    }))
                  }
                >
                  {CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {conditionLabel[condition]}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                  value={returnForm.finalStatus}
                  onChange={(e) =>
                    setReturnForm((prev) => ({
                      ...prev,
                      finalStatus: e.target.value as EquipmentStatus,
                    }))
                  }
                >
                  {FINAL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel[status]}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white md:col-span-2"
                  placeholder="Observações"
                  value={returnForm.notes}
                  onChange={(e) =>
                    setReturnForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
              <div className="mt-5 flex gap-2">
                <button className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-gray-900">
                  Confirmar devolução
                </button>
                <button
                  type="button"
                  className="rounded bg-gray-600 px-4 py-2 text-sm text-white"
                  onClick={() => setReturningAssignmentId(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {viewingEmployeeId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 p-4">
            <div className="w-full max-w-4xl rounded-xl border border-gray-600 bg-gray-800 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Equipamentos do colaborador</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-etus-green px-3 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
                    disabled={!viewingEmployee || employeeModalLoading}
                    onClick={handleDownloadEmployeePdf}
                  >
                    Exportar PDF
                  </button>
                  <button
                    type="button"
                    className="rounded bg-gray-600 px-3 py-2 text-sm text-white"
                    onClick={closeEmployeeModal}
                  >
                    Fechar
                  </button>
                </div>
              </div>

              {employeeModalLoading && <div className="text-gray-300">Carregando colaborador...</div>}

              {!employeeModalLoading && viewingEmployee && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-700 bg-gray-700/30 p-4 md:grid-cols-5">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">Nome</div>
                      <div className="text-sm text-white">{viewingEmployee.name}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">CPF</div>
                      <div className="text-sm text-white">{viewingEmployee.cpf}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">Time</div>
                      <div className="text-sm text-white">{viewingEmployee.team?.name || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">Função</div>
                      <div className="text-sm text-white">{viewingEmployee.roleTitle}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">Admissão</div>
                      <div className="text-sm text-white">{formatDate(viewingEmployee.hireDate)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-700 bg-gray-700/30 p-3 md:grid-cols-4">
                    <div className="md:col-span-4">
                      <div className="mb-1 text-xs uppercase tracking-wide text-gray-400">Buscar na lista</div>
                      <input
                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                        placeholder="Patrimônio, NF, tipo, serial, marca ou modelo"
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wide text-gray-400">Escopo</div>
                      <select
                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                        value={employeeFilter}
                        onChange={(e) => setEmployeeFilter(e.target.value as EmployeeEquipmentsFilter)}
                      >
                        {EMPLOYEE_MODAL_FILTERS.map((filter) => (
                          <option key={filter} value={filter}>
                            {employeeFilterLabel[filter]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wide text-gray-400">Ordenar por</div>
                      <select
                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                        value={employeeSortBy}
                        onChange={(e) => setEmployeeSortBy(e.target.value as EmployeeEquipmentsSortBy)}
                      >
                        {EMPLOYEE_MODAL_SORTS.map((sortBy) => (
                          <option key={sortBy} value={sortBy}>
                            {employeeSortLabel[sortBy]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wide text-gray-400">Direção</div>
                      <select
                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
                        value={employeeSortDir}
                        onChange={(e) => setEmployeeSortDir(e.target.value as EmployeeEquipmentsSortDir)}
                      >
                        <option value="desc">Decrescente</option>
                        <option value="asc">Crescente</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <div className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200">
                        Itens no escopo: {employeeAssignments.length}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-600 text-left text-gray-300">
                          <th className="py-2 pr-3">Patrimônio</th>
                          <th className="py-2 pr-3">Tipo</th>
                          <th className="py-2 pr-3">NF</th>
                          <th className="py-2 pr-3">Valor</th>
                          <th className="py-2 pr-3">Entrega</th>
                          <th className="py-2 pr-3">Devolução</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3">Termo</th>
                          <th className="py-2 pr-3">Cond. entrega</th>
                          <th className="py-2 pr-3">Cond. devolução</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeAssignments.map((assignment) => (
                            <tr
                              key={assignment.id}
                              className="border-b border-gray-700/70 text-gray-100"
                            >
                              <td className="py-2 pr-3">{assignment.equipment.assetTag}</td>
                              <td className="py-2 pr-3">
                                {typeLabel[assignment.equipment.equipmentType as EquipmentType] ||
                                  assignment.equipment.equipmentType}
                              </td>
                              <td className="py-2 pr-3">{assignment.equipment.invoiceNumber}</td>
                              <td className="py-2 pr-3">
                                R$ {Number(assignment.equipment.value).toFixed(2)}
                              </td>
                              <td className="py-2 pr-3">{formatDate(assignment.assignedAt)}</td>
                              <td className="py-2 pr-3">{formatDate(assignment.returnedAt)}</td>
                              <td className="py-2 pr-3">{assignment.returnedAt ? 'Devolvido' : 'Ativo'}</td>
                              <td className="py-2 pr-3">{assignment.deliveryTermNumber || '-'}</td>
                              <td className="py-2 pr-3">
                                {conditionLabel[assignment.deliveryCondition as EquipmentCondition] ||
                                  assignment.deliveryCondition}
                              </td>
                              <td className="py-2 pr-3">
                                {assignment.returnCondition
                                  ? conditionLabel[assignment.returnCondition as EquipmentCondition] || assignment.returnCondition
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {employeeAssignments.length === 0 && (
                      <div className="mt-3 text-sm text-gray-300">Nenhum equipamento encontrado no filtro selecionado.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModernLayout>
  );
};

export default EquipmentsPage;
