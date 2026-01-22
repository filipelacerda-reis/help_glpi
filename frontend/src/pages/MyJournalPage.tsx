import { useEffect, useState, useRef } from 'react';
import ModernLayout from '../components/ModernLayout';
import { journalService, JournalEntry, TechnicianMetrics } from '../services/journal.service';
import { tagService, Tag } from '../services/tag.service';
import { Plus, Search, Calendar, X, Paperclip, Tag as TagIcon, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useDropzone } from 'react-dropzone';
import DOMPurify from 'dompurify';

type DatePreset = 'today' | 'thisWeek' | 'thisMonth' | 'custom';

const MyJournalPage = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [metrics, setMetrics] = useState<TechnicianMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('thisWeek');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: '', description: '', contentHtml: '', tagIds: [] as string[] });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagSearchText, setTagSearchText] = useState('');
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const tagSelectorRef = useRef<HTMLDivElement>(null);
  const tagFilterRef = useRef<HTMLDivElement>(null);

  // Fechar seletores ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setShowTagSelector(false);
      }
      if (tagFilterRef.current && !tagFilterRef.current.contains(event.target as Node)) {
        setShowTagFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Inicializar datas
  useEffect(() => {
    const today = new Date();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Domingo

    setFromDate(thisWeekStart.toISOString().split('T')[0]);
    setToDate(today.toISOString().split('T')[0]);
  }, []);

  // Carregar tags disponíveis
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await tagService.getAllTags({ isActive: true });
        setAvailableTags(tags);
      } catch (error) {
        console.error('Erro ao carregar tags:', error);
      }
    };
    loadTags();
  }, []);

  // Carregar dados
  useEffect(() => {
    if (!fromDate || !toDate) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const entriesData = await journalService.getMyJournal({
          from: fromDate,
          to: toDate,
          searchText: searchText || undefined,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        });

        setEntries(entriesData.entries);
      } catch (error) {
        console.error('Erro ao carregar diário:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fromDate, toDate, searchText, selectedTagIds]);

  // Carregar métricas
  useEffect(() => {
    if (!fromDate || !toDate) return;

    const loadMetrics = async () => {
      setLoadingMetrics(true);
      try {
        const metricsData = await journalService.getMyMetrics({
          from: fromDate,
          to: toDate,
          businessHours: false,
        });
        setMetrics(metricsData);
      } catch (error) {
        console.error('Erro ao carregar métricas:', error);
      } finally {
        setLoadingMetrics(false);
      }
    };

    loadMetrics();
  }, [fromDate, toDate]);

  // Aplicar preset de datas
  const applyDatePreset = (preset: DatePreset) => {
    const today = new Date();
    let start: Date;
    let end = new Date(today);

    switch (preset) {
      case 'today':
        start = new Date(today);
        break;
      case 'thisWeek':
        start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'custom':
        return; // Não fazer nada, deixar o usuário escolher
    }

    setFromDate(start.toISOString().split('T')[0]);
    setToDate(end.toISOString().split('T')[0]);
    setDatePreset(preset);
  };

  // Configuração do dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setUploadedFiles((prev) => [...prev, ...acceptedFiles]);
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.md'],
      'application/*': ['.doc', '.docx', '.xls', '.xlsx'],
    },
  });

  // Remover arquivo
  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Configuração do editor Quill
  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ color: [] }, { background: [] }],
      ['link', 'code-block'],
      ['clean'],
    ],
  };

  // Criar entrada manual
  const handleCreateEntry = async () => {
    try {
      await journalService.createMyManualEntry(
        {
          title: newEntry.title || undefined,
          description: newEntry.description,
          contentHtml: newEntry.contentHtml || undefined,
          tagIds: newEntry.tagIds.length > 0 ? newEntry.tagIds : undefined,
        },
        uploadedFiles.length > 0 ? uploadedFiles : undefined
      );

      setShowAddModal(false);
      setNewEntry({ title: '', description: '', contentHtml: '', tagIds: [] });
      setUploadedFiles([]);

      // Recarregar dados
      const entriesData = await journalService.getMyJournal({
        from: fromDate,
        to: toDate,
        searchText: searchText || undefined,
      });

      setEntries(entriesData.entries);
    } catch (error) {
      console.error('Erro ao criar entrada:', error);
      alert('Erro ao criar entrada no diário');
    }
  };

  // Agrupar entradas por dia
  const groupedEntries = entries.reduce((acc, entry) => {
    const dateKey = new Date(entry.createdAt).toLocaleDateString('pt-BR');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, JournalEntry[]>);

  const getEntryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      MANUAL: 'Manual',
      AUTO_TICKET_WORKLOG: 'Worklog',
      AUTO_TICKET_STATUS: 'Status',
      AUTO_TICKET_COMMENT: 'Resposta',
      AUTO_OTHER: 'Automático',
    };
    return labels[type] || type;
  };

  const getEntryTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      MANUAL: 'bg-blue-500/20 text-blue-400',
      AUTO_TICKET_WORKLOG: 'bg-etus-green/20 text-etus-green',
      AUTO_TICKET_STATUS: 'bg-purple-500/20 text-purple-400',
      AUTO_TICKET_COMMENT: 'bg-yellow-500/20 text-yellow-400',
      AUTO_OTHER: 'bg-gray-500/20 text-gray-400',
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMinutes = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  const headerActions = (
    <button
      onClick={() => setShowAddModal(true)}
      className="inline-flex items-center space-x-2 px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span>Adicionar Nota</span>
    </button>
  );

  return (
    <ModernLayout title="Meu Diário" subtitle="Histórico pessoal de atividades" headerActions={headerActions}>
      {/* Filtros */}
      <div className="mb-6 space-y-4">
        {/* Presets de data */}
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <span className="text-sm text-gray-400">Período:</span>
          {(['today', 'thisWeek', 'thisMonth', 'custom'] as DatePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => {
                if (preset === 'custom') {
                  setDatePreset('custom');
                } else {
                  applyDatePreset(preset);
                }
              }}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                datePreset === preset
                  ? 'bg-etus-green/30 text-etus-green'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {preset === 'today'
                ? 'Hoje'
                : preset === 'thisWeek'
                ? 'Esta Semana'
                : preset === 'thisMonth'
                ? 'Este Mês'
                : 'Personalizado'}
            </button>
          ))}
        </div>

        {/* Seleção de datas customizada */}
        {(datePreset === 'custom' || datePreset === 'today' || datePreset === 'thisWeek' || datePreset === 'thisMonth') && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              />
              <span className="text-gray-400">até</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              />
            </div>
          </div>
        )}

        {/* Busca e Filtros */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar no diário..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-etus-green"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Filtro por Tags */}
          <div className="relative" ref={tagFilterRef}>
            <button
              onClick={() => setShowTagFilter(!showTagFilter)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white hover:bg-gray-700 transition-colors"
            >
              <TagIcon className="w-4 h-4" />
              <span>Tags</span>
              {selectedTagIds.length > 0 && (
                <span className="px-2 py-0.5 bg-etus-green text-gray-900 text-xs rounded-full">
                  {selectedTagIds.length}
                </span>
              )}
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showTagFilter && (
              <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 p-4">
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Buscar tags..."
                    value={tagSearchText}
                    onChange={(e) => setTagSearchText(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {availableTags
                    .filter((tag) =>
                      tag.name.toLowerCase().includes(tagSearchText.toLowerCase())
                    )
                    .map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center space-x-2 px-2 py-1 hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTagIds.includes(tag.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTagIds([...selectedTagIds, tag.id]);
                            } else {
                              setSelectedTagIds(selectedTagIds.filter((id) => id !== tag.id));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-300">{tag.name}</span>
                        <span className="text-xs text-gray-500">({tag.group})</span>
                      </label>
                    ))}
                </div>
                {selectedTagIds.length > 0 && (
                  <button
                    onClick={() => setSelectedTagIds([])}
                    className="mt-3 w-full px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Métricas Pessoais */}
      {!loadingMetrics && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-400 mb-1">Tickets Atribuídos</p>
            <p className="text-2xl font-bold text-white">{metrics.totalTicketsAssigned}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-400 mb-1">Tickets Resolvidos</p>
            <p className="text-2xl font-bold text-white">{metrics.totalTicketsResolved}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-400 mb-1">MTTA</p>
            <p className="text-2xl font-bold text-white">{formatMinutes(metrics.mtta)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-400 mb-1">MTTR</p>
            <p className="text-2xl font-bold text-white">{formatMinutes(metrics.mttr)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-400 mb-1">% SLA Cumprido</p>
            <p className="text-2xl font-bold text-white">{metrics.slaCompliancePercent.toFixed(1)}%</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-400 mb-1">% Reabertura</p>
            <p className="text-2xl font-bold text-white">{metrics.reopenRatePercent.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Timeline / Diário */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-gray-400">Carregando diário...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700/50">
          <p className="text-gray-400">Nenhuma entrada encontrada no período selecionado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEntries).map(([date, dayEntries]) => (
            <div key={date} className="bg-gray-800/30 rounded-lg border border-gray-700/50 p-4">
              <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700/50">
                {date}
              </h3>
              <div className="space-y-3">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start space-x-4 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
                  >
                    <div className="flex-shrink-0 w-16 text-right">
                      <p className="text-sm text-gray-400">{formatTime(entry.createdAt)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getEntryTypeColor(entry.type)}`}
                        >
                          {getEntryTypeLabel(entry.type)}
                        </span>
                        {entry.ticket && (
                          <Link
                            to={`/tickets/${entry.ticket.id}`}
                            className="text-etus-green hover:text-etus-green-dark text-sm font-medium"
                          >
                            #{entry.ticket.id.substring(0, 8)} - {entry.ticket.title}
                          </Link>
                        )}
                      </div>
                      {entry.title && (
                        <h4 className="text-white font-medium mb-1">{entry.title}</h4>
                      )}
                      <p className="text-gray-300 text-sm whitespace-pre-wrap mb-2">{entry.description}</p>
                      
                      {/* Conteúdo HTML rico */}
                      {entry.contentHtml && (
                        <div
                          className="prose prose-invert prose-sm max-w-none mb-2 text-gray-300"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(entry.contentHtml),
                          }}
                        />
                      )}

                      {/* Anexos */}
                      {entry.attachments && entry.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 mb-2">
                          {entry.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${att.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-xs rounded transition-colors"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{att.fileName}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 bg-gray-700/50 text-gray-300 text-xs rounded"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Adicionar Entrada */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Adicionar Nota ao Diário</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Título (opcional)</label>
                <input
                  type="text"
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  placeholder="Ex: Reunião com cliente"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descrição *</label>
                <textarea
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white mb-2"
                  placeholder="Resumo breve..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Conteúdo Detalhado (com formatação)
                </label>
                <div className="bg-gray-900 border border-gray-700 rounded-lg">
                  <ReactQuill
                    theme="snow"
                    value={newEntry.contentHtml}
                    onChange={(value) => setNewEntry({ ...newEntry, contentHtml: value })}
                    modules={quillModules}
                    placeholder="Adicione detalhes, código, formatação..."
                    className="bg-gray-900 text-white"
                    style={{ minHeight: '200px' }}
                  />
                </div>
                <style>{`
                  .ql-editor {
                    min-height: 200px;
                    color: white;
                  }
                  .ql-container {
                    font-family: inherit;
                  }
                  .ql-toolbar {
                    background: #1f2937;
                    border-color: #374151;
                  }
                  .ql-stroke {
                    stroke: #9ca3af;
                  }
                  .ql-fill {
                    fill: #9ca3af;
                  }
                  .ql-picker-label {
                    color: #9ca3af;
                  }
                `}</style>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Anexos</label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? 'border-etus-green bg-etus-green/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Paperclip className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-400">
                    {isDragActive
                      ? 'Solte os arquivos aqui'
                      : 'Arraste arquivos aqui ou clique para selecionar'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Máximo 5MB por arquivo</p>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-2 bg-gray-900 rounded text-sm"
                      >
                        <span className="text-gray-300 truncate flex-1">{file.name}</span>
                        <button
                          onClick={() => removeFile(idx)}
                          className="ml-2 text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tags</label>
                <div className="relative" ref={tagSelectorRef}>
                  <button
                    type="button"
                    onClick={() => setShowTagSelector(!showTagSelector)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-left text-white flex items-center justify-between"
                  >
                    <span>
                      {newEntry.tagIds.length === 0
                        ? 'Selecione tags...'
                        : `${newEntry.tagIds.length} tag(s) selecionada(s)`}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  
                  {showTagSelector && (
                    <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 max-h-60 overflow-y-auto">
                      <div className="mb-3">
                        <input
                          type="text"
                          placeholder="Buscar tags..."
                          value={tagSearchText}
                          onChange={(e) => setTagSearchText(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="space-y-1">
                        {availableTags
                          .filter((tag) =>
                            tag.name.toLowerCase().includes(tagSearchText.toLowerCase())
                          )
                          .map((tag) => (
                            <label
                              key={tag.id}
                              className="flex items-center space-x-2 px-2 py-1 hover:bg-gray-700 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={newEntry.tagIds.includes(tag.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewEntry({
                                      ...newEntry,
                                      tagIds: [...newEntry.tagIds, tag.id],
                                    });
                                  } else {
                                    setNewEntry({
                                      ...newEntry,
                                      tagIds: newEntry.tagIds.filter((id) => id !== tag.id),
                                    });
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm text-gray-300">{tag.name}</span>
                              <span className="text-xs text-gray-500">({tag.group})</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
                {newEntry.tagIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newEntry.tagIds.map((tagId) => {
                      const tag = availableTags.find((t) => t.id === tagId);
                      return tag ? (
                        <span
                          key={tagId}
                          className="inline-flex items-center space-x-1 px-2 py-1 bg-etus-green/20 text-etus-green text-xs rounded"
                        >
                          <span>{tag.name}</span>
                          <button
                            onClick={() => {
                              setNewEntry({
                                ...newEntry,
                                tagIds: newEntry.tagIds.filter((id) => id !== tagId),
                              });
                            }}
                            className="hover:text-etus-green-dark"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewEntry({ title: '', description: '', contentHtml: '', tagIds: [] });
                  setUploadedFiles([]);
                  setTagSearchText('');
                  setShowTagSelector(false);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateEntry}
                disabled={!newEntry.description.trim()}
                className="px-4 py-2 bg-etus-green hover:bg-etus-green-dark rounded-lg text-gray-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </ModernLayout>
  );
};

export default MyJournalPage;
