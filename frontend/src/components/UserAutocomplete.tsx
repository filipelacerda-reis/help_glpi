import { useState, useEffect, useRef } from 'react';
import { userService, User } from '../services/user.service';

interface UserAutocompleteProps {
  selectedUserIds: string[];
  onSelectionChange: (userIds: string[]) => void;
  excludeUserIds?: string[];
  placeholder?: string;
  label?: string;
  description?: string;
  darkTheme?: boolean;
}

export const UserAutocomplete: React.FC<UserAutocompleteProps> = ({
  selectedUserIds,
  onSelectionChange,
  excludeUserIds = [],
  placeholder = 'Digite o nome ou email do usuário...',
  label = 'Usuários',
  description,
  darkTheme = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      filterUsers(searchQuery);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery, allUsers, selectedUserIds, excludeUserIds]);

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

  const loadUsers = async () => {
    try {
      setLoading(true);
      const users = await userService.getAllUsers();
      setAllUsers(users);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = (query: string) => {
    const queryLower = query.toLowerCase().trim();
    const filtered = allUsers.filter((user) => {
      // Excluir usuários já selecionados e os que estão na lista de exclusão
      if (selectedUserIds.includes(user.id) || excludeUserIds.includes(user.id)) {
        return false;
      }
      // Buscar por nome ou email
      return (
        user.name.toLowerCase().includes(queryLower) ||
        user.email.toLowerCase().includes(queryLower)
      );
    });
    setSuggestions(filtered.slice(0, 10)); // Limitar a 10 sugestões
    setShowSuggestions(filtered.length > 0);
  };

  const handleSelectUser = (user: User) => {
    if (!selectedUserIds.includes(user.id)) {
      onSelectionChange([...selectedUserIds, user.id]);
    }
    setSearchQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleRemoveUser = (userId: string) => {
    onSelectionChange(selectedUserIds.filter((id) => id !== userId));
  };

  const getSelectedUsers = () => {
    return allUsers.filter((user) => selectedUserIds.includes(user.id));
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      REQUESTER: 'Solicitante',
      TECHNICIAN: 'Técnico',
      TRIAGER: 'Triagista',
      ADMIN: 'Administrador',
    };
    return labels[role] || role;
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
          placeholder={placeholder}
          className={`block w-full border rounded-lg shadow-sm focus:ring-2 focus:ring-etus-green focus:border-etus-green sm:text-sm px-3 py-2 ${
            darkTheme 
              ? 'bg-gray-700/50 text-white border-gray-600 placeholder-gray-400' 
              : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500'
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
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelectUser(user)}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
                <div className="text-xs text-gray-400 ml-2">{getRoleLabel(user.role)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Mensagem quando não há sugestões */}
      {showSuggestions && searchQuery.trim() && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-sm text-gray-500">
          Nenhum usuário encontrado
        </div>
      )}

      {/* Usuários selecionados */}
      {selectedUserIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {getSelectedUsers().map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-etus-green bg-opacity-20 text-gray-800 border border-etus-green border-opacity-30"
            >
              <span className="mr-2">{user.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveUser(user.id)}
                className="text-gray-600 hover:text-gray-800 focus:outline-none"
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
            </span>
          ))}
        </div>
      )}

      {/* Mensagem quando não há usuários disponíveis */}
      {!loading && allUsers.length === 0 && (
        <div className="mt-2 text-sm text-gray-500">
          Nenhum usuário disponível
        </div>
      )}
    </div>
  );
};

