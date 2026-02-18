import { CorporateFilters } from '../services/corporate.service';

interface CorporateFiltersBarProps {
  filters: CorporateFilters;
  onChange: (filters: CorporateFilters) => void;
}

export default function CorporateFiltersBar({ filters, onChange }: CorporateFiltersBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <select
        value={filters.months}
        onChange={(e) => onChange({ ...filters, months: Number(e.target.value) as 3 | 6 | 12 })}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
      >
        <option value={3}>Últimos 3 meses</option>
        <option value={6}>Últimos 6 meses</option>
        <option value={12}>Últimos 12 meses</option>
      </select>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={filters.comparePrevious}
          onChange={(e) => onChange({ ...filters, comparePrevious: e.target.checked })}
          className="rounded border-gray-600 bg-gray-800 text-etus-green"
        />
        Comparar com período anterior
      </label>
    </div>
  );
}

