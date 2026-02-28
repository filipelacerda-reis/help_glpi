import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { categoryService, Category, CreateCategoryDto, UpdateCategoryDto } from '../services/category.service';
import ModernLayout from '../components/ModernLayout';
import DarkModal from '../components/DarkModal';
import { Plus, Edit, Trash2 } from 'lucide-react';

const CategoriesPage = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [filterActive, setFilterActive] = useState<string>('true');
  const [formData, setFormData] = useState<CreateCategoryDto>({
    name: '',
    parentCategoryId: undefined,
    active: true,
  });
  const [editFormData, setEditFormData] = useState<UpdateCategoryDto>({
    name: '',
    parentCategoryId: null,
    active: true,
  });

  useEffect(() => {
    loadCategories();
  }, [filterActive]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const activeOnly = filterActive === 'true';
      const data = await categoryService.getAllCategories(activeOnly);
      setCategories(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await categoryService.createCategory({
        name: formData.name.trim(),
        parentCategoryId: formData.parentCategoryId || undefined,
        active: formData.active ?? true,
      });
      setShowCreateModal(false);
      setFormData({
        name: '',
        parentCategoryId: undefined,
        active: true,
      });
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar categoria');
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setEditFormData({
      name: category.name,
      parentCategoryId: category.parentCategoryId || null,
      active: category.active,
    });
    setShowEditModal(true);
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setError('');

    try {
      await categoryService.updateCategory(editingCategory.id, {
        name: editFormData.name?.trim(),
        parentCategoryId: editFormData.parentCategoryId,
        active: editFormData.active,
      });
      setShowEditModal(false);
      setEditingCategory(null);
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar categoria');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const category = categories.find((c) => c.id === id);
    if (!confirm(`Deseja realmente excluir a categoria "${category?.name}"? Esta ação não pode ser desfeita e só é permitida se não houver tickets ou subcategorias associadas.`)) {
      return;
    }

    try {
      await categoryService.deleteCategory(id);
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir categoria');
    }
  };

  const getRootCategories = () => {
    return categories.filter((cat) => !cat.parentCategoryId);
  };

  const getSubCategories = (parentId: string) => {
    return categories.filter((cat) => cat.parentCategoryId === parentId);
  };

  const renderCategoryTree = (category: Category, level: number = 0) => {
    const subCategories = getSubCategories(category.id);
    return (
      <div key={category.id} className={`${level > 0 ? 'ml-6 mt-2' : ''}`}>
        <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-white">{category.name}</h3>
              {!category.active && (
                <span className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-gray-600/50 rounded">
                  Inativa
                </span>
              )}
              {category.parentCategory && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  (Pai: {category.parentCategory.name})
                </span>
              )}
            </div>
            {subCategories.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {subCategories.length} subcategoria{subCategories.length > 1 ? 's' : ''}
              </p>
            )}
            {category.teams && category.teams.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Times vinculados:</p>
                <div className="flex flex-wrap gap-1">
                  {category.teams.map((teamLink: any) => (
                    <span
                      key={teamLink.teamId || teamLink.team?.id}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-600/30 text-blue-400 border border-blue-500/50"
                    >
                      {teamLink.team?.name || 'Time sem nome'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {user?.role === 'ADMIN' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleEditCategory(category)}
                className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 border border-blue-500/50 rounded hover:bg-blue-500/20 transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteCategory(category.id)}
                className="px-3 py-1 text-sm text-red-400 hover:text-red-300 border border-red-500/50 rounded hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        {subCategories.map((subCat) => renderCategoryTree(subCat, level + 1))}
      </div>
    );
  };

  const headerActions = user?.role === 'ADMIN' ? (
    <button
      onClick={() => setShowCreateModal(true)}
      className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span>Nova Categoria</span>
    </button>
  ) : undefined;

  if (loading) {
    return (
      <ModernLayout title="Categorias" subtitle="Gerenciar categorias de chamados" headerActions={headerActions}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Carregando categorias...</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Categorias" subtitle="Gerenciar categorias de chamados" headerActions={headerActions}>
      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-6 bg-white dark:bg-slate-800 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Status</label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="true">Apenas Ativas</option>
              <option value="false">Apenas Inativas</option>
              <option value="">Todas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Categorias */}
      <div className="bg-white dark:bg-slate-800 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg">
        {categories.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            Nenhuma categoria encontrada
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {getRootCategories().map((category) => renderCategoryTree(category))}
          </div>
        )}
      </div>

      {/* Modal de Criação */}
      <DarkModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormData({
            name: '',
            parentCategoryId: undefined,
            active: true,
          });
        }}
        title="Nova Categoria"
      >
        <form onSubmit={handleCreateCategory}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nome <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ex: Infraestrutura"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Categoria Pai (opcional)
              </label>
              <select
                value={formData.parentCategoryId || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    parentCategoryId: e.target.value || undefined,
                  })
                }
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Nenhuma (categoria raiz)</option>
                {categories
                  .filter((c) => c.active && c.id !== formData.parentCategoryId)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={formData.active ?? true}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-4 w-4 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 rounded"
              />
              <label htmlFor="active" className="ml-2 block text-sm text-slate-600 dark:text-slate-300">
                Categoria ativa
              </label>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setFormData({
                  name: '',
                  parentCategoryId: undefined,
                  active: true,
                });
              }}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
            >
              Criar
            </button>
          </div>
        </form>
      </DarkModal>

      {/* Modal de Edição */}
      <DarkModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCategory(null);
        }}
        title="Editar Categoria"
      >
        <form onSubmit={handleUpdateCategory}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nome <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Categoria Pai (opcional)
              </label>
              <select
                value={editFormData.parentCategoryId || ''}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    parentCategoryId: e.target.value || null,
                  })
                }
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Nenhuma (categoria raiz)</option>
                {categories
                  .filter((c) => c.active && c.id !== editingCategory?.id)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="editActive"
                checked={editFormData.active ?? true}
                onChange={(e) => setEditFormData({ ...editFormData, active: e.target.checked })}
                className="h-4 w-4 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 rounded"
              />
              <label htmlFor="editActive" className="ml-2 block text-sm text-slate-600 dark:text-slate-300">
                Categoria ativa
              </label>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingCategory(null);
              }}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      </DarkModal>
    </ModernLayout>
  );
};

export default CategoriesPage;
