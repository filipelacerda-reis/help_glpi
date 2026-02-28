import { useEffect, useState, useRef } from 'react';
import ModernLayout from '../components/ModernLayout';
import { journalService, JournalEntry, JournalEntryEditLog, TechnicianMetrics } from '../services/journal.service';
import { tagService, Tag } from '../services/tag.service';
import { Plus, Search, Calendar, X, Paperclip, Tag as TagIcon, ChevronDown, History, Edit2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useDropzone } from 'react-dropzone';
import DOMPurify from 'dompurify';
import { useAuth } from '../contexts/AuthContext';
import { teamService } from '../services/team.service';
import DarkModal from '../components/DarkModal';

type DatePreset = 'today' | 'thisWeek' | 'thisMonth' | 'custom';

const MyJournalPage = () => {
  const { user } = useAuth();
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [entryHistory, setEntryHistory] = useState<JournalEntryEditLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isTeamLead, setIsTeamLead] = useState(false);
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

  useEffect(() => {
    const checkLead = async () => {
      if (user?.role === 'ADMIN') {
        setIsTeamLead(true);
        return;
      }
      try {
        const leadTeams = await teamService.getUserLeadTeams();
        setIsTeamLead(leadTeams.length > 0);
      } catch {
        setIsTeamLead(false);
      }
    };
    checkLead();
  }, [user?.role]);

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

  const handleEditEntry = async () => {
    if (!editingEntry) return;
    try {
      await journalService.updateMyManualEntry(editingEntry.id, {
        title: newEntry.title || undefined,
        description: newEntry.description,
        contentHtml: newEntry.contentHtml || undefined,
        tagIds: newEntry.tagIds,
      });

      setShowEditModal(false);
      setEditingEntry(null);
      setNewEntry({ title: '', description: '', contentHtml: '', tagIds: [] });
      setUploadedFiles([]);

      const entriesData = await journalService.getMyJournal({
        from: fromDate,
        to: toDate,
        searchText: searchText || undefined,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });
      setEntries(entriesData.entries);
    } catch (error) {
      console.error('Erro ao editar entrada:', error);
      alert('Erro ao editar entrada do diário');
    }
  };

  const openEditModal = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setNewEntry({
      title: entry.title || '',
      description: entry.description,
      contentHtml: entry.contentHtml || '',
      tagIds: entry.tags.map((t) => t.id),
    });
    setUploadedFiles([]);
    setShowEditModal(true);
  };

  const openHistoryModal = async (entryId: string) => {
    try {
      setLoadingHistory(true);
      setShowHistoryModal(true);
      const logs = await journalService.getEntryEditLogs(entryId);
      setEntryHistory(logs);
    } catch (error) {
      console.error('Erro ao carregar histórico de edição:', error);
      setEntryHistory([]);
    } finally {
      setLoadingHistory(false);
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
      AUTO_TICKET_WORKLOG: 'bg-indigo-600/20 text-indigo-600 dark:text-indigo-400',
      AUTO_TICKET_STATUS: 'bg-purple-500/20 text-purple-400',
      AUTO_TICKET_COMMENT: 'bg-yellow-500/20 text-yellow-400',
      AUTO_OTHER: 'bg-gray-500/20 text-slate-500 dark:text-slate-400',
    };
    return colors[type] || 'bg-gray-500/20 text-slate-500 dark:text-slate-400';
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

  const closeEntryModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingEntry(null);
    setNewEntry({ title: '', description: '', contentHtml: '', tagIds: [] });
    setUploadedFiles([]);
    setTagSearchText('');
    setShowTagSelector(false);
  };

  const headerActions = (
    <button
      onClick={() => setShowAddModal(true)}
      className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-600-dark rounded-lg text-sm font-medium text-gray-900 transition-colors"
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
          <span className="text-sm text-slate-500 dark:text-slate-400">Período:</span>
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
                  ? 'bg-indigo-600/30 text-indigo-600 dark:text-indigo-400'
                  : 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/30'
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
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="px-3 py-2 bg-gray-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-white"
              />
              <span className="text-slate-500 dark:text-slate-400">até</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="px-3 py-2 bg-gray-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-white"
              />
            </div>
          </div>
        )}

        {/* Busca e Filtros */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Buscar no diário..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Filtro por Tags */}
          <div className="relative" ref={tagFilterRef}>
            <button
              onClick={() => setShowTagFilter(!showTagFilter)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-white hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
            >
              <TagIcon className="w-4 h-4" />
              <span>Tags</span>
              {selectedTagIds.length > 0 && (
                <span className="px-2 py-0.5 bg-indigo-600 text-gray-900 text-xs rounded-full">
                  {selectedTagIds.length}
                </span>
              )}
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showTagFilter && (
              <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg z-50 p-4">
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Buscar tags..."
                    value={tagSearchText}
                    onChange={(e) => setTagSearchText(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-white"
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
                        className="flex items-center space-x-2 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700/30 rounded cursor-pointer"
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
                        <span className="text-sm text-slate-600 dark:text-slate-300">{tag.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">({tag.group})</span>
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
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/60">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tickets Atribuídos</p>
            <p className="text-2xl font-bold text-white">{metrics.totalTicketsAssigned}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/60">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tickets Resolvidos</p>
            <p className="text-2xl font-bold text-white">{metrics.totalTicketsResolved}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/60">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">MTTA</p>
            <p className="text-2xl font-bold text-white">{formatMinutes(metrics.mtta)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/60">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">MTTR</p>
            <p className="text-2xl font-bold text-white">{formatMinutes(metrics.mttr)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/60">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">% SLA Cumprido</p>
            <p className="text-2xl font-bold text-white">{metrics.slaCompliancePercent.toFixed(1)}%</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/60">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">% Reabertura</p>
            <p className="text-2xl font-bold text-white">{metrics.reopenRatePercent.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Timeline / Diário */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Carregando diário...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700/60">
          <p className="text-slate-500 dark:text-slate-400">Nenhuma entrada encontrada no período selecionado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEntries).map(([date, dayEntries]) => (
            <div key={date} className="bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700/60 p-4">
              <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-slate-200 dark:border-slate-700/60">
                {date}
              </h3>
              <div className="space-y-3">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start space-x-4 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex-shrink-0 w-16 text-right">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{formatTime(entry.createdAt)}</p>
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
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 text-sm font-medium"
                          >
                            #{entry.ticket.id.substring(0, 8)} - {entry.ticket.title}
                          </Link>
                        )}
                      </div>
                      {entry.title && (
                        <h4 className="text-white font-medium mb-1">
                          {entry.title}
                          {entry.editedAt && (
                            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              Editado
                            </span>
                          )}
                        </h4>
                      )}
                      {entry.editedAt && (
                        <p className="mb-2 text-xs text-amber-300">
                          Editado em {new Date(entry.editedAt).toLocaleString('pt-BR')}
                        </p>
                      )}
                      <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap mb-2">{entry.description}</p>
                      
                      {/* Conteúdo HTML rico */}
                      {entry.contentHtml && (
                        <div
                          className="prose prose-invert prose-sm max-w-none mb-2 text-slate-600 dark:text-slate-300"
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
                              className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 text-slate-600 dark:text-slate-300 text-xs rounded transition-colors"
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
                              className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 text-xs rounded"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {entry.type === 'MANUAL' && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(entry)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/30"
                          >
                            <Edit2 className="h-3 w-3" />
                            Editar
                          </button>
                          {(user?.role === 'ADMIN' || isTeamLead) && (
                            <button
                              onClick={() => openHistoryModal(entry.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/30"
                            >
                              <History className="h-3 w-3" />
                              Ver histórico
                            </button>
                          )}
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

      {/* Modal de Adicionar/Editar Entrada */}
      <DarkModal
        isOpen={showAddModal || showEditModal}
        onClose={closeEntryModal}
        title={showEditModal ? 'Editar Nota do Diário' : 'Adicionar Nota ao Diário'}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Título (opcional)</label>
            <input
              type="text"
              value={newEntry.title}
              onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Ex: Reunião com cliente"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Descrição *</label>
            <textarea
              value={newEntry.description}
              onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
              rows={3}
              className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Resumo breve..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Conteúdo Detalhado (com formatação)
            </label>
            <div className="rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
              <ReactQuill
                theme="snow"
                value={newEntry.contentHtml}
                onChange={(value) => setNewEntry({ ...newEntry, contentHtml: value })}
                modules={quillModules}
                placeholder="Adicione detalhes, código, formatação..."
                className="journal-quill bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                style={{ minHeight: '200px' }}
              />
            </div>
            <style>{`
              .journal-quill .ql-editor {
                min-height: 200px;
                color: #e2e8f0;
                background: linear-gradient(180deg, #0b1324 0%, #0a1429 100%);
              }
              .dark .journal-quill .ql-editor {
                color: #e2e8f0;
              }
              .journal-quill .ql-editor.ql-blank::before {
                color: #94a3b8;
                font-style: italic;
              }
              .journal-quill .ql-container {
                font-family: inherit;
                border: 1px solid #334155;
                border-top: 0;
                border-radius: 0 0 0.75rem 0.75rem;
                background: #0b1324;
              }
              .journal-quill .ql-toolbar {
                background: linear-gradient(180deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.88) 100%);
                border: 1px solid #334155;
                border-bottom: 1px solid #475569;
                border-radius: 0.75rem 0.75rem 0 0;
                backdrop-filter: blur(8px);
              }
              .dark .journal-quill .ql-toolbar {
                background: #0f172a;
                border-color: #334155;
              }
              .journal-quill .ql-toolbar .ql-picker-label,
              .journal-quill .ql-toolbar .ql-picker-item {
                color: #cbd5e1;
              }
              .journal-quill .ql-stroke {
                stroke: #cbd5e1;
              }
              .journal-quill .ql-fill {
                fill: #cbd5e1;
              }
              .journal-quill .ql-picker-label {
                color: #cbd5e1;
              }
              .journal-quill .ql-toolbar button:hover .ql-stroke,
              .journal-quill .ql-toolbar button.ql-active .ql-stroke {
                stroke: #818cf8;
              }
              .journal-quill .ql-toolbar button:hover .ql-fill,
              .journal-quill .ql-toolbar button.ql-active .ql-fill {
                fill: #818cf8;
              }
              .dark .journal-quill .ql-stroke {
                stroke: #94a3b8;
              }
              .dark .journal-quill .ql-fill {
                fill: #94a3b8;
              }
              .dark .journal-quill .ql-picker-label {
                color: #94a3b8;
              }
            `}</style>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Anexos</label>
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                isDragActive
                  ? 'border-etus-green bg-indigo-600/10'
                  : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600'
              }`}
            >
              <input {...getInputProps()} />
              <Paperclip className="mx-auto mb-2 h-6 w-6 text-slate-500 dark:text-slate-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isDragActive ? 'Solte os arquivos aqui' : 'Arraste arquivos aqui ou clique para selecionar'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Máximo 5MB por arquivo</p>
            </div>
            {showEditModal && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Edição altera texto/tags. Upload de novos anexos permanece no fluxo de nova nota.
              </p>
            )}
            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded bg-slate-100 px-3 py-2 text-sm dark:bg-slate-900"
                  >
                    <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{file.name}</span>
                    <button onClick={() => removeFile(idx)} className="ml-2 text-red-400 hover:text-red-300">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Tags</label>
            <div className="relative" ref={tagSelectorRef}>
              <button
                type="button"
                onClick={() => setShowTagSelector(!showTagSelector)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <span>
                  {newEntry.tagIds.length === 0
                    ? 'Selecione tags...'
                    : `${newEntry.tagIds.length} tag(s) selecionada(s)`}
                </span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {showTagSelector && (
                <div className="mt-2 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-300 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="Buscar tags..."
                      value={tagSearchText}
                      onChange={(e) => setTagSearchText(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="space-y-1">
                    {availableTags
                      .filter((tag) => tag.name.toLowerCase().includes(tagSearchText.toLowerCase()))
                      .map((tag) => (
                        <label
                          key={tag.id}
                          className="flex cursor-pointer items-center space-x-2 rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700/30"
                        >
                          <input
                            type="checkbox"
                            checked={newEntry.tagIds.includes(tag.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewEntry({ ...newEntry, tagIds: [...newEntry.tagIds, tag.id] });
                              } else {
                                setNewEntry({
                                  ...newEntry,
                                  tagIds: newEntry.tagIds.filter((id) => id !== tag.id),
                                });
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-slate-600 dark:text-slate-300">{tag.name}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">({tag.group})</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {newEntry.tagIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {newEntry.tagIds.map((tagId) => {
                  const tag = availableTags.find((t) => t.id === tagId);
                  return tag ? (
                    <span
                      key={tagId}
                      className="inline-flex items-center space-x-1 rounded bg-indigo-600/20 px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400"
                    >
                      <span>{tag.name}</span>
                      <button
                        onClick={() =>
                          setNewEntry({ ...newEntry, tagIds: newEntry.tagIds.filter((id) => id !== tagId) })
                        }
                        className="hover:text-indigo-700 dark:hover:text-indigo-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={closeEntryModal}
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/30"
          >
            Cancelar
          </button>
          <button
            onClick={showEditModal ? handleEditEntry : handleCreateEntry}
            disabled={!newEntry.description.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showEditModal ? 'Salvar Edição' : 'Salvar'}
          </button>
        </div>
      </DarkModal>

      <DarkModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Histórico de Edições"
        maxWidth="4xl"
      >
        {loadingHistory ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Carregando histórico...</p>
        ) : entryHistory.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Sem alterações registradas.</p>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {entryHistory.map((log) => (
              <div key={log.id} className="rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/30">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(log.editedAt).toLocaleString('pt-BR')} por {log.editedByName}
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-rose-400">Antes</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">Título: {log.previous.title || '-'}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">Descrição: {log.previous.description}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Depois</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">Título: {log.next.title || '-'}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">Descrição: {log.next.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DarkModal>
    </ModernLayout>
  );
};

export default MyJournalPage;
