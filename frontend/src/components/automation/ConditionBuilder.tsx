import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Category } from '../../services/category.service';
import type { Team } from '../../services/team.service';
import type { TicketStatus, TicketPriority } from '../../types';

type FieldKey = 'status' | 'priority' | 'tipo' | 'teamId' | 'categoryId' | 'infraTipo';

export interface ConditionBuilderProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  teams: Team[];
  categories: Category[];
}

const FIELD_OPTIONS: { value: FieldKey; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'tipo', label: 'Tipo' },
  { value: 'teamId', label: 'Time' },
  { value: 'categoryId', label: 'Categoria' },
  { value: 'infraTipo', label: 'Infraestrutura' },
];

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'OPEN', label: 'Aberto' },
  { value: 'IN_PROGRESS', label: 'Em Progresso' },
  { value: 'WAITING_REQUESTER', label: 'Aguardando Solicitante' },
  { value: 'WAITING_THIRD_PARTY', label: 'Aguardando Terceiros' },
  { value: 'RESOLVED', label: 'Resolvido' },
  { value: 'CLOSED', label: 'Fechado' },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'CRITICAL', label: 'Crítica' },
];

const TIPO_OPTIONS = [
  { value: 'INCIDENT', label: 'Incidente' },
  { value: 'SERVICE_REQUEST', label: 'Requisição de Serviço' },
  { value: 'PROBLEM', label: 'Problema' },
  { value: 'CHANGE', label: 'Mudança' },
  { value: 'TASK', label: 'Tarefa' },
  { value: 'QUESTION', label: 'Dúvida' },
] as const;

const INFRA_OPTIONS = [
  { value: 'LOCAL', label: 'Local' },
  { value: 'NUVEM', label: 'Nuvem' },
  { value: 'HIBRIDA', label: 'Híbrida' },
  { value: 'ESTACAO_TRABALHO', label: 'Estação de Trabalho' },
  { value: 'REDE_LOCAL', label: 'Rede Local' },
  { value: 'SERVIDOR_FISICO', label: 'Servidor Físico' },
] as const;

