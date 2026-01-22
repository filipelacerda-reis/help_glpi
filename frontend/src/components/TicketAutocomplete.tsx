import { useState, useEffect, useRef } from 'react';
import { ticketService, Ticket } from '../services/ticket.service';

interface TicketAutocompleteProps {
  selectedTicketId: string | null;
  onSelectionChange: (ticketId: string | null) => void;
  excludeTicketId?: string;
  placeholder?: string;
  label?: string;
  description?: string;
  darkTheme?: boolean;
  filterType?: 'TASK' | 'INCIDENT' | 'SERVICE_REQUEST' | 'PROBLEM' | 'CHANGE' | 'QUESTION';
}

export const TicketAutocomplete: React.FC<TicketAutocompleteProps> = ({
  selectedTicketId,
  onSelectionChange,
  excludeTicketId,
  placeholder = 'Digite o título do ticket...',
  label = 'Ticket',
  description,
  darkTheme = false,
  filterType,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        searchTickets(searchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery, excludeTicketId, filterType]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const searchTickets = async (query: string) => {
    try {
      setLoading(true);
      const filters: any = {
        limit: 10,
      };
      
      if (filterType) {
        filters.tipo = filterType;
      }
      
      const tickets = await ticketService.getTickets(filters);
      
      const queryLower = query.toLowerCase().trim();
      const filtered = tickets.filter((ticket) => {
        if (excludeTicketId && ticket.id === excludeTicketId) {
          return false;
        }
        if (selectedTicketId && ticket.id === selectedTicketId) {
          return false;
        }
        return (
          ticket.title.toLowerCase().includes(queryLower) ||
          ticket.id.toLowerCase().includes(queryLower)
        );
      });
      
      setSuggestions(filtered.slice(0, 10));
      setShowSuggestions(filtered.length > 0);
    } catch (error) {
      console.error('Erro ao buscar tickets:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = (ticket: Ticket) => {
    onSelectionChange(ticket.id);
    setSearchQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    onSelectionChange(null);
    setSearchQuery('');
  };

  const getSelectedTicket = () => {
    if (!selectedTicketId) return null;
    return suggestions.find((t) => t.id === selectedTicketId) || null;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      OPEN: 'Aberto',
      IN_PROGRESS: 'Em Progresso',
      WAITING_REQUESTER: 'Aguardando Solicitante',
      WAITING_THIRD_PARTY: 'Aguardando Terceiros',
      RESOLVED: 'Resolvido',
      CLOSED: 'Fechado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: 'bg-blue-500',
      IN_PROGRESS: 'bg-yellow-500',
      WAITING_REQUESTER: 'bg-orange-500',
      WAITING_THIRD_PARTY: 'bg-purple-500',
      RESOLVED: 'bg-green-500',
      CLOSED: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div className="relative">
      {label && (
        <label className={`block text-sm font-medium mb-2 ${darkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
          {label}
        </label>
      )}
      {description && (
        <p className={`text-xs mb-2 ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
      )}

      {/* Input de busca */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (searchQuery.trim() && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={selectedTicketId ? 'Buscar outro ticket...' : placeholder}
          disabled={!!selectedTicketId}
          className={`block w-full border rounded-lg shadow-sm focus:ring-2 focus:ring-etus-green focus:border-etus-green sm:text-sm px-3 py-2 ${
            darkTheme 
              ? 'bg-gray-700/50 text-white border-gray-600 placeholder-gray-400 disabled:bg-gray-800/50 disabled:text-gray-500' 
              : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500 disabled:bg-gray-100 disabled:text-gray-500'
          }`}
          style={darkTheme ? { color: '#E5E7EB' } : { color: '#111827' }}
        />
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-etus-green"></div>
          </div>
        )}
      </div>

      {/* Sugestões */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className={`absolute z-50 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto ${
            darkTheme 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-300'
          }`}
        >
          {suggestions.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => handleSelectTicket(ticket)}
              className={`w-full text-left px-4 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0 ${
                darkTheme ? 'hover:bg-gray-700/50 border-gray-700' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className={`text-sm font-medium ${darkTheme ? 'text-white' : 'text-gray-900'}`}>
                    {ticket.title}
                  </div>
                  <div className={`text-xs ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                    #{ticket.id.slice(0, 8)}...
                  </div>
                </div>
                <div className={`text-xs px-2 py-1 rounded ${getStatusColor(ticket.status)} text-white ml-2`}>
                  {getStatusLabel(ticket.status)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Mensagem quando não há sugestões */}
      {showSuggestions && searchQuery.trim() && suggestions.length === 0 && !loading && (
        <div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-lg p-3 text-sm ${
          darkTheme 
            ? 'bg-gray-800 border-gray-600 text-gray-400' 
            : 'bg-white border-gray-300 text-gray-500'
        }`}>
          Nenhum ticket encontrado
        </div>
      )}

      {/* Ticket selecionado */}
      {selectedTicketId && getSelectedTicket() && (
        <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          darkTheme 
            ? 'bg-etus-green bg-opacity-20 text-gray-200 border border-etus-green border-opacity-30' 
            : 'bg-etus-green bg-opacity-20 text-gray-800 border border-etus-green border-opacity-30'
        }`}>
          <span className="mr-2">{getSelectedTicket()?.title}</span>
          <button
            type="button"
            onClick={handleClear}
            className={`${darkTheme ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'} focus:outline-none`}
            title="Remover"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

