import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Workflow, Power } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Rule, RuleTrigger, RuleField, RuleOp, RuleActionType, RuleCondition, RuleAction, Company } from '../../types';
import { RULE_TRIGGERS, RULE_FIELDS, RULE_OPS_BY_FIELD, RULE_OP_LABELS, RULE_ACTION_TYPES, STATUSES } from '../../types';

interface RuleForm {
  name: string;
  trigger: RuleTrigger;
  conditions: RuleCondition[];
  actions: RuleAction[];
  active: boolean;
  companyId: string;
}

const emptyCondition: RuleCondition = { field: 'source', op: 'eq', value: '' };
const emptyAction: RuleAction = { type: 'set_status', value: 'contactado' };

const emptyForm: RuleForm = {
  name: '',
  trigger: 'lead.created',
  conditions: [{ ...emptyCondition }],
  actions: [{ ...emptyAction }],
  active: true,
  companyId: '',
};

const conditionLabel = (c: RuleCondition) => {
  const field = RULE_FIELDS.find((f) => f.value === c.field)?.label ?? c.field;
  return `${field} ${RULE_OP_LABELS[c.op]} ${c.value}`;
};

const actionLabel = (a: RuleAction) => {
  const type = RULE_ACTION_TYPES.find((t) => t.value === a.type)?.label ?? a.type;
  if (a.type === 'set_status') {
    const status = STATUSES.find((s) => s.value === a.value)?.label ?? a.value;
    return `Cambiar estado → ${status}`;
  }
  if (a.type === 'send_email' && typeof a.value === 'object') {
    return `Enviar correo: ${a.value.subject}`;
  }
  return type;
};