type NewConditionState = {
  field: FieldKey | '';
  value: string;
};

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({ value, onChange, teams, categories }) => {
  const [newCondition, setNewCondition] = useState<NewConditionState>({ field: '', value: '' });

  const conditionsEntries = useMemo(() => Object.entries(value || {}), [value]);

  const flatCategories = useMemo(() => {
    const result: Array<{ id: string; label: string }> = [];

    const walk = (category: Category, prefix = '') => {
      const label = prefix ? `${prefix} › ${category.name}` : category.name;
      result.push({ id: category.id, label });
      if (category.subCategories && category.subCategories.length > 0) {
        category.subCategories.forEach((child) => walk(child, label));
      }
    };

    categories.forEach((c) => walk(c));
    return result;
  }, [categories]);

  const handleRemove = (key: string) => {
    const updated = { ...(value || {}) };
    delete updated[key];
    onChange(updated);
  };

  const handleAdd = () => {
    if (!newCondition.field || !newCondition.value) return;
    onChange({
      ...(value || {}),
      [newCondition.field]: newCondition.value,
    });
    setNewCondition({ field: '', value: '' });
  };

  const renderFieldLabel = (field: string): string => {
    const opt = FIELD_OPTIONS.find((f) => f.value === field);
    return opt ? opt.label : field;
  };

  const renderValueLabel = (field: string, rawValue: any): string => {
    if (!rawValue) return '';
    switch (field as FieldKey) {
      case 'status': {
        const opt = STATUS_OPTIONS.find((o) => o.value === rawValue);
        return opt?.label ?? String(rawValue);
      }
      case 'priority': {
        const opt = PRIORITY_OPTIONS.find((o) => o.value === rawValue);
        return opt?.label ?? String(rawValue);
      }
      case 'tipo': {
        const opt = TIPO_OPTIONS.find((o) => o.value === rawValue);
        return opt?.label ?? String(rawValue);
      }
      case 'teamId': {
        const team = teams.find((t) => t.id === rawValue);
        return team?.name ?? String(rawValue);
      }
      case 'categoryId': {
        const cat = flatCategories.find((c) => c.id === rawValue);
        return cat?.label ?? String(rawValue);
      }
      case 'infraTipo': {
        const opt = INFRA_OPTIONS.find((o) => o.value === rawValue);
        return opt?.label ?? String(rawValue);
      }
      default:
        return String(rawValue);
    }
  };

  const getValueOptions = (): { value: string; label: string }[] => {
    const field = newCondition.field;
    if (!field) return [];

    switch (field) {
      case 'status':
        return STATUS_OPTIONS;
      case 'priority':
        return PRIORITY_OPTIONS;
      case 'tipo':
        return TIPO_OPTIONS as unknown as { value: string; label: string }[];
      case 'teamId':
        return teams.map((t) => ({ value: t.id, label: t.name }));
      case 'categoryId':
        return flatCategories.map((c) => ({ value: c.id, label: c.label }));
      case 'infraTipo':
        return INFRA_OPTIONS as unknown as { value: string; label: string }[];
      default:
        return [];
    }
  };

  return (
    <div className="bg-gray-800/40 border border-gray-700/60 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">Condições</h4>
          <p className="text-xs text-gray-400">
            Defina quando a regra deve ser disparada. Todas as condições são combinadas com{' '}
            <span className="font-semibold">E (AND)</span>.
          </p>
        </div>
      </div>

      {/* Lista de condições existentes */}
      {conditionsEntries.length > 0 ? (
        <ul className="space-y-2">
          {conditionsEntries.map(([key, val]) => (
            <li
              key={key}
              className="flex items-center justify-between bg-gray-900/40 border border-gray-700/60 rounded-md px-3 py-2"
            >
              <div className="text-xs text-gray-200">
                <span className="font-semibold">{renderFieldLabel(key)}</span>{' '}
                <span className="text-gray-400">é</span>{' '}
                <span className="text-etus-green font-medium">
                  {renderValueLabel(key, val)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(key)}
                className="ml-2 text-gray-400 hover:text-red-400 transition-colors"
                aria-label="Remover condição"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500 italic">
          Nenhuma condição definida. A regra será aplicada a todos os tickets do evento.
        </p>
      )}

      {/* Adicionar nova condição */}
      <div className="border-t border-gray-700/60 pt-3 mt-3 space-y-2">
        <p className="text-xs text-gray-300 font-medium">Adicionar condição</p>
        <div className="flex flex-col md:flex-row md:items-end md:space-x-3 space-y-2 md:space-y-0">
          <div className="md:w-1/3">
            <label className="block text-xs text-gray-400 mb-1">Campo</label>
            <select
              value={newCondition.field}
              onChange={(e) =>
                setNewCondition((prev) => ({
                  ...prev,
                  field: e.target.value as FieldKey | '',
                  value: '',
                }))
              }
              className="w-full bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
            >
              <option value="">Selecione um campo...</option>
              {FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:w-1/2">
            <label className="block text-xs text-gray-400 mb-1">Valor</label>
            {newCondition.field ? (
              <select
                value={newCondition.value}
                onChange={(e) =>
                  setNewCondition((prev) => ({
                    ...prev,
                    value: e.target.value,
                  }))
                }
                className="w-full bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
              >
                <option value="">Selecione um valor...</option>
                {getValueOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-gray-500 italic">
                Selecione um campo para ver os valores disponíveis.
              </div>
            )}
          </div>

          <div className="md:w-auto">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newCondition.field || !newCondition.value}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium bg-etus-green text-gray-900 hover:bg-etus-green-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-full md:w-auto"
            >
              <Plus className="w-3 h-3 mr-1" />
              Adicionar condição
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConditionBuilder;


