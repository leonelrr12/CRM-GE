import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Building2 } from 'lucide-react';
import api from '../../services/api';
import type { Company } from '../../types';

interface CompanyForm {
  name: string;
  slug: string;
  primaryColor: string;
  logoUrl: string;
}

const emptyForm: CompanyForm = { name: '', slug: '', primaryColor: '#16a34a', logoUrl: '' };

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [error, setError] = useState('');

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/admin/companies');
    setCompanies(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (company: Company) => {
    setEditingId(company.id);
    // El <input type="color"> exige #rrggbb; sin branding → el verde del formulario.
    setForm({
      name: company.name,
      slug: company.slug,
      primaryColor: company.primaryColor ?? '#16a34a',
      logoUrl: company.logoUrl ?? '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api.put(`/admin/companies/${editingId}`, form);
      } else {
        await api.post('/admin/companies', form);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchCompanies();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Error al guardar la empresa');
    }
  };

  const handleDelete = async (company: Company) => {
    if (!confirm(`¿Eliminar la empresa "${company.name}"?`)) return;
    try {
      await api.delete(`/admin/companies/${company.id}`);
      fetchCompanies();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Error al eliminar la empresa');
    }
  };

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin - Empresas</h1>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 cursor-pointer">
          <Plus size={16} /> Nueva Empresa
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar empresas..."
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
                <th className="px-4 py-3 font-medium">Marca</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Leads</th>
                <th className="px-4 py-3 font-medium">Usuarios</th>
                <th className="px-4 py-3 font-medium">Creado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron empresas
                  </td>
                </tr>
              ) : (
                filtered.map((company) => (
                  <tr key={company.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      <span className="inline-flex items-center gap-2">
                        <Building2 size={16} className="text-gray-400" />
                        {company.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block w-4 h-4 rounded-full border border-gray-200"
                          style={{ backgroundColor: company.primaryColor ?? '#16a34a' }}
                          title={company.primaryColor ?? '#16a34a'}
                        />
                        {company.logoUrl && (
                          <img
                            src={company.logoUrl}
                            alt="logo"
                            className="h-6 object-contain"
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                        /captacion/{company.slug}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{company.leadCount ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500">{company.userCount ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {company.createdAt ? new Date(company.createdAt).toLocaleDateString() : ''}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(company)} className="p-1.5 text-gray-400 hover:text-brand cursor-pointer" title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(company)} className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer" title="Eliminar">
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
              {editingId ? 'Editar Empresa' : 'Nueva Empresa'}
            </h2>
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-3">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Nombre *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                required
              />
              <div>
                <input
                  type="text"
                  placeholder={editingId ? 'Slug (URL de captación)' : 'Slug (vacío = se genera del nombre)'}
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                />
                {form.slug && (
                  <p className="text-xs text-gray-400 mt-1">URL: /captacion/{form.slug}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Color principal</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                      className="w-10 h-9 rounded cursor-pointer border border-gray-300"
                      title="Color del formulario y del CRM"
                    />
                    <span className="text-xs text-gray-400 font-mono">{form.primaryColor}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Logo (URL)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                {form.logoUrl && (
                  <img
                    src={form.logoUrl}
                    alt="preview"
                    className="h-9 object-contain self-end"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 cursor-pointer">
                  {editingId ? 'Guardar Cambios' : 'Crear Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
