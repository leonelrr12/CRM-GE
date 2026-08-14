import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Columns2, Shield, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Sidebar() {
  const { user } = useAuth();

  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/leads', icon: Users, label: 'Leads' },
    { to: '/pipeline', icon: Columns2, label: 'Pipeline' },
  ];

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Menú</h2>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold px-3">Admin</p>
            </div>
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Shield size={18} />
              Usuarios
            </NavLink>
            <NavLink
              to="/admin/companies"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Building2 size={18} />
              Empresas
            </NavLink>
          </>
        )}
      </nav>
      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        CRM-GE v1.0
      </div>
    </aside>
  );
}
