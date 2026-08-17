import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, KeyRound, Search, Webhook as WebhookIcon } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Webhook, WebhookEvent, Company } from '../../types';
import { WEBHOOK_EVENTS } from '../../types';

interface WebhookForm {
  url: string;
  events: WebhookEvent[];
  active: boolean;
  companyId: string;
}

const emptyForm: WebhookForm = { url: '', events: ['lead.created'], active: true, companyId: '' };

export default function AdminWebhooksPage() {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === 'admin';
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookForm>(emptyForm);
  const [error, setError] = useState('');
  const [newSecret, setNewSecret] = useState('');

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/webhooks');
      setWebhooks(res.data);
      if (isGlobalAdmin) {
        const companiesRes = await api.get('/admin/companies');
        setCompanies(companiesRes.data);
      }
    } catch {
      // sin bloqueo: no dejar la página en loading eterno
    } finally {
      setLoading(false);
    }
  }, [isGlobalAdmin]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setNewSecret('');
    setShowForm(true);
  };

  const openEdit = (webhook: Webhook) => {
    setEditingId(webhook.id);
    setForm({
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      companyId: webhook.companyId ?? '',
    });
    setError('');
    setNewSecret('');
    setShowForm(true);
  };

  const toggleEvent = (event: WebhookEvent) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNewSecret('');
    const payload: Record<string, unknown> = {
      url: form.url,
      events: form.events,
      active: form.active,
    };
    if (isGlobalAdmin) payload.companyId = form.companyId || null;
    try {
      if (editingId) {
        await api.put(`/admin/webhooks/${editingId}`, payload);
      } else {
        const res = await api.post('/admin/webhooks', payload);
        if (res.data?.secret) setNewSecret(res.data.secret);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchWebhooks();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Error al guardar el webhook');
    }
  };

  const handleDelete = async (webhook: Webhook) => {
    if (!confirm(`¿Eliminar el webhook ${webhook.url}?`)) return;
    try {
      await api.delete(`/admin/webhooks/${webhook.id}`);
      fetchWebhooks();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Error al eliminar el webhook');
    }
  };

  const handleRegenerate = async (webhook: Webhook) => {
    try {
      const res = await api.post(`/admin/webhooks/${webhook.id}/regenerate-secret`);
      setNewSecret(res.data.secret);
      setShowForm(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Error al regenerar el secret');
    }
  };

  const filtered = webhooks.filter((w) =>
    w.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin - Webhooks</h1>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 cursor-pointer">
          <Plus size={16} /> Nuevo Webhook
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por URL..."
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
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Eventos</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Creado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron webhooks
                  </td>
                </tr>
              ) : (
                filtered.map((webhook) => (
                  <tr key={webhook.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-gray-900 font-medium">
                        <WebhookIcon size={14} className="text-gray-400" />
                        <span className="max-w-[220px] truncate" title={webhook.url}>{webhook.url}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <span key={event} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                            {WEBHOOK_EVENTS.find((e) => e.value === event)?.label ?? event}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{webhook.company?.name ?? 'Global'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${webhook.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {webhook.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(webhook.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(webhook)} className="p-1.5 text-gray-400 hover:text-brand cursor-pointer" title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleRegenerate(webhook)} className="p-1.5 text-gray-400 hover:text-brand cursor-pointer" title="Regenerar secret">
                          <KeyRound size={16} />
                        </button>
                        <button onClick={() => handleDelete(webhook)} className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer" title="Eliminar">
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

      {newSecret && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-1">Secret generado — se muestra una sola vez</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-yellow-200 rounded px-2 py-1.5 break-all">{newSecret}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(newSecret); alert('Secret copiado'); }}
              className="px-3 py-1.5 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700 cursor-pointer"
            >
              Copiar
            </button>
          </div>
          <p className="text-xs text-yellow-700 mt-2">
            Úsalo para verificar la firma <code className="bg-yellow-100 px-1 rounded">X-Webhook-Signature: sha256=&lt;HMAC-SHA256(secret, body)&gt;</code>
          </p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Editar Webhook' : 'Nuevo Webhook'}
            </h2>
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-3">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="URL del receptor (https://...)"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                required
              />
              <div>
                <p className="text-sm text-gray-600 mb-1.5">Eventos</p>
                <div className="space-y-1.5">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label key={event.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.events.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="rounded border-gray-300"
                      />
                      {event.label}
                    </label>
                  ))}
                </div>
              </div>
              {isGlobalAdmin && (
                <select
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">Global (todas las empresas)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Activo
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 cursor-pointer">
                  {editingId ? 'Guardar Cambios' : 'Crear Webhook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
