import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { tagService, Tag } from '../services/tag.service';
import ModernLayout from '../components/ModernLayout';
import DarkModal from '../components/DarkModal';
import { Plus, Edit, Trash2, Power } from 'lucide-react';

const TagsPage = () => {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    group: 'FEATURE' as Tag['group'],
    isActive: true,
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    group: 'FEATURE' as Tag['group'],
    isActive: true,
  });

  const groupLabels: Record<Tag['group'], string> = {
    FEATURE: 'Feature',
    AREA: 'Área Impactada',
    ENV: 'Ambiente',
    PLATFORM: 'Plataforma',
    SOURCE: 'Origem',
    IMPACT: 'Impacto',
    RC: 'Causa Raiz',
    STATUS_REASON: 'Motivo do Status',
    WORK: 'Tipo de Trabalho',
    QUESTION: 'Tipo de Dúvida',
    INFRA: 'Infraestrutura',
  };

  const groupPrefixes: Record<Tag['group'], string> = {
    FEATURE: 'feature',
    AREA: 'area',
    ENV: 'env',
    PLATFORM: 'platform',
    SOURCE: 'source',
    IMPACT: 'impact',
    RC: 'rc',
    STATUS_REASON: 'status_reason',
    WORK: 'work',
    QUESTION: 'question',
    INFRA: 'infra',
  };

  useEffect(() => {
    loadTags();
  }, [filterGroup, filterActive]);

  const loadTags = async () => {
    try {
      const filters: any = {};
      if (filterGroup) filters.group = filterGroup;
      if (filterActive !== '') filters.isActive = filterActive === 'true';
      
      const data = await tagService.getAllTags(filters);
      setTags(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar tags');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      let tagName = formData.name.trim();
      const prefix = groupPrefixes[formData.group];
      if (!tagName.startsWith(`${prefix}:`)) {
        tagName = `${prefix}:${tagName}`;
      }
      
      await tagService.createTag({
        name: tagName,
        group: formData.group,
        isActive: formData.isActive,
      });
      setShowCreateModal(false);
      setFormData({
        name: '',
        group: 'FEATURE',
        isActive: true,
      });
      loadTags();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar tag');
    }
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    const prefix = groupPrefixes[tag.group];
    const nameWithoutPrefix = tag.name.startsWith(`${prefix}:`)
      ? tag.name.substring(prefix.length + 1)
      : tag.name;
    
    setEditFormData({
      name: nameWithoutPrefix,
      group: tag.group,
      isActive: tag.isActive,
    });
    setShowEditModal(true);
  };

  const handleUpdateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;
    setError('');

    try {
      let tagName = editFormData.name.trim();
      const prefix = groupPrefixes[editFormData.group];
      if (!tagName.startsWith(`${prefix}:`)) {
        tagName = `${prefix}:${tagName}`;
      }
      
      await tagService.updateTag(editingTag.id, {
        name: tagName,
        group: editFormData.group,
        isActive: editFormData.isActive,
      });
      setShowEditModal(false);
      setEditingTag(null);
      loadTags();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar tag');
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta tag? Se ela estiver associada a tickets, será desativada ao invés de excluída.')) return;

    try {
      await tagService.deleteTag(id);
      loadTags();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir tag');
    }
  };

  const handleToggleActive = async (tag: Tag) => {
    try {
      await tagService.updateTag(tag.id, {
        isActive: !tag.isActive,
      });
      loadTags();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar tag');
    }
  };

  const filteredTags = tags.filter((tag) => {
    if (filterGroup && tag.group !== filterGroup) return false;
    if (filterActive !== '' && tag.isActive !== (filterActive === 'true')) return false;
    return true;
  });

  const tagsByGroup = filteredTags.reduce((acc, tag) => {
    if (!acc[tag.group]) {
      acc[tag.group] = [];
    }
    acc[tag.group].push(tag);
    return acc;
  }, {} as Record<Tag['group'], Tag[]>);

  const headerActions = (
    <button
      onClick={() => setShowCreateModal(true)}
      className="inline-flex items-center space-x-2 px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span>Nova Tag</span>
    </button>
  );

  if (loading) {
    return (
      <ModernLayout title="Tags" subtitle="Gerenciar tags do sistema" headerActions={headerActions}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-gray-400">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  if (user?.role !== 'ADMIN') {
    return (
      <ModernLayout title="Tags" subtitle="Gerenciar tags do sistema" headerActions={headerActions}>
        <div className="text-center py-12">
          <p className="text-red-400">Acesso negado. Apenas administradores podem acessar esta página.</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Tags" subtitle="Gerenciar tags do sistema" headerActions={headerActions}>
      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Grupo</label>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
            >
              <option value="">Todos os grupos</option>
              {Object.entries(groupLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
            >
              <option value="">Todas</option>
              <option value="true">Ativas</option>
              <option value="false">Inativas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Tags por Grupo */}
      <div className="space-y-6">
        {Object.entries(tagsByGroup).map(([group, groupTags]) => (
          <div key={group} className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              {groupLabels[group as Tag['group']]} ({groupTags.length})
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupTags.map((tag) => {
                const prefix = groupPrefixes[tag.group];
                const displayName = tag.name.startsWith(`${prefix}:`)
                  ? tag.name.substring(prefix.length + 1)
                  : tag.name;
                
                return (
                  <div
                    key={tag.id}
                    className={`border rounded-lg p-4 ${
                      tag.isActive
                        ? 'border-gray-600/50 bg-gray-700/20'
                        : 'border-gray-700/50 bg-gray-800/30 opacity-75'
                    } hover:bg-gray-700/30 transition-colors`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-white">{displayName}</div>
                        <div className="text-xs text-gray-400 mt-1">{tag.name}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            tag.isActive
                              ? 'bg-etus-green/30 text-etus-green'
                              : 'bg-gray-600/50 text-gray-400'
                          }`}
                        >
                          {tag.isActive ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-3">
                      <button
                        onClick={() => handleToggleActive(tag)}
                        className="text-xs text-etus-green hover:text-etus-green-dark transition-colors"
                        title={tag.isActive ? 'Desativar' : 'Ativar'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditTag(tag)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(tagsByGroup).length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Nenhuma tag encontrada com os filtros selecionados.
          </div>
        )}
      </div>

      {/* Modal de Criação */}
      <DarkModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormData({ name: '', group: 'FEATURE', isActive: true });
        }}
        title="Nova Tag"
      >
        <form onSubmit={handleCreateTag}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Grupo</label>
              <select
                required
                value={formData.group}
                onChange={(e) => setFormData({ ...formData, group: e.target.value as Tag['group'] })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              >
                {Object.entries(groupLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Prefixo: {groupPrefixes[formData.group]}:
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nome <span className="text-red-400">*</span>
              </label>
              <div className="flex rounded-md">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-600 bg-gray-700/50 text-gray-400 text-sm">
                  {groupPrefixes[formData.group]}:
                </span>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="nome_da_tag"
                  className="flex-1 min-w-0 block w-full px-3 py-2 rounded-r-lg border border-gray-600 bg-gray-700/50 text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green sm:text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                O prefixo será adicionado automaticamente. Use apenas letras minúsculas, números e underscores.
              </p>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-600 bg-gray-700/50 text-etus-green focus:ring-etus-green"
              />
              <label className="ml-2 block text-sm text-gray-300">Tag ativa</label>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setFormData({ name: '', group: 'FEATURE', isActive: true });
              }}
              className="px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
            >
              Criar Tag
            </button>
          </div>
        </form>
      </DarkModal>

      {/* Modal de Edição */}
      <DarkModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingTag(null);
        }}
        title="Editar Tag"
      >
        <form onSubmit={handleUpdateTag}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Grupo</label>
              <select
                required
                value={editFormData.group}
                onChange={(e) => setEditFormData({ ...editFormData, group: e.target.value as Tag['group'] })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              >
                {Object.entries(groupLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Prefixo: {groupPrefixes[editFormData.group]}:
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nome <span className="text-red-400">*</span>
              </label>
              <div className="flex rounded-md">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-600 bg-gray-700/50 text-gray-400 text-sm">
                  {groupPrefixes[editFormData.group]}:
                </span>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="nome_da_tag"
                  className="flex-1 min-w-0 block w-full px-3 py-2 rounded-r-lg border border-gray-600 bg-gray-700/50 text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green sm:text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                O prefixo será adicionado automaticamente. Use apenas letras minúsculas, números e underscores.
              </p>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={editFormData.isActive}
                onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                className="rounded border-gray-600 bg-gray-700/50 text-etus-green focus:ring-etus-green"
              />
              <label className="ml-2 block text-sm text-gray-300">Tag ativa</label>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingTag(null);
              }}
              className="px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      </DarkModal>
    </ModernLayout>
  );
};

export default TagsPage;
