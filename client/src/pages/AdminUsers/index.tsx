import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Shield, ShieldOff, Search } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { User, Company } from '../../types';

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  companyId: string;
}

const emptyForm: UserForm = { name: '', email: '', password: '', role: 'user', companyId: '' };

// Badge de rol para la tabla
const roleBadge = (role: string) => {
  switch (role) {
    case 'admin':
      return { label: 'Admin', cls: 'bg-purple-100 text-purple-700', shield: true };
    case 'company_admin':
      return { label: 'Admin empresa', cls: 'bg-brand/10 text-brand', shield: true };
    case 'viewer':
      return { label: 'Solo lectura', cls: 'bg-gray-100 text-gray-500', shield: false };
    default:
      return { label: 'Usuario', cls: 'bg-gray-100 text-gray-600', shield: false };
  }
};

export default function AdminUsersPage() {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === 'admin';
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const usersRes = await api.get('/admin/users');
      setUsers(usersRes.data);
      // company_admin no tiene acceso a /admin/companies (403)
      if (isGlobalAdmin) {
        const companiesRes = await api.get('/admin/companies');
        setCompanies(companiesRes.data);
      }
    } catch {
      // Sin bloqueo: un fallo no debe dejar la página en loading eterno
    } finally {
      setLoading(false);
    }
  }, [isGlobalAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (user: User) => {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email, password: '', role: user.role, companyId: user.companyId ?? '' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, string | null> = {
      name: form.name,
      email: form.email,
      role: form.role,
    };
    // company_admin: el server fuerza su empresa (omitir la key; '' daría 400)
    if (isGlobalAdmin) payload.companyId = form.role === 'admin' ? null : form.companyId;
    if (form.password) payload.password = form.password;
    if (editingId) {
      await api.put(`/admin/users/${editingId}`, payload);
    } else {
      await api.post('/admin/users', payload);
    }
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
    fetchUsers();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al usuario "${name}"?`)) return;
    await api.delete(`/admin/users/${id}`);
    fetchUsers();
  };

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin - Usuarios</h1>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 cursor-pointer">
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar usuarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Creado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-gray-500">{user.email}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const badge = roleBadge(user.role);
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                            {badge.shield ? <Shield size={12} /> : <ShieldOff size={12} />}
                            {badge.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{user.company?.name ?? 'Global'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(user)} className="p-1.5 text-gray-400 hover:text-brand cursor-pointer" title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(user.id, user.name)} className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer" title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Nombre *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                required
              />
              <input
                type="email"
                placeholder="Email *"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                required
              />
              <input
                type="password"
                placeholder={editingId ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña *'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                required={!editingId}
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value, companyId: e.target.value === 'admin' ? '' : form.companyId })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="user">Usuario</option>
                {isGlobalAdmin && <option value="company_admin">Admin de empresa</option>}
                <option value="viewer">Solo lectura</option>
                {isGlobalAdmin && <option value="admin">Admin (global)</option>}
              </select>
              {isGlobalAdmin && form.role !== 'admin' && (
                <select
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                  required
                >
                  <option value="">Selecciona empresa...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 cursor-pointer">
                  {editingId ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
