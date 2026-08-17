import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../../services/api';
import type { NotificationItem } from '../../types';

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const fetchUnread = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnread(res.data.unread ?? 0);
    } catch {
      // silencio: la campana no debe romper el navbar
    }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get('/notifications?limit=10');
      setItems(res.data.items ?? []);
      setUnread(res.data.unread ?? 0);
    } catch {
      // silencio
    }
  }, []);

  // Contador en vivo: polling cada 30s + al abrir
  useEffect(() => {
    fetchUnread();
    const t = setInterval(fetchUnread, 30000);
    return () => clearInterval(t);
  }, [fetchUnread]);

  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.readAt) {
      void api.post('/notifications/read', { ids: [item.id] }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (item.link) navigate(item.link);
  };

  const markAllRead = async () => {
    await api.post('/notifications/read', {}).catch(() => {});
    setUnread(0);
    fetchItems();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 cursor-pointer"
        title="Notificaciones"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-medium">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Notificaciones</p>
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-brand hover:underline cursor-pointer">
                  <CheckCheck size={14} /> Marcar todas
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {items.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sin notificaciones</p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${item.readAt ? '' : 'bg-brand/5'}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    {item.message && <p className="text-xs text-gray-500 truncate mt-0.5">{item.message}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(item.createdAt).toLocaleString('es')}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
