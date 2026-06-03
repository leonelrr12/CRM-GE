import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, MessageSquarePlus } from 'lucide-react';
import api from '../../services/api';
import type { Lead, Activity } from '../../types';
import { SOURCES, STATUSES, ACTIVITY_TYPES } from '../../types';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [newActivity, setNewActivity] = useState({ type: 'nota', description: '' });
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const fetchLead = useCallback(async () => {
    const [leadRes, actRes] = await Promise.all([
      api.get(`/leads/${id}`),
      api.get(`/activities/lead/${id}`),
    ]);
    setLead(leadRes.data);
    setActivities(actRes.data);
    setEditForm(leadRes.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const handleSaveLead = async () => {
    setSaving(true);
    await api.put(`/leads/${id}`, editForm);
    await fetchLead();
    setSaving(false);
  };

  const handleDeleteLead = async () => {
    if (!confirm('¿Eliminar este lead?')) return;
    await api.delete(`/leads/${id}`);
    navigate('/leads');
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.description.trim()) return;
    await api.post(`/activities/lead/${id}`, newActivity);
    setNewActivity({ type: 'nota', description: '' });
    setShowActivityForm(false);
    const actRes = await api.get(`/activities/lead/${id}`);
    setActivities(actRes.data);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!lead) return null;

  const status = STATUSES.find((s) => s.value === lead.status);

  return (
    <div>
      <button onClick={() => navigate('/leads')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-4 cursor-pointer">
        <ArrowLeft size={16} /> Volver a leads
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{lead.name}</h1>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${status?.color}`}>{status?.label}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={handleDeleteLead} className="p-2 text-gray-400 hover:text-red-600 cursor-pointer">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input type="text" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono de contacto</label>
                <input type="tel" value={editForm.contactPhone || ''} onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono (ID WhatsApp)</label>
                <input type="tel" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Servicio de interés</label>
                <input type="text" value={editForm.serviceInterest || ''} onChange={(e) => setEditForm({ ...editForm, serviceInterest: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ciudad / Ubicación</label>
                <input type="text" value={editForm.city || ''} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Presupuesto / Consumo</label>
                <input type="text" value={editForm.budget || ''} onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fuente</label>
                <select value={editForm.source || 'web'} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <select value={editForm.status || 'nuevo'} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Notas</label>
              <textarea value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {editForm.receiptImage && (
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Recibo de luz</label>
                <div className="relative inline-block">
                  <img
                    src={editForm.receiptImage}
                    alt="Recibo de luz"
                    className="max-w-xs max-h-48 rounded-lg border border-gray-200 cursor-pointer object-cover"
                    onClick={() => setShowReceipt(true)}
                  />
                  <p className="text-xs text-gray-400 mt-1">Click para ampliar</p>
                </div>
              </div>
            )}

            <button onClick={handleSaveLead} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Actividades</h2>
              <button onClick={() => setShowActivityForm(!showActivityForm)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 cursor-pointer">
                <MessageSquarePlus size={16} /> Agregar
              </button>
            </div>

            {showActivityForm && (
              <form onSubmit={handleAddActivity} className="mb-4 bg-gray-50 rounded-lg p-3 space-y-2">
                <select value={newActivity.type} onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                  {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
                <textarea value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })} placeholder="Descripción de la actividad..." rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowActivityForm(false)} className="flex-1 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-100 cursor-pointer">Cancelar</button>
                  <button type="submit" className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 cursor-pointer">Guardar</button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Sin actividades registradas</p>
              ) : (
                activities.map((act) => {
                  const typeInfo = ACTIVITY_TYPES.find((t) => t.value === act.type);
                  return (
                    <div key={act.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg shrink-0 mt-0.5">{typeInfo?.icon || '📝'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-gray-500">{typeInfo?.label || act.type}</span>
                          <span className="text-xs text-gray-400">{new Date(act.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-700">{act.description}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">Información</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Creado</p>
                <p className="text-gray-700">{new Date(lead.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Actualizado</p>
                <p className="text-gray-700">{new Date(lead.updatedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Servicio</p>
                <p className="text-gray-700">{lead.serviceInterest || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Ciudad</p>
                <p className="text-gray-700">{lead.city || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Presupuesto</p>
                <p className="text-gray-700">{lead.budget || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Actividades</p>
                <p className="text-gray-700">{activities.length} registradas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showReceipt && editForm.receiptImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowReceipt(false)}>
          <img
            src={editForm.receiptImage}
            alt="Recibo de luz"
            className="max-w-[90vw] max-h-[90vh] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
