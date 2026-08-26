import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, MessageSquarePlus, Mail, MessageCircle, RefreshCw, Send } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Lead, Activity, LeadStatus, ChatMessage, ChatResponse } from '../../types';
import { SOURCES, STATUSES, ACTIVITY_TYPES } from '../../types';

function safeImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = user?.role !== 'viewer';
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [newActivity, setNewActivity] = useState({ type: 'nota', description: '' });
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showMailForm, setShowMailForm] = useState(false);
  const [mailForm, setMailForm] = useState({ subject: '', message: '' });
  const [mailError, setMailError] = useState('');
  const [mailSending, setMailSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [chatCanReply, setChatCanReply] = useState(true);
  const [chatWindowOpensAt, setChatWindowOpensAt] = useState<string | null>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const chatInFlight = useRef(false);

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

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMailError('');
    setMailSending(true);
    try {
      await api.post(`/leads/${id}/send-email`, mailForm);
      setShowMailForm(false);
      setMailForm({ subject: '', message: '' });
      // Refrescar la bitácora (el server registra la actividad del correo)
      const actRes = await api.get(`/activities/lead/${id}`);
      setActivities(actRes.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setMailError(axiosErr.response?.data?.error || 'Error al enviar el correo');
    } finally {
      setMailSending(false);
    }
  };

  const fetchChat = useCallback(async () => {
    if (chatInFlight.current) return;
    chatInFlight.current = true;
    try {
      const res = await api.get<ChatResponse>(`/leads/${id}/chat`);
      setChatMessages(res.data.messages);
      setChatCanReply(res.data.canReply);
      setChatWindowOpensAt(res.data.windowOpensAt);
      setChatError('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setChatError(axiosErr.response?.data?.error || 'WhatsApp no disponible');
    } finally {
      chatInFlight.current = false;
      setChatLoading(false);
    }
  }, [id]);

  // Polling del hilo cada 15s mientras el lead tiene número de WhatsApp
  useEffect(() => {
    if (!lead?.phone) return;
    setChatLoading(true);
    fetchChat();
    const t = setInterval(fetchChat, 15000);
    return () => clearInterval(t);
  }, [lead?.phone, fetchChat]);

  // Scroll al fondo al cargar o llegar mensajes nuevos
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatDraft.trim() || chatSending) return;
    setChatSending(true);
    try {
      await api.post(`/leads/${id}/chat/send`, { message: chatDraft });
      setChatDraft('');
      // Refetch inmediato: el bot inserta el mensaje de forma síncrona
      await fetchChat();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setChatError(axiosErr.response?.data?.error || 'Error al enviar el mensaje');
    } finally {
      setChatSending(false);
    }
  };

  // Tiempo restante de la ventana de WhatsApp (24h desde el último mensaje del cliente)
  const windowRemaining = useMemo(() => {
    if (!chatWindowOpensAt) return '';
    const ms = new Date(chatWindowOpensAt).getTime() - Date.now();
    if (ms <= 0) return '';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }, [chatWindowOpensAt]);

  const renderChatText = (m: ChatMessage) => {
    if (m.type === 'image') return '📷 [Imagen]';
    if (m.type === 'media') {
      const t = m.text.toLowerCase();
      if (t.includes('video')) return '🎬 [Video]';
      if (t.includes('audio')) return '🎵 [Audio]';
      if (t.includes('image') || t.includes('imagen')) return '📷 [Imagen]';
      return '📎 [Archivo]';
    }
    return m.text;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
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
              {canEdit && (
                <div className="flex gap-2">
                  <button onClick={handleDeleteLead} className="p-2 text-gray-400 hover:text-red-600 cursor-pointer">
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>

            <div className={`grid grid-cols-2 gap-4 mb-4 ${canEdit ? '' : 'pointer-events-none opacity-80'}`}>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input type="text" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono de contacto</label>
                <input type="tel" value={editForm.contactPhone || ''} onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono (ID WhatsApp)</label>
                <div className="flex gap-2 items-center">
                  <input type="tel" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
                  {lead.phone && (
                    <a
                      href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir chat de WhatsApp"
                      className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 shrink-0"
                    >
                      <MessageCircle size={16} />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Servicio de interés</label>
                <input type="text" value={editForm.serviceInterest || ''} onChange={(e) => setEditForm({ ...editForm, serviceInterest: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ciudad / Ubicación</label>
                <input type="text" value={editForm.city || ''} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Presupuesto / Consumo</label>
                <input type="text" value={editForm.budget || ''} onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fuente</label>
                <select value={editForm.source || 'web'} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand">
                  {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <select value={editForm.status || 'nuevo'} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as LeadStatus })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand">
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className={`mb-4 ${canEdit ? '' : 'pointer-events-none opacity-80'}`}>
              <label className="block text-xs text-gray-500 mb-1">Notas</label>
              <textarea value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand resize-none" />
            </div>

            {editForm.receiptImage && (
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Recibo de luz</label>
                <div className="relative inline-block">
                  <img
                    src={safeImageUrl(editForm.receiptImage)}
                    alt="Recibo de luz"
                    className="max-w-xs max-h-48 rounded-lg border border-gray-200 cursor-pointer object-cover"
                    onClick={() => setShowReceipt(true)}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      if (target.nextElementSibling) {
                        (target.nextElementSibling as HTMLElement).textContent = '💡 Imagen no disponible';
                      }
                    }}
                  />
                  <p className="text-xs text-gray-400 mt-1">Click para ampliar</p>
                </div>
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2">
                <button onClick={handleSaveLead} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 disabled:opacity-50 cursor-pointer">
                  <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  onClick={() => { setMailError(''); setShowMailForm(true); }}
                  disabled={!lead.email}
                  title={!lead.email ? 'El lead no tiene email registrado' : 'Enviar correo al lead'}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand/10 text-brand rounded-lg text-sm hover:bg-brand/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Mail size={16} /> Enviar correo
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Actividades</h2>
              {canEdit && (
                <button onClick={() => setShowActivityForm(!showActivityForm)} className="flex items-center gap-1 px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-sm hover:bg-brand/20 cursor-pointer">
                  <MessageSquarePlus size={16} /> Agregar
                </button>
              )}
            </div>

            {showActivityForm && canEdit && (
              <form onSubmit={handleAddActivity} className="mb-4 bg-gray-50 rounded-lg p-3 space-y-2">
                <select value={newActivity.type} onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                  {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
                <textarea value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })} placeholder="Descripción de la actividad..." rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand resize-none" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowActivityForm(false)} className="flex-1 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-100 cursor-pointer">Cancelar</button>
                  <button type="submit" className="flex-1 py-1.5 bg-brand text-white rounded-lg text-xs hover:brightness-95 cursor-pointer">Guardar</button>
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

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Chat de WhatsApp</h2>
              {lead.phone && (
                <button
                  onClick={() => { setChatLoading(true); fetchChat(); }}
                  disabled={chatLoading}
                  className="p-1.5 text-gray-400 hover:text-brand cursor-pointer"
                  title="Actualizar"
                >
                  <RefreshCw size={16} className={chatLoading ? 'animate-spin' : ''} />
                </button>
              )}
            </div>

            {!lead.phone ? (
              <p className="text-gray-400 text-sm">Este lead no tiene número de WhatsApp</p>
            ) : (
              <>
                {chatError && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-3">
                    {chatError}
                    <button onClick={() => { setChatLoading(true); fetchChat(); }} className="underline ml-2 cursor-pointer">Reintentar</button>
                  </div>
                )}

                <div ref={chatBoxRef} className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
                  {chatLoading && chatMessages.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">Cargando chat...</p>
                  ) : chatMessages.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-400 text-sm">Sin mensajes aún</p>
                      {canEdit && <p className="text-xs text-gray-400 mt-1">Responde para iniciar la conversación</p>}
                    </div>
                  ) : (
                    chatMessages.map((m) => (
                      <div key={m.id} className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.fromMe ? 'bg-brand text-white ml-auto' : 'bg-gray-100 text-gray-900 mr-auto'}`}>
                        <p className="whitespace-pre-wrap break-words">{renderChatText(m)}</p>
                        <p className={`text-[10px] mt-1 ${m.fromMe ? 'text-white/70' : 'text-gray-400'}`}>
                          {new Date(m.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {!chatCanReply && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-amber-800 font-medium">⏳ Ventana de WhatsApp cerrada</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      El cliente no ha escrito en las últimas 24 horas. La ventana se reabre automáticamente cuando te escriba.
                      {chatWindowOpensAt && (
                        <> Se abrirá el {new Date(chatWindowOpensAt).toLocaleString('es')} si el cliente no escribe antes.</>
                      )}
                    </p>
                  </div>
                )}
                {chatCanReply && windowRemaining && (
                  <p className="text-[11px] text-gray-400 mt-2">Ventana de WhatsApp abierta — quedan ~{windowRemaining}</p>
                )}
                {canEdit && (
                  <form onSubmit={handleSendChat} className="flex gap-2 mt-3">
                    <input
                      type="text"
                      placeholder={chatCanReply ? 'Escribe una respuesta...' : 'Ventana cerrada — esperando mensaje del cliente'}
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      maxLength={4000}
                      disabled={!chatCanReply}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    />
                    <button
                      type="submit"
                      disabled={chatSending || !chatDraft.trim() || !chatCanReply}
                      className="px-4 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title="Enviar"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                )}
              </>
            )}
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
            src={safeImageUrl(editForm.receiptImage)}
            alt="Recibo de luz"
            className="max-w-[90vw] max-h-[90vh] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {showMailForm && lead.email && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMailForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Enviar correo a {lead.name}</h2>
            {mailError && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-3">
                {mailError}
              </div>
            )}
            <form onSubmit={handleSendEmail} className="space-y-3">
              <input
                type="text"
                placeholder="Asunto *"
                value={mailForm.subject}
                onChange={(e) => setMailForm({ ...mailForm, subject: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                required
              />
              <textarea
                placeholder="Mensaje *"
                rows={5}
                value={mailForm.message}
                onChange={(e) => setMailForm({ ...mailForm, message: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand resize-none"
                required
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowMailForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" disabled={mailSending} className="flex-1 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 disabled:opacity-50 cursor-pointer">
                  {mailSending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
