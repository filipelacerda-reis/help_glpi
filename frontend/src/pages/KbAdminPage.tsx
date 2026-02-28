import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { kbService, KbCategory, KbArticle } from '../services/kb.service';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import ModernLayout from '../components/ModernLayout';
import DarkModal from '../components/DarkModal';
import { Plus, Edit, Trash2, Eye, FolderKanban, FileText } from 'lucide-react';
import { RichTextEditor } from '../components/RichTextEditor';

// Configurar marked para preservar quebras de linha e espaços
marked.setOptions({
  breaks: true,
  gfm: true,
});

const KbAdminPage = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'categories' | 'articles'>('articles');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showViewArticleModal, setShowViewArticleModal] = useState(false);
  const [viewingArticle, setViewingArticle] = useState<KbArticle | null>(null);
  const [editingCategory, setEditingCategory] = useState<KbCategory | null>(null);
  const [editingArticle, setEditingArticle] = useState<KbArticle | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    parentId: '',
  });
  const [articleFormData, setArticleFormData] = useState({
    categoryId: '',
    title: '',
    content: '',
    status: 'DRAFT' as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    tags: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'articles') {
      loadArticles();
    }
  }, [activeTab, searchQuery]);

  const loadData = async () => {
    try {
      const categoriesData = await kbService.getAllCategories();
      setCategories(categoriesData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadArticles = async () => {
    try {
      const articlesData = await kbService.searchArticles({
        query: searchQuery || undefined,
        limit: 50,
      });
      setArticles(articlesData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar artigos');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingCategory) {
        await kbService.updateCategory(editingCategory.id, {
          name: categoryFormData.name,
          description: categoryFormData.description || undefined,
          parentId: categoryFormData.parentId || undefined,
        });
      } else {
        await kbService.createCategory({
          name: categoryFormData.name,
          description: categoryFormData.description || undefined,
          parentId: categoryFormData.parentId || undefined,
        });
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryFormData({ name: '', description: '', parentId: '' });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar categoria');
    }
  };

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const tags = articleFormData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (editingArticle) {
        await kbService.updateArticle(editingArticle.id, {
          categoryId: articleFormData.categoryId || undefined,
          title: articleFormData.title,
          content: articleFormData.content,
          status: articleFormData.status,
          tags: tags.length > 0 ? tags : undefined,
        });
      } else {
        await kbService.createArticle({
          categoryId: articleFormData.categoryId || undefined,
          title: articleFormData.title,
          content: articleFormData.content,
          status: articleFormData.status,
          tags: tags.length > 0 ? tags : undefined,
        });
      }
      setShowArticleModal(false);
      setEditingArticle(null);
      setArticleFormData({
        categoryId: '',
        title: '',
        content: '',
        status: 'DRAFT',
        tags: '',
      });
      loadArticles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar artigo');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta categoria?')) return;

    try {
      await kbService.deleteCategory(id);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir categoria');
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Deseja realmente excluir este artigo?')) return;

    try {
      await kbService.deleteArticle(id);
      loadArticles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir artigo');
    }
  };

  const headerActions = (
    <div className="flex gap-2">
      <button
        onClick={() => {
          setEditingCategory(null);
          setCategoryFormData({ name: '', description: '', parentId: '' });
          setShowCategoryModal(true);
        }}
        className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 rounded-lg text-sm font-medium text-white transition-colors"
      >
        <FolderKanban className="w-4 h-4" />
        <span>Nova Categoria</span>
      </button>
      <button
        onClick={() => {
          setEditingArticle(null);
          setArticleFormData({
            categoryId: '',
            title: '',
            content: '',
            status: 'DRAFT',
            tags: '',
          });
          setShowArticleModal(true);
        }}
        className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>Novo Artigo</span>
      </button>
    </div>
  );

  if (loading) {
    return (
      <ModernLayout title="Base de Conhecimento" subtitle="Gerenciar artigos e categorias" headerActions={headerActions}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  if (user?.role !== 'ADMIN' && user?.role !== 'TRIAGER') {
    return (
      <ModernLayout title="Base de Conhecimento" subtitle="Gerenciar artigos e categorias" headerActions={headerActions}>
        <div className="text-center py-12">
          <p className="text-red-400">Acesso negado. Apenas administradores e triagistas podem acessar esta página.</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Base de Conhecimento" subtitle="Gerenciar artigos e categorias" headerActions={headerActions}>
      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('articles')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'articles'
                ? 'border-etus-green text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-gray-200 hover:border-gray-500'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Artigos</span>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'categories'
                ? 'border-etus-green text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-gray-200 hover:border-gray-500'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>Categorias</span>
          </button>
        </nav>
      </div>

      {/* Artigos */}
      {activeTab === 'articles' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <input
              type="text"
              placeholder="Buscar artigos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="bg-white dark:bg-slate-800 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <div className="space-y-4">
              {articles.map((article) => (
                <div key={article.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-white">{article.title}</h3>
                      {article.category && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{article.category.name}</p>
                      )}
                      <div className="mt-2 flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            article.status === 'PUBLISHED'
                              ? 'bg-green-500/30 text-green-400'
                              : article.status === 'ARCHIVED'
                              ? 'bg-gray-600/50 text-slate-500 dark:text-slate-400'
                              : 'bg-yellow-500/30 text-yellow-400'
                          }`}
                        >
                          {article.status === 'PUBLISHED' ? 'Publicado' : article.status === 'ARCHIVED' ? 'Arquivado' : 'Rascunho'}
                        </span>
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {article.tags.map((tag) => (
                              <span key={tag} className="px-2 py-1 text-xs bg-gray-600/50 text-slate-600 dark:text-slate-300 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={async () => {
                          try {
                            const fullArticle = await kbService.getArticleById(article.id);
                            setViewingArticle(fullArticle);
                            setShowViewArticleModal(true);
                          } catch (err: any) {
                            setError(err.response?.data?.error || 'Erro ao carregar artigo');
                          }
                        }}
                        className="text-sm text-green-400 hover:text-green-300 transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingArticle(article);
                          setArticleFormData({
                            categoryId: article.categoryId || '',
                            title: article.title,
                            content: article.content,
                            status: article.status,
                            tags: article.tags.join(', '),
                          });
                          setShowArticleModal(true);
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {user?.role === 'ADMIN' && (
                        <button
                          onClick={() => handleDeleteArticle(article.id)}
                          className="text-sm text-red-400 hover:text-red-300 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {articles.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Nenhum artigo encontrado</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Categorias */}
      {activeTab === 'categories' && (
        <div className="bg-white dark:bg-slate-800 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-white">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{category.description}</p>
                    )}
                    {category.parent && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Categoria pai: {category.parent.name}</p>
                    )}
                    {category._count && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{category._count.articles} artigos</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingCategory(category);
                        setCategoryFormData({
                          name: category.name,
                          description: category.description || '',
                          parentId: category.parentId || '',
                        });
                        setShowCategoryModal(true);
                      }}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Nenhuma categoria encontrada</p>
            )}
          </div>
        </div>
      )}

      {/* Modal de Categoria */}
      <DarkModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategory(null);
        }}
        title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
      >
        <form onSubmit={handleCreateCategory}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nome <span className="text-red-400">*</span></label>
              <input
                type="text"
                required
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Descrição</label>
              <textarea
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Categoria Pai</label>
              <select
                value={categoryFormData.parentId}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, parentId: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Nenhuma</option>
                {categories
                  .filter((c) => c.id !== editingCategory?.id)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowCategoryModal(false);
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
              {editingCategory ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </DarkModal>

      {/* Modal de Artigo */}
      <DarkModal
        isOpen={showArticleModal}
        onClose={() => {
          setShowArticleModal(false);
          setEditingArticle(null);
        }}
        title={editingArticle ? 'Editar Artigo' : 'Novo Artigo'}
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateArticle}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Título <span className="text-red-400">*</span></label>
              <input
                type="text"
                required
                value={articleFormData.title}
                onChange={(e) => setArticleFormData({ ...articleFormData, title: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Categoria</label>
                <select
                  value={articleFormData.categoryId}
                  onChange={(e) => setArticleFormData({ ...articleFormData, categoryId: e.target.value })}
                  className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={articleFormData.status}
                  onChange={(e) =>
                    setArticleFormData({ ...articleFormData, status: e.target.value as any })
                  }
                  className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="PUBLISHED">Publicado</option>
                  <option value="ARCHIVED">Arquivado</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Conteúdo (Markdown) <span className="text-red-400">*</span></label>
              <RichTextEditor
                value={articleFormData.content}
                onChange={(value) => setArticleFormData({ ...articleFormData, content: value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Tags (separadas por vírgula)</label>
              <input
                type="text"
                value={articleFormData.tags}
                onChange={(e) => setArticleFormData({ ...articleFormData, tags: e.target.value })}
                className="block w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowArticleModal(false);
                setEditingArticle(null);
              }}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
            >
              {editingArticle ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </DarkModal>

      {/* Modal de Visualização de Artigo */}
      <DarkModal
        isOpen={showViewArticleModal}
        onClose={() => {
          setShowViewArticleModal(false);
          setViewingArticle(null);
        }}
        title={viewingArticle?.title || ''}
        maxWidth="4xl"
      >
        {viewingArticle && (
          <>
            <div className="mb-4">
              {viewingArticle.category && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Categoria: {viewingArticle.category.name}</p>
              )}
              <div className="flex items-center space-x-2 mb-2">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    viewingArticle.status === 'PUBLISHED'
                      ? 'bg-green-500/30 text-green-400'
                      : viewingArticle.status === 'ARCHIVED'
                      ? 'bg-gray-600/50 text-slate-500 dark:text-slate-400'
                      : 'bg-yellow-500/30 text-yellow-400'
                  }`}
                >
                  {viewingArticle.status === 'PUBLISHED' ? 'Publicado' : viewingArticle.status === 'ARCHIVED' ? 'Arquivado' : 'Rascunho'}
                </span>
                {viewingArticle.tags && viewingArticle.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {viewingArticle.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 text-xs bg-gray-600/50 text-slate-600 dark:text-slate-300 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {viewingArticle.createdBy && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Criado por: {viewingArticle.createdBy.name} em {new Date(viewingArticle.createdAt).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 max-h-[60vh] overflow-y-auto">
              <div
                className="prose prose-invert max-w-none
                  prose-headings:text-white
                  prose-p:text-slate-600 dark:text-slate-300
                  prose-strong:text-white
                  prose-code:text-slate-600 dark:text-slate-300 prose-code:bg-gray-800
                  prose-pre:bg-gray-900 prose-pre:text-gray-100
                  prose-a:text-indigo-600 dark:text-indigo-400
                  prose-blockquote:text-slate-500 dark:text-slate-400"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    marked.parse(viewingArticle.content) as string
                  ),
                }}
              />
            </div>
            <div className="mt-6 flex justify-end space-x-3 border-t border-slate-200 dark:border-slate-700 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowViewArticleModal(false);
                  setViewingArticle(null);
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowViewArticleModal(false);
                  setEditingArticle(viewingArticle);
                  setArticleFormData({
                    categoryId: viewingArticle.categoryId || '',
                    title: viewingArticle.title,
                    content: viewingArticle.content,
                    status: viewingArticle.status,
                    tags: viewingArticle.tags.join(', '),
                  });
                  setShowArticleModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
              >
                Editar
              </button>
            </div>
          </>
        )}
      </DarkModal>
    </ModernLayout>
  );
};

export default KbAdminPage;
