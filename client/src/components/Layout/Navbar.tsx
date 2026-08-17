import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from './NotificationBell';
import { LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        {user?.company?.logoUrl ? (
          <img
            src={user.company.logoUrl}
            alt={user.company.name}
            className="h-8 object-contain"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">CRM</span>
          </div>
        )}
        <h1 className="text-xl font-bold text-gray-900">CRM-GE</h1>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User size={18} />
          <span>{user?.name}</span>
          {user?.company && (
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{user.company.name}</span>
          )}
          {user?.role === 'admin' && (
            <span className="bg-brand/10 text-brand text-xs px-2 py-0.5 rounded-full">admin</span>
          )}
          {user?.role === 'company_admin' && (
            <span className="bg-brand/10 text-brand text-xs px-2 py-0.5 rounded-full">Admin de empresa</span>
          )}
          {user?.role === 'viewer' && (
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">Solo lectura</span>
          )}
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1 text-gray-500 hover:text-red-600 text-sm transition-colors cursor-pointer"
        >
          <LogOut size={16} />
          Salir
        </button>
      </div>
    </header>
  );
}
