import { useState } from 'react';
import { MetricsFilters } from '../../types/metrics.types';

interface SavePresetModalProps {
  filters: MetricsFilters;
  onClose: () => void;
  onSave: (name: string, description?: string) => Promise<void>;
}

export const SavePresetModal: React.FC<SavePresetModalProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      await onSave(name.trim(), description.trim() || undefined);
    } catch (error) {
      console.error('Erro ao salvar preset:', error);
      alert('Erro ao salvar preset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Salvar Modelo de Relatório</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do modelo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-etus-green focus:border-etus-green sm:text-sm"
              placeholder="Ex: Relatório Mensal SRE"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-etus-green focus:border-etus-green sm:text-sm"
              placeholder="Descrição do modelo..."
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-etus-green hover:bg-etus-green-dark disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

