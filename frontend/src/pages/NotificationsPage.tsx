import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService, Notification } from '../services/notification.service';
import { useSocket } from '../contexts/SocketContext';
import ModernLayout from '../components/ModernLayout';
import { Bell, MessageSquare, CheckCircle, UserPlus, Users } from 'lucide-react';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { socket } = useSocket();

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [filter]);

  // Atualização em tempo real via Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => {
        // Se o filtro for "unread" e a notificação já vier como lida, não exibir
        if (filter === 'unread' && notification.read) {
          return prev;
        }

        // Evitar duplicados
        const exists = prev.some((n) => n.id === notification.id);
        if (exists) {
          return prev.map((n) => (n.id === notification.id ? notification : n));
        }

        return [notification, ...prev];
      });

      if (!notification.read) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket, filter]);

  const loadNotifications = async () => {
    try {
      const data = await notificationService.getNotifications(filter === 'unread');
      setNotifications(data);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Erro ao carregar contador:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await notificationService.markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Erro ao marcar como lida:', error);
      }
    }

    if (notification.ticketId) {
      navigate(`/tickets/${notification.ticketId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
        return <MessageSquare className="w-5 h-5 text-blue-400" />;
      case 'STATUS_CHANGE':
        return <CheckCircle className="w-5 h-5 text-yellow-400" />;
      case 'ASSIGNMENT':
        return <UserPlus className="w-5 h-5 text-green-400" />;
      case 'TEAM_CHANGE':
        return <Users className="w-5 h-5 text-purple-400" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const headerActions = (
    <div className="flex items-center space-x-4">
      <div className="flex space-x-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-etus-green text-gray-900'
              : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            filter === 'unread'
              ? 'bg-etus-green text-gray-900'
              : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Não lidas ({unreadCount})
        </button>
      </div>
      {unreadCount > 0 && (
        <button
          onClick={handleMarkAllAsRead}
          className="px-4 py-2 text-sm text-etus-green hover:text-etus-green-dark border border-etus-green/50 rounded-lg hover:bg-etus-green/10 transition-colors"
        >
          Marcar todas como lidas
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <ModernLayout title="Notificações" subtitle="Central de notificações do sistema" headerActions={headerActions}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-etus-green"></div>
          <p className="mt-4 text-gray-400">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Notificações" subtitle="Central de notificações do sistema" headerActions={headerActions}>
      <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}
          </div>
        ) : (
          <ul className="divide-y divide-gray-600/50">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 cursor-pointer transition-colors ${
                  !notification.read
                    ? 'bg-blue-500/10 hover:bg-blue-500/20 border-l-4 border-blue-500'
                    : 'hover:bg-gray-700/30'
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-3 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-white">{notification.title}</p>
                      {!notification.read && (
                        <span className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{notification.message}</p>
                    {notification.ticket && (
                      <p className="text-xs text-gray-400 mt-1">
                        Ticket: {notification.ticket.title}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{formatTime(notification.createdAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModernLayout>
  );
};

export default NotificationsPage;