export default function AdminRulesPage() {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === 'admin';
  const [rules, setRules] = useState<Rule[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [error, setError] = useState('');

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/rules');
      setRules(res.data);
      if (isGlobalAdmin) {
        const companiesRes = await api.get('/admin/companies');
        setCompanies(companiesRes.data);
      }
    } catch {
      // sin bloqueo
    } finally {
      setLoading(false);
    }
  }, [isGlobalAdmin]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, conditions: [{ ...emptyCondition }], actions: [{ ...emptyAction }] });
    setError('');
    setShowForm(true);
  };

  const openEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      trigger: rule.trigger,
      conditions: rule.conditions.map((c) => ({ ...c })),
      actions: rule.actions.map((a) => ({ ...a, value: typeof a.value === 'object' ? { ...a.value } : a.value })),
      active: rule.active,
      companyId: rule.companyId,
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload: Record<string, unknown> = {
      name: form.name,
      trigger: form.trigger,
      conditions: form.conditions,
      actions: form.actions,
      active: form.active,
    };
    if (isGlobalAdmin) payload.companyId = form.companyId || null;
    try {
      if (editingId) {
        await api.put(`/admin/rules/${editingId}`, payload);
      } else {
        await api.post('/admin/rules', payload);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchRules();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Error al guardar la regla');
    }
  };

  const handleDelete = async (rule: Rule) => {
    if (!confirm(`¿Eliminar la regla "${rule.name}"?`)) return;
    try {
      await api.delete(`/admin/rules/${rule.id}`);
      fetchRules();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Error al eliminar la regla');
    }
  };

  const handleToggle = async (rule: Rule) => {
    try {
      await api.post(`/admin/rules/${rule.id}/toggle`);
      fetchRules();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Error al cambiar el estado');
    }
  };

  const updateCondition = (index: number, patch: Partial<RuleCondition>) => {
    setForm((f) => ({
      ...f,
      conditions: f.conditions.map((c, i) => {
        if (i !== index) return c;
        const next = { ...c, ...patch };
        // Al cambiar el campo, resetear la op a la primera válida del nuevo campo
        if (patch.field && patch.field !== c.field) {
          next.op = RULE_OPS_BY_FIELD[patch.field][0];
        }
        return next;
      }),
    }));
  };

  const updateAction = (index: number, patch: Partial<RuleAction>) => {
    setForm((f) => ({
      ...f,
      actions: f.actions.map((a, i) => {
        if (i !== index) return a;
        const next = { ...a, ...patch } as RuleAction;
        // Al cambiar el tipo, dar un valor por defecto coherente
        if (patch.type && patch.type !== a.type) {
          if (patch.type === 'set_status') next.value = 'contactado';
          else if (patch.type === 'send_email') next.value = { subject: '', body: '' };
          else next.value = '';
        }
        return next;
      }),
    }));
  };

  const filtered = rules.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin - Reglas</h1>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 cursor-pointer">
          <Plus size={16} /> Nueva Regla
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar reglas..."
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
                <th className="px-4 py-3 font-medium">Disparador</th>
                <th className="px-4 py-3 font-medium">Condiciones</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
                {isGlobalAdmin && <th className="px-4 py-3 font-medium">Empresa</th>}
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isGlobalAdmin ? 7 : 6} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron reglas
                  </td>
                </tr>
              ) : (
                filtered.map((rule) => (
                  <tr key={rule.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-gray-900 font-medium">
                        <Workflow size={14} className="text-gray-400" />
                        {rule.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{RULE_TRIGGERS.find((t) => t.value === rule.trigger)?.label ?? rule.trigger}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {rule.conditions.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">{conditionLabel(c)}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[240px]">
                        {rule.actions.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-xs">{actionLabel(a)}</span>
                        ))}
                      </div>
                    </td>
                    {isGlobalAdmin && <td className="px-4 py-3 text-gray-500">{rule.company?.name ?? '-'}</td>}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {rule.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleToggle(rule)} className={`p-1.5 cursor-pointer ${rule.active ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`} title={rule.active ? 'Desactivar' : 'Activar'}>
                          <Power size={16} />
                        </button>
                        <button onClick={() => openEdit(rule)} className="p-1.5 text-gray-400 hover:text-brand cursor-pointer" title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(rule)} className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer" title="Eliminar">
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
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Editar Regla' : 'Nueva Regla'}
            </h2>
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-3">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Nombre de la regla *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                required
              />

              <div>
                <p className="text-sm text-gray-600 mb-1.5">Cuando se</p>
                <select
                  value={form.trigger}
                  onChange={(e) => setForm({ ...form, trigger: e.target.value as RuleTrigger })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
                >
                  {RULE_TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm text-gray-600">y se cumpla (todas)</p>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, conditions: [...f.conditions, { ...emptyCondition }] }))}
                    className="text-xs text-brand hover:underline cursor-pointer"
                  >
                    + Agregar condición
                  </button>
                </div>
                <div className="space-y-2">
                  {form.conditions.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select
                        value={c.field}
                        onChange={(e) => updateCondition(i, { field: e.target.value as RuleField })}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand"
                      >
                        {RULE_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                      <select
                        value={c.op}
                        onChange={(e) => updateCondition(i, { op: e.target.value as RuleOp })}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand"
                      >
                        {RULE_OPS_BY_FIELD[c.field].map((op) => (
                          <option key={op} value={op}>{RULE_OP_LABELS[op]}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="valor"
                        value={c.value}
                        onChange={(e) => updateCondition(i, { value: e.target.value })}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }))}
                        className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                        title="Quitar condición"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm text-gray-600">entonces</p>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, actions: [...f.actions, { ...emptyAction }] }))}
                    className="text-xs text-brand hover:underline cursor-pointer"
                  >
                    + Agregar acción
                  </button>
                </div>
                <div className="space-y-2">
                  {form.actions.map((a, i) => (
                    <div key={i} className="space-y-1.5 border border-gray-100 rounded-lg p-2">
                      <div className="flex gap-2 items-center">
                        <select
                          value={a.type}
                          onChange={(e) => updateAction(i, { type: e.target.value as RuleActionType })}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand"
                        >
                          {RULE_ACTION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }))}
                          className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                          title="Quitar acción"
                        >
                          ✕
                        </button>
                      </div>
                      {a.type === 'set_status' && (
                        <select
                          value={typeof a.value === 'string' ? a.value : 'contactado'}
                          onChange={(e) => updateAction(i, { value: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand"
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      )}
                      {(a.type === 'notify' || a.type === 'add_activity') && (
                        <input
                          type="text"
                          placeholder={a.type === 'notify' ? 'Mensaje de la notificación' : 'Descripción de la actividad'}
                          value={typeof a.value === 'string' ? a.value : ''}
                          onChange={(e) => updateAction(i, { value: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand"
                        />
                      )}
                      {a.type === 'send_email' && (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            placeholder="Asunto ({{name}} {{serviceInterest}} {{city}})"
                            value={typeof a.value === 'object' ? a.value.subject : ''}
                            onChange={(e) => updateAction(i, { value: { subject: e.target.value, body: typeof a.value === 'object' ? a.value.body : '' } })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand"
                          />
                          <textarea
                            placeholder="Mensaje ({{name}} {{serviceInterest}} {{city}})"
                            rows={2}
                            value={typeof a.value === 'object' ? a.value.body : ''}
                            onChange={(e) => updateAction(i, { value: { subject: typeof a.value === 'object' ? a.value.subject : '', body: e.target.value } })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand resize-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {isGlobalAdmin && (
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

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Activa
              </label>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-2 bg-brand text-white rounded-lg text-sm hover:brightness-95 cursor-pointer">
                  {editingId ? 'Guardar Cambios' : 'Crear Regla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
