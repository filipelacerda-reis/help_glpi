import { useEffect, useMemo, useState } from 'react';
import ModernLayout from '../components/ModernLayout';
import { employeeService, Employee } from '../services/employee.service';
import { teamService, Team } from '../services/team.service';
import { useAuth } from '../contexts/AuthContext';

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

const EmployeesPage = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'TRIAGER';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    cpf: '',
    roleTitle: '',
    teamId: '',
    hireDate: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [employeesData, teamsData] = await Promise.all([
        employeeService.getAll(),
        teamService.getAllTeams(),
      ]);
      setEmployees(employeesData);
      setTeams(teamsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!query.trim()) return employees;
    const q = query.toLowerCase();
    return employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(q) ||
        employee.cpf.includes(q.replace(/\D/g, '')) ||
        employee.roleTitle.toLowerCase().includes(q) ||
        employee.team?.name.toLowerCase().includes(q)
    );
  }, [employees, query]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '',
      cpf: '',
      roleTitle: '',
      teamId: '',
      hireDate: '',
    });
  };

  const handleEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setForm({
      name: employee.name,
      cpf: formatCpf(employee.cpf),
      roleTitle: employee.roleTitle,
      teamId: employee.teamId || '',
      hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : '',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        cpf: form.cpf,
        roleTitle: form.roleTitle,
        teamId: form.teamId || null,
        hireDate: form.hireDate || null,
      };

      if (editingId) {
        await employeeService.update(editingId, payload);
      } else {
        await employeeService.create(payload);
      }

      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar funcionário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) return;
    if (!confirm('Remover este funcionário?')) return;
    setError('');
    try {
      await employeeService.delete(id);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao remover funcionário');
    }
  };

  return (
    <ModernLayout
      title="Funcionários"
      subtitle="Cadastro de colaboradores e vínculo com times"
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <div className="mb-4">
            <input
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-gray-800 px-3 py-2 text-sm text-white"
              placeholder="Buscar por nome, CPF, função ou time"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="text-slate-600 dark:text-slate-300">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-300 dark:border-slate-700 text-left text-slate-600 dark:text-slate-300">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">CPF</th>
                    <th className="py-2 pr-4">Função</th>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Equipamentos Ativos</th>
                    {canManage && <th className="py-2">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b border-slate-300 dark:border-slate-700/70 text-gray-100">
                      <td className="py-2 pr-4">{employee.name}</td>
                      <td className="py-2 pr-4">{formatCpf(employee.cpf)}</td>
                      <td className="py-2 pr-4">{employee.roleTitle}</td>
                      <td className="py-2 pr-4">{employee.team?.name || '-'}</td>
                      <td className="py-2 pr-4">{employee.activeAssignmentsCount || 0}</td>
                      {canManage && (
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              className="rounded bg-blue-600 px-2 py-1 text-xs"
                              onClick={() => handleEdit(employee)}
                            >
                              Editar
                            </button>
                            <button
                              className="rounded bg-red-600 px-2 py-1 text-xs"
                              onClick={() => handleDelete(employee.id)}
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canManage && (
          <form
            onSubmit={handleSave}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
          >
            <h2 className="mb-4 text-lg font-semibold text-white">
              {editingId ? 'Editar Funcionário' : 'Novo Funcionário'}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="Nome"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <input
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="CPF"
                value={form.cpf}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, cpf: formatCpf(e.target.value) }))
                }
                required
              />
              <input
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="Função"
                value={form.roleTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, roleTitle: e.target.value }))}
                required
              />
              <select
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-gray-800 px-3 py-2 text-sm text-white"
                value={form.teamId}
                onChange={(e) => setForm((prev) => ({ ...prev, teamId: e.target.value }))}
              >
                <option value="">Sem time</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-gray-800 px-3 py-2 text-sm text-white"
                value={form.hireDate}
                onChange={(e) => setForm((prev) => ({ ...prev, hireDate: e.target.value }))}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
              >
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="rounded bg-gray-600 px-4 py-2 text-sm"
                  onClick={resetForm}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </ModernLayout>
  );
};

export default EmployeesPage;

