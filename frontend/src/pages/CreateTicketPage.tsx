import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ticketService } from '../services/ticket.service';
import { categoryService, Category } from '../services/category.service';
import { teamService, Team } from '../services/team.service';
import { tagService, Tag } from '../services/tag.service';
import { UserAutocomplete } from '../components/UserAutocomplete';
import { TicketAutocomplete } from '../components/TicketAutocomplete';
import { RichTextEditor } from '../components/RichTextEditor';
import { FileUpload } from '../components/FileUpload';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { kbService, KbArticle, AiSolution } from '../services/kb.service';
import ModernLayout from '../components/ModernLayout';
import DarkModal from '../components/DarkModal';

marked.setOptions({
  breaks: true,
  gfm: true,
});

const CreateTicketPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [availableTicketTypes, setAvailableTicketTypes] = useState<string[]>([]);
  
  // Verificar se há dados do chat para pré-preencher
  const chatData = location.state as { title?: string; description?: string; fromChat?: boolean } | null;
  
  const [formData, setFormData] = useState({
    title: chatData?.title || '',
    description: chatData?.description || '',
    categoryId: '',
    teamId: '',
    priority: 'MEDIUM',
    tipo: 'INCIDENT' as 'INCIDENT' | 'SERVICE_REQUEST' | 'PROBLEM' | 'CHANGE' | 'TASK' | 'QUESTION',
    infraTipo: '' as '' | 'LOCAL' | 'NUVEM' | 'HIBRIDA' | 'ESTACAO_TRABALHO' | 'REDE_LOCAL' | 'SERVIDOR_FISICO',
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedObserverIds, setSelectedObserverIds] = useState<string[]>([]);
  const [kbSuggestions, setKbSuggestions] = useState<KbArticle[]>([]);
  const [showKbSuggestions, setShowKbSuggestions] = useState(false);
  const [selectedKbArticle, setSelectedKbArticle] = useState<KbArticle | null>(null);
  const [aiSolution, setAiSolution] = useState<string | null>(null);
  const [showAiSolution, setShowAiSolution] = useState(true);
  // RAG Solution (Gemini)
  const [ragSolution, setRagSolution] = useState<{ text: string; visible: boolean }>({ text: '', visible: false });
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  // Gestão de Projetos
  const [parentTicketId, setParentTicketId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('');
  const [customFields] = useState<Record<string, any>>({});

  const handleDescriptionChange = async (value: string) => {
    setFormData({ ...formData, description: value });
    // Chamar sugestões se título > 5 caracteres OU descrição > 100 caracteres
    // NOTA: Não usamos mais aiSolution do suggestArticles - apenas artigos da KB
    // A solução RAG (Gemini) é gerada separadamente no useEffect com debounce
    if (formData.title.length > 5 || value.length > 100) {
      try {
        const response = await kbService.suggestArticles({
          title: formData.title,
          description: value,
        });
        setKbSuggestions(response.articles);
        if (response.articles.length > 0) {
          setShowKbSuggestions(true);
        }
        // NÃO usar response.aiSolution aqui - apenas o Gemini RAG deve gerar soluções
      } catch (err) {
        // Silenciar erros de sugestões
      }
    }
  };

  const handleFilesSelected = (files: File[]) => {
    setSelectedImages(files);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, teamsData, tagsData] = await Promise.all([
          categoryService.getAllCategories(),
          teamService.getAllTeams(),
          tagService.getAllTags({ isActive: true }),
        ]);
        setAllCategories(categoriesData);
        setCategories(categoriesData);
        setTeams(teamsData);
        setTags(tagsData);
      } catch (error: any) {
        console.error('Erro ao carregar dados:', error);
        setError(error.response?.data?.error || 'Erro ao carregar times e categorias. Verifique se você está autenticado.');
      }
    };
    loadData();
  }, []);

  // Filtrar categorias e tipos de chamados quando um time for selecionado
  useEffect(() => {
    const filterByTeam = async () => {
      if (!formData.teamId) {
        // Se nenhum time estiver selecionado, mostrar todas as categorias e tipos
        setCategories(allCategories);
        setAvailableTicketTypes(['INCIDENT', 'SERVICE_REQUEST', 'PROBLEM', 'CHANGE', 'TASK', 'QUESTION']);
        return;
      }

      try {
        // Buscar categorias filtradas por time
        const filteredCategories = await categoryService.getAllCategories(true, formData.teamId);
        setCategories(filteredCategories);

        // Buscar tipos de chamados disponíveis para o time
        const ticketTypes = await teamService.getTeamTicketTypes(formData.teamId);
        setAvailableTicketTypes(ticketTypes.length > 0 ? ticketTypes : ['INCIDENT', 'SERVICE_REQUEST', 'PROBLEM', 'CHANGE', 'TASK', 'QUESTION']);

        // Se o tipo de chamado atual não estiver disponível, resetar para o primeiro disponível
        if (ticketTypes.length > 0 && !ticketTypes.includes(formData.tipo)) {
          setFormData({ ...formData, tipo: ticketTypes[0] as typeof formData.tipo });
        }

        // Se a categoria atual não estiver disponível, limpar a seleção
        if (formData.categoryId && !filteredCategories.find(c => c.id === formData.categoryId)) {
          setFormData({ ...formData, categoryId: '' });
        }
      } catch (error: any) {
        console.error('Erro ao filtrar por time:', error);
        // Em caso de erro, manter todas as categorias e tipos disponíveis
        setCategories(allCategories);
        setAvailableTicketTypes(['INCIDENT', 'SERVICE_REQUEST', 'PROBLEM', 'CHANGE', 'TASK', 'QUESTION']);
      }
    };

    filterByTeam();
  }, [formData.teamId, allCategories]);

  // Debounce para gerar solução RAG
  useEffect(() => {
    // Só processar se tiver conteúdo suficiente
    if (formData.title.length < 5 && formData.description.length < 5) {
      setRagSolution({ text: '', visible: false });
      return;
    }

    // Limpar timeout anterior
    const timeoutId = setTimeout(async () => {
      setIsGeneratingAi(true);
      try {
        const result = await kbService.getAiSolution({
          title: formData.title,
          description: formData.description,
          categoryId: formData.categoryId || undefined,
        });

        if (result.hasAnswer && result.solution) {
          setRagSolution({ text: result.solution, visible: true });
        } else {
          setRagSolution({ text: '', visible: false });
        }
      } catch (err) {
        // Silenciar erros
        setRagSolution({ text: '', visible: false });
      } finally {
        setIsGeneratingAi(false);
      }
    }, 1500); // 1.5 segundos de debounce

    return () => clearTimeout(timeoutId);
  }, [formData.title, formData.description, formData.categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formData.tipo === 'QUESTION' && selectedTagIds.length === 0) {
        const questionTags = tags.filter(t => t.group === 'QUESTION');
        if (questionTags.length > 0) {
          setError('Para tickets do tipo Dúvida, é necessário selecionar pelo menos uma tag de dúvida.');
          setLoading(false);
          return;
        }
      }

      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      if (formData.categoryId) {
        formDataToSend.append('categoryId', formData.categoryId);
      }
      formDataToSend.append('teamId', formData.teamId);
      formDataToSend.append('priority', formData.priority);
      formDataToSend.append('tipo', formData.tipo);
      if (formData.infraTipo) {
        formDataToSend.append('infraTipo', formData.infraTipo);
      }
      if (selectedTagIds.length > 0) {
        formDataToSend.append('tagIds', JSON.stringify(selectedTagIds));
      }
      
      // Gestão de Projetos
      if (parentTicketId) {
        formDataToSend.append('parentTicketId', parentTicketId);
      }
      if (dueDate) {
        formDataToSend.append('dueDate', dueDate);
      }
      if (estimatedMinutes) {
        formDataToSend.append('estimatedMinutes', estimatedMinutes);
      }
      if (Object.keys(customFields).length > 0) {
        formDataToSend.append('customFields', JSON.stringify(customFields));
      }

      selectedImages.forEach((image) => {
        formDataToSend.append('images', image);
      });

      const ticket = await ticketService.createTicketWithImages(formDataToSend);
      
      if (selectedObserverIds.length > 0 && user) {
        try {
          await Promise.all(
            selectedObserverIds.map((observerId) =>
              ticketService.addObserver(ticket.id, observerId)
            )
          );
        } catch (err: any) {
          console.error('Erro ao adicionar observadores:', err);
        }
      }
      
      navigate(`/tickets/${ticket.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar ticket');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const getTagsByGroup = (group: Tag['group']) => {
    return tags.filter((tag) => tag.group === group);
  };

  const getRelevantTagGroups = () => {
    const groups: Tag['group'][] = [];
    
    if (formData.tipo === 'QUESTION') {
      groups.push('QUESTION');
    } else if (formData.tipo === 'INCIDENT') {
      groups.push('ENV', 'PLATFORM', 'RC', 'INFRA');
    } else {
      groups.push('FEATURE', 'AREA', 'ENV', 'PLATFORM', 'SOURCE', 'IMPACT', 'RC', 'STATUS_REASON', 'WORK', 'INFRA');
    }
    
    return groups;
  };

  const handleTitleChange = async (value: string) => {
    setFormData({ ...formData, title: value });
    // Buscar apenas artigos da KB - a solução RAG (Gemini) é gerada separadamente
    // NOTA: Não usamos mais aiSolution do suggestArticles - apenas o Gemini RAG gera soluções
    if (value.length > 5 || formData.description.length > 100) {
      try {
        const response = await kbService.suggestArticles({
          title: value,
          description: formData.description,
        });
        setKbSuggestions(response.articles);
        if (response.articles.length > 0) {
          setShowKbSuggestions(true);
        }
        // NÃO usar response.aiSolution - apenas o Gemini RAG deve gerar soluções
      } catch (err) {
        // Silenciar erros de sugestões
      }
    }
  };

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

  return (
    <ModernLayout 
      title="Abrir Novo Ticket" 
      subtitle={chatData?.fromChat ? "Complete os dados do chamado baseado na conversa com o assistente" : "Crie um novo ticket de atendimento"}
    >
      <div className="max-w-4xl mx-auto">
        <div>
          <form onSubmit={handleSubmit} className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-6">
          {error && (
            <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
              Título <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="title"
              required
              minLength={3}
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              placeholder="Descreva brevemente o problema"
            />
          </div>

          <div className="mb-4">
            <RichTextEditor
              label="Descrição *"
              value={formData.description}
              onChange={handleDescriptionChange}
              placeholder="Descreva detalhadamente o problema..."
              height="200px"
            />
          </div>

          {/* Solução RAG (Gemini) */}
          {isGeneratingAi && (
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-500/20 to-blue-500/10 border border-blue-500/50 rounded-lg backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                <p className="text-sm text-blue-400">Gerando sugestão de solução...</p>
              </div>
            </div>
          )}

          {ragSolution.visible && ragSolution.text && !isGeneratingAi && (
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-500/20 to-blue-500/10 border border-blue-500/50 rounded-lg backdrop-blur-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">✨</span>
                  <h3 className="text-sm font-semibold text-blue-400">Solução Sugerida (Base de Conhecimento)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRagSolution({ ...ragSolution, visible: false })}
                  className="text-gray-400 hover:text-gray-300 text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 mb-3 border border-gray-700/50">
                <div
                  className="prose prose-invert max-w-none prose-sm
                    prose-headings:text-white prose-headings:text-sm
                    prose-p:text-gray-200 prose-p:text-sm prose-p:my-2
                    prose-strong:text-white
                    prose-code:text-gray-300 prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                    prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:text-xs
                    prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                    prose-ul:text-gray-200 prose-ul:text-sm prose-ul:my-2
                    prose-ol:text-gray-200 prose-ol:text-sm prose-ol:my-2
                    prose-li:text-gray-200 prose-li:text-sm
                    prose-blockquote:text-gray-400 prose-blockquote:border-gray-600"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      marked.parse(ragSolution.text) as string
                    ),
                  }}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem('ticketDeflectionSuccess', 'true');
                    navigate('/tickets');
                  }}
                  className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-semibold text-gray-900 transition-colors"
                >
                  Isso resolveu meu problema!
                </button>
                <button
                  type="button"
                  onClick={() => setRagSolution({ ...ragSolution, visible: false })}
                  className="px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
                >
                  Ignorar
                </button>
              </div>
            </div>
          )}

          {/* Solução da IA (N8N) - DESABILITADO: Usando apenas Gemini RAG agora */}
          {false && aiSolution && showAiSolution && (
            <div className="mb-4 p-4 bg-gradient-to-r from-etus-green/20 to-etus-green/10 border border-etus-green/50 rounded-lg backdrop-blur-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🤖</span>
                  <h3 className="text-sm font-semibold text-etus-green">Solução Sugerida pela IA</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiSolution(false)}
                  className="text-gray-400 hover:text-gray-300 text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 mb-3 border border-gray-700/50">
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{aiSolution}</p>
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    // Salvar mensagem de sucesso no sessionStorage para exibir na página de tickets
                    sessionStorage.setItem('ticketDeflectionSuccess', 'true');
                    navigate('/tickets');
                  }}
                  className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-semibold text-gray-900 transition-colors"
                >
                  Isso resolveu!
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAiSolution(false);
                    setAiSolution(null);
                  }}
                  className="px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
                >
                  Continuar chamado
                </button>
              </div>
            </div>
          )}

          {/* Sugestões de Base de Conhecimento */}
          {showKbSuggestions && kbSuggestions.length > 0 && (
            <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-blue-400">Artigos de Conhecimento Sugeridos</h3>
                <button
                  type="button"
                  onClick={() => setShowKbSuggestions(false)}
                  className="text-blue-400 hover:text-blue-300 text-xs"
                >
                  Ocultar
                </button>
              </div>
              <div className="space-y-2">
                {kbSuggestions.slice(0, 3).map((article) => (
                  <div
                    key={article.id}
                    className="p-3 bg-gray-700/30 rounded border border-blue-500/30 cursor-pointer hover:border-blue-500/50 transition-colors"
                    onClick={() => setSelectedKbArticle(article)}
                  >
                    <h4 className="text-sm font-medium text-white">{article.title}</h4>
                    {article.category && (
                      <p className="text-xs text-gray-400 mt-1">{article.category.name}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {article.content.substring(0, 100)}...
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-400 mt-2">
                💡 Estes artigos podem ajudar a resolver seu problema. Clique para visualizar.
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Anexos (Imagens, PDF, Documentos)
            </label>
            <FileUpload
              onFilesSelected={handleFilesSelected}
              maxFiles={10}
              maxSize={10 * 1024 * 1024}
              accept={{
                'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
                'application/pdf': ['.pdf'],
                'application/msword': ['.doc'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                'application/vnd.ms-excel': ['.xls'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'text/plain': ['.txt', '.csv']
              }}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="team" className="block text-sm font-medium text-gray-300 mb-1">
              Time <span className="text-red-400">*</span>
            </label>
            <select
              id="team"
              required
              value={formData.teamId}
              onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
              className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              disabled={teams.length === 0}
            >
              <option value="">
                {teams.length === 0 ? 'Nenhum time disponível' : 'Selecione um time'}
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            {teams.length === 0 && (
              <p className="mt-1 text-xs text-red-400">
                Nenhum time encontrado. Entre em contato com o administrador para cadastrar times.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-gray-300 mb-1">
                Tipo de Chamado <span className="text-red-400">*</span>
              </label>
              <select
                id="tipo"
                required
                value={formData.tipo}
                onChange={(e) => {
                  const newTipo = e.target.value as typeof formData.tipo;
                  setFormData({ ...formData, tipo: newTipo });
                  if (newTipo !== formData.tipo) {
                    setSelectedTagIds([]);
                  }
                }}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
                disabled={!formData.teamId || availableTicketTypes.length === 0}
              >
                {availableTicketTypes.length === 0 ? (
                  <option value="">Selecione um time primeiro</option>
                ) : (
                  <>
                    {availableTicketTypes.includes('INCIDENT') && <option value="INCIDENT">Incidente</option>}
                    {availableTicketTypes.includes('SERVICE_REQUEST') && <option value="SERVICE_REQUEST">Solicitação de Serviço</option>}
                    {availableTicketTypes.includes('PROBLEM') && <option value="PROBLEM">Problema</option>}
                    {availableTicketTypes.includes('CHANGE') && <option value="CHANGE">Mudança</option>}
                    {availableTicketTypes.includes('TASK') && <option value="TASK">Tarefa</option>}
                    {availableTicketTypes.includes('QUESTION') && <option value="QUESTION">Dúvida</option>}
                  </>
                )}
              </select>
              {!formData.teamId && (
                <p className="mt-1 text-xs text-gray-400">
                  Selecione um time para ver os tipos de chamados disponíveis
                </p>
              )}
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-1">
                Categoria
              </label>
              <select
                id="category"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
                disabled={!formData.teamId}
              >
                <option value="">
                  {!formData.teamId 
                    ? 'Selecione um time primeiro' 
                    : categories.length === 0 
                    ? 'Nenhuma categoria disponível para este time'
                    : 'Selecione uma categoria'}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {!formData.teamId && (
                <p className="mt-1 text-xs text-gray-400">
                  Selecione um time para ver as categorias disponíveis
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-300 mb-1">
                Prioridade
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </select>
            </div>

            {(formData.tipo === 'INCIDENT' || formData.tipo === 'SERVICE_REQUEST' || formData.tipo === 'PROBLEM') && (
              <div>
                <label htmlFor="infraTipo" className="block text-sm font-medium text-gray-300 mb-1">
                  Tipo de Infraestrutura
                </label>
                <select
                  id="infraTipo"
                  value={formData.infraTipo}
                  onChange={(e) => setFormData({ ...formData, infraTipo: e.target.value as typeof formData.infraTipo })}
                  className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
                >
                  <option value="">Selecione (opcional)</option>
                  <option value="LOCAL">Local</option>
                  <option value="NUVEM">Nuvem</option>
                  <option value="HIBRIDA">Híbrida</option>
                  <option value="ESTACAO_TRABALHO">Estação de Trabalho</option>
                  <option value="REDE_LOCAL">Rede Local</option>
                  <option value="SERVIDOR_FISICO">Servidor Físico</option>
                </select>
              </div>
            )}
          </div>

          {/* Ticket Pai (apenas para TASK) */}
          {formData.tipo === 'TASK' && (
            <div className="mb-4">
              <TicketAutocomplete
                selectedTicketId={parentTicketId}
                onSelectionChange={setParentTicketId}
                placeholder="Busque o ticket/projeto pai..."
                label="Ticket Pai (Projeto)"
                description="Selecione o ticket/projeto ao qual esta tarefa pertence"
                darkTheme={true}
                filterType="TASK"
              />
            </div>
          )}

          {/* Gestão de Projetos - Campos adicionais */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-300 mb-1">
                Data de Entrega
              </label>
              <input
                type="datetime-local"
                id="dueDate"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
            <div>
              <label htmlFor="estimatedMinutes" className="block text-sm font-medium text-gray-300 mb-1">
                Tempo Estimado (minutos)
              </label>
              <input
                type="number"
                id="estimatedMinutes"
                min="1"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="Ex: 120"
                className="block w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-etus-green focus:border-etus-green"
              />
            </div>
          </div>

          {/* Observadores */}
          <div className="mb-4">
            <UserAutocomplete
              selectedUserIds={selectedObserverIds}
              onSelectionChange={setSelectedObserverIds}
              excludeUserIds={user?.id ? [user.id] : []}
              placeholder="Digite o nome ou email do usuário..."
              label="Observadores (opcional)"
              description="Selecione usuários que devem acompanhar este ticket"
              darkTheme={true}
            />
          </div>

          {/* Seleção de Tags */}
          {getRelevantTagGroups().length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tags
                {formData.tipo === 'QUESTION' && <span className="text-red-400"> *</span>}
              </label>
              <div className="space-y-4">
                {getRelevantTagGroups().map((group) => {
                  const groupTags = getTagsByGroup(group);
                  if (groupTags.length === 0) return null;

                  return (
                    <div key={group} className="border border-gray-600/50 rounded-lg p-3 bg-gray-700/20">
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">{groupLabels[group]}</h4>
                      <div className="flex flex-wrap gap-2">
                        {groupTags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.id)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                              selectedTagIds.includes(tag.id)
                                ? 'bg-etus-green text-gray-900 border-etus-green'
                                : 'bg-gray-700/50 text-gray-300 border-gray-600 hover:border-etus-green'
                            }`}
                          >
                            {tag.name.replace(/^(feature|area|env|platform|source|impact|rc|status_reason|work|question|infra):/, '')}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {formData.tipo === 'QUESTION' && selectedTagIds.length === 0 && (
                <p className="mt-1 text-xs text-red-400">
                  Selecione pelo menos uma tag de dúvida
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/tickets')}
              className="px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-etus-green disabled:opacity-50 transition-colors"
            >
              {loading ? 'Criando...' : 'Criar Ticket'}
            </button>
          </div>
        </form>
        </div>
      </div>

      {/* Modal de Artigo de KB */}
      {selectedKbArticle && (
        <DarkModal
          isOpen={!!selectedKbArticle}
          onClose={() => setSelectedKbArticle(null)}
          title={selectedKbArticle.title}
          maxWidth="4xl"
        >
          <div className="mb-4">
            {selectedKbArticle.category && (
              <p className="text-sm text-gray-400 mb-2">Categoria: {selectedKbArticle.category.name}</p>
            )}
          </div>
          <div className="border-t border-gray-600/50 pt-4 max-h-[60vh] overflow-y-auto">
            <div
              className="prose prose-invert max-w-none
                prose-headings:text-white
                prose-p:text-gray-300
                prose-strong:text-white
                prose-code:text-gray-300 prose-code:bg-gray-800
                prose-pre:bg-gray-900 prose-pre:text-gray-100
                prose-a:text-etus-green
                prose-blockquote:text-gray-400"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  marked.parse(selectedKbArticle.content) as string
                ),
              }}
            />
          </div>
          <div className="mt-6 flex justify-end space-x-3 border-t border-gray-600/50 pt-4">
            <button
              type="button"
              onClick={() => {
                setSelectedKbArticle(null);
                navigate('/tickets');
              }}
              className="px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              Isso resolveu meu problema
            </button>
            <button
              type="button"
              onClick={() => setSelectedKbArticle(null)}
              className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
            >
              Continuar Criando Ticket
            </button>
          </div>
        </DarkModal>
      )}
    </ModernLayout>
  );
};

export default CreateTicketPage;
