import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService, Notification } from '../services/notification.service';
import { useSocket } from '../contexts/SocketContext';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const { socket } = useSocket();

  useEffect(() => {
    // Carregar notificações apenas uma vez na montagem
    loadNotifications();
    loadUnreadCount();
  }, []);

  // Atualizar em tempo real via Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.read) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket]);

  // Calcular posição do dropdown quando abrir
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showDropdown]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const loadNotifications = async () => {
    try {
      const data = await notificationService.getNotifications(true); // Apenas não lidas
      setNotifications(data);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Erro ao carregar contador de notificações:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Marcar como lida
    if (!notification.read) {
      try {
        await notificationService.markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    }

    // Navegar para o ticket se houver
    if (notification.ticketId) {
      navigate(`/tickets/${notification.ticketId}`);
      setShowDropdown(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'COMMENT':
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'STATUS_CHANGE':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'ASSIGNMENT':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'TEAM_CHANGE':
        return (
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // Se houver notificações não lidas, mostrar dropdown; caso contrário, ir para página de notificações
            if (unreadCount > 0 || notifications.length > 0) {
              setShowDropdown(!showDropdown);
            } else {
              navigate('/notifications');
            }
          }}
          className="relative p-2 text-gray-300 hover:text-white focus:outline-none transition-colors cursor-pointer"
          title="Notificações"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {showDropdown && (
        <>
          {/* Overlay para fechar ao clicar fora */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowDropdown(false)}
            style={{ backgroundColor: 'transparent' }}
          />
          {/* Dropdown */}
          <div 
            ref={dropdownRef}
            className="fixed w-80 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg z-[9999] border border-gray-700/50"
            style={{ 
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
              zIndex: 9999,
              maxHeight: 'calc(100vh - 5rem)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="p-4 border-b border-gray-700/50 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-white">Notificações</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-etus-green hover:text-etus-green-light transition-colors"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400">
                Nenhuma notificação não lida
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-gray-700/50 cursor-pointer hover:bg-gray-700/50 transition-colors ${
                    !notification.read ? 'bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{notification.title}</p>
                      <p className="text-sm text-gray-300 mt-1">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatTime(notification.createdAt)}</p>
                    </div>
                    {!notification.read && (
                      <div className="ml-2 h-2 w-2 bg-etus-green rounded-full flex-shrink-0 mt-1"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          {notifications.length > 0 && (
            <div className="p-2 border-t border-gray-700/50 text-center">
              <button
                onClick={() => {
                  navigate('/notifications');
                  setShowDropdown(false);
                }}
                className="text-xs text-etus-green hover:text-etus-green-light transition-colors"
              >
                Ver todas as notificações
              </button>
            </div>
          )}
        </div>
        </>
      )}
    </>
  );
};

export default NotificationBell;

