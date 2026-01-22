import React, { useMemo, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { AutomationRule } from '../../services/automation.service';
import type { Team } from '../../services/team.service';
import type { Tag } from '../../services/tag.service';
import type { User } from '../../services/user.service';
import type { TicketStatus, TicketPriority } from '../../types';

type AutomationAction = AutomationRule['actions'][number];

export interface ActionBuilderProps {
  value: AutomationAction[];
  onChange: (value: AutomationAction[]) => void;
  teams: Team[];
  tags: Tag[];
  technicians: User[];
}

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

const ACTION_TYPE_OPTIONS = [
  { value: 'SET_PRIORITY', label: 'Alterar prioridade' },
  { value: 'SET_STATUS', label: 'Alterar status' },
  { value: 'SET_TEAM', label: 'Alterar time' },
  { value: 'ASSIGN_TO_TECHNICIAN', label: 'Atribuir técnico' },
  { value: 'ADD_TAG', label: 'Adicionar tag' },
  { value: 'CALL_WEBHOOK', label: 'Chamar Webhook (N8N / externo)' },
] as const;

type NewActionState = {
  type: AutomationAction['type'] | '';
  priority?: TicketPriority;
  status?: TicketStatus;
  teamId?: string;
  technicianId?: string;
  tagId?: string;
  url?: string;
  method?: 'POST' | 'PUT';
  headers: Array<{ key: string; value: string }>;
};

const DEFAULT_NEW_ACTION: NewActionState = {
  type: '',
  method: 'POST',
  headers: [],
};

const ActionBuilder: React.FC<ActionBuilderProps> = ({ value, onChange, teams, tags, technicians }) => {
  const [newAction, setNewAction] = useState<NewActionState>(DEFAULT_NEW_ACTION);

  const technicianOptions = useMemo(
    () => technicians.filter((u) => u.role === 'TECHNICIAN'),
    [technicians]
  );

  const handleRemove = (index: number) => {
    const updated = [...value];
    updated.splice(index, 1);
    onChange(updated);
  };

  const moveAction = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= value.length) return;
    const updated = [...value];
    const [item] = updated.splice(index, 1);
    updated.splice(newIndex, 0, item);
    onChange(updated);
  };

  const handleAddHeader = () => {
    setNewAction((prev) => ({
      ...prev,
      headers: [...prev.headers, { key: '', value: '' }],
    }));
  };

  const handleHeaderChange = (idx: number, field: 'key' | 'value', val: string) => {
    setNewAction((prev) => {
      const headers = [...prev.headers];
      headers[idx] = { ...headers[idx], [field]: val };
      return { ...prev, headers };
    });
  };

  const handleRemoveHeader = (idx: number) => {
    setNewAction((prev) => {
      const headers = [...prev.headers];
      headers.splice(idx, 1);
      return { ...prev, headers };
    });
  };

  const resetNewAction = () => {
    setNewAction(DEFAULT_NEW_ACTION);
  };

  const handleAddAction = () => {
    if (!newAction.type) return;

    let action: AutomationAction | null = null;

    switch (newAction.type) {
      case 'SET_PRIORITY':
        if (!newAction.priority) return;
        action = { type: 'SET_PRIORITY', priority: newAction.priority };
        break;
      case 'SET_STATUS':
        if (!newAction.status) return;
        action = { type: 'SET_STATUS', status: newAction.status };
        break;
      case 'SET_TEAM':
        if (!newAction.teamId) return;
        action = { type: 'SET_TEAM', teamId: newAction.teamId };
        break;
      case 'ASSIGN_TO_TECHNICIAN':
        if (!newAction.technicianId) return;
        action = { type: 'ASSIGN_TO_TECHNICIAN', technicianId: newAction.technicianId };
        break;
      case 'ADD_TAG':
        if (!newAction.tagId) return;
        action = { type: 'ADD_TAG', tagId: newAction.tagId };
        break;
      case 'CALL_WEBHOOK': {
        if (!newAction.url) return;
        const headersObj: Record<string, string> = {};
        newAction.headers
          .filter((h) => h.key.trim())
          .forEach((h) => {
            headersObj[h.key.trim()] = h.value;
          });
        action = {
          type: 'CALL_WEBHOOK',
          url: newAction.url,
          method: newAction.method || 'POST',
          ...(Object.keys(headersObj).length > 0 ? { headers: headersObj } : {}),
        };
        break;
      }
      default:
        break;
    }

    if (!action) return;

    onChange([...(value || []), action]);
    resetNewAction();
  };

  const describeAction = (action: AutomationAction): string => {
    switch (action.type) {
      case 'SET_PRIORITY': {
        const opt = PRIORITY_OPTIONS.find((o) => o.value === action.priority);
        return `Definir prioridade: ${opt?.label ?? action.priority}`;
      }
      case 'SET_STATUS': {
        const opt = STATUS_OPTIONS.find((o) => o.value === action.status);
        return `Definir status: ${opt?.label ?? action.status}`;
      }
      case 'SET_TEAM': {
        const team = teams.find((t) => t.id === action.teamId);
        return `Definir time: ${team?.name ?? action.teamId}`;
      }
      case 'ASSIGN_TO_TECHNICIAN': {
        const tech = technicians.find((t) => t.id === action.technicianId);
        return `Atribuir ao técnico: ${tech?.name ?? action.technicianId}`;
      }
      case 'ADD_TAG': {
        const tag = tags.find((t) => t.id === action.tagId);
        return `Adicionar tag: ${tag?.name ?? action.tagId}`;
      }
      case 'CALL_WEBHOOK':
        return `Chamar webhook: ${action.url} (${(action.method || 'POST').toUpperCase()})`;
      default:
        return action.type;
    }
  };

  return (
    <div className="bg-gray-800/40 border border-gray-700/60 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">Ações</h4>
          <p className="text-xs text-gray-400">
            Defina o que deve acontecer quando as condições forem atendidas. As ações são executadas na ordem da lista.
          </p>
        </div>
      </div>

      {/* Lista de ações existentes */}
      {value && value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((action, index) => (
            <li
              key={index}
              className="flex items-start justify-between bg-gray-900/40 border border-gray-700/60 rounded-md px-3 py-2"
            >
              <div className="flex-1 text-xs text-gray-200">
                <span className="font-semibold">{describeAction(action)}</span>
              </div>
              <div className="flex items-center space-x-2 ml-3">
                <button
                  type="button"
                  onClick={() => moveAction(index, 'up')}
                  disabled={index === 0}
                  className="text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Mover para cima"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveAction(index, 'down')}
                  disabled={index === value.length - 1}
                  className="text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Mover para baixo"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                  aria-label="Remover ação"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500 italic">
          Nenhuma ação definida. Adicione pelo menos uma ação para que a regra tenha efeito.
        </p>
      )}

      {/* Adicionar nova ação */}
      <div className="border-t border-gray-700/60 pt-3 mt-3 space-y-3">
        <p className="text-xs text-gray-300 font-medium">Adicionar ação</p>

        <div className="flex flex-col md:flex-row md:items-start md:space-x-3 space-y-3 md:space-y-0">
          <div className="md:w-1/3">
            <label className="block text-xs text-gray-400 mb-1">Tipo de ação</label>
            <select
              value={newAction.type}
              onChange={(e) =>
                setNewAction({
                  ...DEFAULT_NEW_ACTION,
                  type: e.target.value as NewActionState['type'],
                })
              }
              className="w-full bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
            >
              <option value="">Selecione um tipo...</option>
              {ACTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Campos dinâmicos por tipo de ação */}
          <div className="flex-1 space-y-2">
            {newAction.type === 'SET_PRIORITY' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Prioridade</label>
                <select
                  value={newAction.priority || ''}
                  onChange={(e) =>
                    setNewAction((prev) => ({ ...prev, priority: e.target.value as TicketPriority }))
                  }
                  className="w-full bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
                >
                  <option value="">Selecione...</option>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newAction.type === 'SET_STATUS' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select
                  value={newAction.status || ''}
                  onChange={(e) =>
                    setNewAction((prev) => ({ ...prev, status: e.target.value as TicketStatus }))
                  }
                  className="w-full bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
                >
                  <option value="">Selecione...</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newAction.type === 'SET_TEAM' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Time</label>
                <select
                  value={newAction.teamId || ''}
                  onChange={(e) =>
                    setNewAction((prev) => ({ ...prev, teamId: e.target.value || undefined }))
                  }
                  className="w-full bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
                >
                  <option value="">Selecione...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newAction.type === 'ASSIGN_TO_TECHNICIAN' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Técnico</label>
                <select
                  value={newAction.technicianId || ''}
                  onChange={(e) =>
                    setNewAction((prev) => ({ ...prev, technicianId: e.target.value || undefined }))
                  }
                  className="w-full bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
                >
                  <option value="">Selecione...</option>
                  {technicianOptions.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newAction.type === 'ADD_TAG' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tag</label>
                <select
                  value={newAction.tagId || ''}
                  onChange={(e) =>
                    setNewAction((prev) => ({ ...prev, tagId: e.target.value || undefined }))
                  }
                  className="w-full bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
                >
                  <option value="">Selecione...</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name} ({tag.group})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newAction.type === 'CALL_WEBHOOK' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">URL do Webhook</label>
                  <input
                    type="url"
                    value={newAction.url || ''}
                    onChange={(e) =>
                      setNewAction((prev) => ({ ...prev, url: e.target.value || undefined }))
                    }
                    className="w-full bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
                    placeholder="https://seu-n8n.com/webhook/..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Método HTTP</label>
                  <select
                    value={newAction.method || 'POST'}
                    onChange={(e) =>
                      setNewAction((prev) => ({
                        ...prev,
                        method: (e.target.value as 'POST' | 'PUT') || 'POST',
                      }))
                    }
                    className="w-32 bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
                  >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Headers opcionais</span>
                    <button
                      type="button"
                      onClick={handleAddHeader}
                      className="inline-flex items-center text-[11px] text-etus-green hover:text-etus-green-dark"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Adicionar header
                    </button>
                  </div>
                  {newAction.headers.length === 0 && (
                    <p className="text-[11px] text-gray-500 italic">
                      Nenhum header definido. Clique em &quot;Adicionar header&quot; para enviar tokens, etc.
                    </p>
                  )}
                  {newAction.headers.map((header, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={header.key}
                        onChange={(e) => handleHeaderChange(idx, 'key', e.target.value)}
                        placeholder="Nome (ex: Authorization)"
                        className="flex-1 bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
                      />
                      <input
                        type="text"
                        value={header.value}
                        onChange={(e) => handleHeaderChange(idx, 'value', e.target.value)}
                        placeholder="Valor"
                        className="flex-1 bg-gray-900/60 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:ring-1 focus:ring-etus-green focus:border-etus-green"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHeader(idx)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                        aria-label="Remover header"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAddAction}
            disabled={!newAction.type}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium bg-etus-green text-gray-900 hover:bg-etus-green-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3 h-3 mr-1" />
            Adicionar ação
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionBuilder;


