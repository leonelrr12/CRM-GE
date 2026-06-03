import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Download, Filter } from 'lucide-react';
import api from '../../services/api';
import type { Lead } from '../../types';
import { SOURCES, STATUSES } from '../../types';

function sourceLabel(source: string) {
  const found = SOURCES.find((s) => s.value === source);
  if (found) return found.label;
  if (source === 'web') return '🌐 Web';
  if (source === 'ig_ads') return '📱 IG Ads';
  if (source === 'whatsapp') return '💬 WhatsApp';
  return source;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'web', notes: '' });
  const navigate = useNavigate();

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sourceFilter !== 'todas') params.append('source', sourceFilter);
    if (statusFilter !== 'todas') params.append('status', statusFilter);
    if (search.trim()) params.append('search', search.trim());

    const res = await api.get(`/leads?${params}`);
    setLeads(res.data);
    setLoading(false);
  }, [sourceFilter, statusFilter, search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/leads', form);
    setShowForm(false);
    setForm({ name: '', email: '', phone: '', source: 'web', notes: '' });
    fetchLeads();
  };

  const handleExport = (format: string) => {
    const url = `/api/export/${format}`;
    const token = localStorage.getItem('token');
    const a = document.createElement('a');
    a.href = url;
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.blob())
        .then((blob) => {
          a.href = URL.createObjectURL(blob);
          a.download = `leads-crmge.${format}`;
          a.click();
        });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <div className="flex gap-2">
          <button onClick={() => handleExport('excel')} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 cursor-pointer">
            <Download size={16} /> Excel
          </button>
          <button onClick={() => handleExport('csv')} className="flex items-center gap-1.5 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 cursor-pointer">
            <Download size={16} /> CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">
            <Plus size={16} /> Nuevo Lead
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="todas">Todas las fuentes</option>
              {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="todas">Todos los estados</option>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Fuente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron leads
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const status = STATUSES.find((s) => s.value === lead.status);
                  const displayPhone = lead.contactPhone || lead.phone || '-';
                  return (
                    <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                      <td className="px-4 py-3 text-gray-900 font-medium">{lead.name}</td>
                      <td className="px-4 py-3 text-gray-500">{lead.email || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{displayPhone}</td>
                      <td className="px-4 py-3 text-gray-500">{sourceLabel(lead.source)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status?.color}`}>
                          {status?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{new Date(lead.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Link to={`/leads/${lead.id}`} className="text-blue-600 hover:underline text-xs">Ver</Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Nuevo Lead</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input type="text" placeholder="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
              <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="tel" placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <textarea placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">Crear Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
