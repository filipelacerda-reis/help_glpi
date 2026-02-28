import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, MessageSquare, UserCheck, Users, CheckCircle2 } from 'lucide-react';
import { notificationService, Notification } from '../services/notification.service';
import { useSocket } from '../contexts/SocketContext';

const NotificationBell = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.read) setUnreadCount((prev) => prev + 1);
    };

    socket.on('new_notification', handleNewNotification);
    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket]);

  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showDropdown]);

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

    if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const loadNotifications = async () => {
    try {
      const data = await notificationService.getNotifications(true);
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
    if (!notification.read) {
      try {
        await notificationService.markAsRead(notification.id);
        setNotifications((prev) => prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    }

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
        return <MessageSquare className="h-4 w-4 text-sky-500 dark:text-sky-300" />;
      case 'STATUS_CHANGE':
        return <CheckCircle2 className="h-4 w-4 text-amber-500 dark:text-amber-300" />;
      case 'ASSIGNMENT':
        return <UserCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />;
      case 'TEAM_CHANGE':
        return <Users className="h-4 w-4 text-violet-500 dark:text-violet-300" />;
      default:
        return <Bell className="h-4 w-4 text-slate-500 dark:text-slate-300" />;
    }
  };

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (unreadCount > 0 || notifications.length > 0) {
              setShowDropdown((prev) => !prev);
            } else {
              navigate('/notifications');
            }
          }}
          className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title="Notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowDropdown(false)} />
          <div
            ref={dropdownRef}
            className="fixed z-[9999] w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/95"
            style={{
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
              maxHeight: 'calc(100vh - 5rem)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700/60">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notificações</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar todas
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma notificação não lida</div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full border-b border-slate-100 px-4 py-3 text-left transition-all duration-200 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-700/30 ${
                      !notification.read ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{notification.title}</p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{notification.message}</p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{formatTime(notification.createdAt)}</p>
                      </div>
                      {!notification.read && <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />}
                    </div>
                  </button>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-2 text-center dark:border-slate-700/60">
                <button
                  onClick={() => {
                    navigate('/notifications');
                    setShowDropdown(false);
                  }}
                  className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
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
