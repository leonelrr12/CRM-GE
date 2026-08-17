import { LEAD_STATUSES, STATUS_LABELS } from './statuses';
import type { LeadStatus } from './statuses';
import { emitEvent } from './events';
import prisma from './prisma';

// ── Constantes y tipos compartidos (semántica espejo en el cliente) ─────────

export const RULE_TRIGGERS = ['lead.created', 'lead.status_changed', 'lead.updated'] as const;
export type RuleTrigger = (typeof RULE_TRIGGERS)[number];

export const RULE_FIELDS = ['source', 'status', 'serviceInterest', 'city', 'name', 'budget'] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export type RuleOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt';

export const RULE_OPS_BY_FIELD: Record<RuleField, RuleOp[]> = {
  source: ['eq', 'neq'],
  status: ['eq', 'neq'],
  name: ['eq', 'neq', 'contains'],
  serviceInterest: ['eq', 'neq', 'contains'],
  city: ['eq', 'neq', 'contains'],
  budget: ['gt', 'lt'],
};

export const RULE_ACTION_TYPES = ['set_status', 'notify', 'add_activity', 'send_email'] as const;
export type RuleActionType = (typeof RULE_ACTION_TYPES)[number];

export interface RuleLead {
  id: string;
  name: string;
  email: string | null;
  serviceInterest: string | null;
  city: string | null;
  budget: string | null;
  source: string;
  status: string;
  companyId: string;
}

export interface RuleCondition {
  field: RuleField;
  op: RuleOp;
  value: string;
}

export type RuleAction =
  | { type: 'set_status'; value: string }
  | { type: 'notify'; value: string }
  | { type: 'add_activity'; value: string }
  | { type: 'send_email'; value: { subject: string; body: string } };

export interface RuleDraft {
  name: string;
  active: boolean;
  trigger: RuleTrigger;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

// ── Validación del body (estilo validateWebhookBody de admin.ts) ────────────

const MAX_CONDITIONS = 10;
const MAX_ACTIONS = 10;
const MAX_TEXT = 4000;
const MAX_SUBJECT = 200;

export function validateRuleBody(body: Record<string, unknown>): { ok: true; data: RuleDraft } | { ok: false; error: string; status: 400 } {
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return { ok: false, error: 'El nombre es requerido', status: 400 };
  }
  if (!RULE_TRIGGERS.includes(body.trigger as RuleTrigger)) {
    return { ok: false, error: 'Disparador no válido', status: 400 };
  }
  if (!Array.isArray(body.conditions) || body.conditions.length === 0) {
    return { ok: false, error: 'Debe haber al menos una condición', status: 400 };
  }
  if (body.conditions.length > MAX_CONDITIONS) {
    return { ok: false, error: `Máximo ${MAX_CONDITIONS} condiciones`, status: 400 };
  }

  const conditions: RuleCondition[] = [];
  for (const raw of body.conditions) {
    const c = raw as Partial<RuleCondition>;
    if (!RULE_FIELDS.includes(c.field as RuleField)) {
      return { ok: false, error: 'Condición inválida: campo no soportado', status: 400 };
    }
    const field = c.field as RuleField;
    const ops = RULE_OPS_BY_FIELD[field];
    if (!ops.includes(c.op as RuleOp)) {
      return { ok: false, error: `Condición inválida: el campo ${field} no soporta el operador ${String(c.op)}`, status: 400 };
    }
    if (typeof c.value !== 'string' || !c.value.trim()) {
      return { ok: false, error: 'El valor de la condición no puede estar vacío', status: 400 };
    }
    if (field === 'budget') {
      const num = parseFloat(c.value.replace(/[^\d.]/g, ''));
      if (Number.isNaN(num)) {
        return { ok: false, error: 'El valor de budget debe ser numérico', status: 400 };
      }
    }
    conditions.push({ field, op: c.op as RuleOp, value: c.value.trim() });
  }

  if (!Array.isArray(body.actions) || body.actions.length === 0) {
    return { ok: false, error: 'Debe haber al menos una acción', status: 400 };
  }
  if (body.actions.length > MAX_ACTIONS) {
    return { ok: false, error: `Máximo ${MAX_ACTIONS} acciones`, status: 400 };
  }

  const actions: RuleAction[] = [];
  for (const raw of body.actions) {
    const a = raw as Partial<RuleAction> & { type?: string; value?: unknown };
    switch (a.type) {
      case 'set_status': {
        const value = typeof a.value === 'string' ? a.value : '';
        if (!(LEAD_STATUSES as readonly string[]).includes(value)) {
          return { ok: false, error: 'Estado no válido para set_status', status: 400 };
        }
        actions.push({ type: 'set_status', value });
        break;
      }
      case 'notify':
      case 'add_activity': {
        const value = typeof a.value === 'string' ? a.value : '';
        if (!value.trim() || value.length > MAX_TEXT) {
          return { ok: false, error: 'Acción no válida: texto requerido (máx 4000)', status: 400 };
        }
        actions.push({ type: a.type, value });
        break;
      }
      case 'send_email': {
        const v = a.value as { subject?: unknown; body?: unknown } | undefined;
        const subject = typeof v?.subject === 'string' ? v.subject : '';
        const body = typeof v?.body === 'string' ? v.body : '';
        if (!subject.trim() || !body.trim() || subject.length > MAX_SUBJECT || body.length > MAX_TEXT) {
          return { ok: false, error: 'send_email requiere subject (máx 200) y body (máx 4000)', status: 400 };
        }
        actions.push({ type: 'send_email', value: { subject, body } });
        break;
      }
      default:
        return { ok: false, error: 'Acción no válida', status: 400 };
    }
  }

  return {
    ok: true,
    data: {
      name: body.name.trim(),
      active: body.active === false ? false : true,
      trigger: body.trigger as RuleTrigger,
      conditions,
      actions,
    },
  };
}

// ── Evaluación ───────────────────────────────────────────────────────────────

const asString = (v: unknown): string => (v == null ? '' : String(v));

function parseBudget(v: unknown): number {
  return parseFloat(asString(v).replace(/[^\d.]/g, ''));
}

// AND estricto, case-insensitive; budget gt/lt numérico (NaN → false)
function matchesCondition(condition: RuleCondition, lead: RuleLead): boolean {
  const fieldValue = lead[condition.field];
  const condValue = condition.value;

  if (condition.field === 'budget') {
    const a = parseBudget(fieldValue);
    const b = parseFloat(condValue);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return condition.op === 'gt' ? a > b : a < b;
  }

  const s = asString(fieldValue).toLowerCase();
  const c = condValue.toLowerCase();
  switch (condition.op) {
    case 'eq': return s === c;
    case 'neq': return s !== c;
    case 'contains': return s.includes(c);
    default: return false;
  }
}

// ── Ejecución ────────────────────────────────────────────────────────────────

// Nunca lanza: cada acción va aislada con try/catch.
// Las acciones de una regla pueden afectar las condiciones de las siguientes
// (current mutable, reglas en orden de creación).
export async function runRules(trigger: RuleTrigger, lead: RuleLead): Promise<void> {
  try {
    const rules = await prisma.rule.findMany({
      where: { companyId: lead.companyId, active: true, trigger },
      orderBy: { createdAt: 'asc' },
    });
    if (rules.length === 0) return;

    const current: RuleLead = { ...lead };

    for (const rule of rules) {
      const ruleConditions = rule.conditions as unknown as RuleCondition[];
      const ruleActions = rule.actions as unknown as RuleAction[];
      if (!Array.isArray(ruleConditions) || !Array.isArray(ruleActions)) continue;

      const matches = ruleConditions.every((c) => matchesCondition(c, current));
      if (!matches) continue;

      for (const action of ruleActions) {
        await executeAction(rule.name, action, current).catch((err) =>
          console.error(`Regla "${rule.name}": acción ${action.type} falló:`, err instanceof Error ? err.message : err),
        );
      }
    }
  } catch (err) {
    console.error('runRules falló:', err instanceof Error ? err.message : err);
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// {{name}} {{serviceInterest}} {{city}} — reemplazadas antes del escape
function interpolate(template: string, lead: RuleLead): string {
  return template
    .replace(/\{\{name\}\}/g, lead.name)
    .replace(/\{\{serviceInterest\}\}/g, lead.serviceInterest ?? '')
    .replace(/\{\{city\}\}/g, lead.city ?? '');
}

async function executeAction(ruleName: string, action: RuleAction, current: RuleLead): Promise<void> {
  switch (action.type) {
    case 'set_status': {
      if (current.status === action.value) return; // no-op: no emitir
      const prev = current.status;
      await prisma.lead.update({ where: { id: current.id }, data: { status: action.value } });
      current.status = action.value;

      // Replicar la actividad automática del PATCH para consistencia
      if (action.value === 'contactado') {
        await prisma.activity.create({
          data: {
            leadId: current.id,
            type: 'nota',
            description: 'Lead marcado como contactado (cambio automático)',
          },
        }).catch(() => {});
      }

      // Notificaciones y webhooks sí; reglas NO (skipRules evita el loop)
      await emitEvent({
        type: 'lead.status_changed',
        companyId: current.companyId,
        title: 'Estado cambiado',
        message: `${current.name} · ${STATUS_LABELS[prev as LeadStatus] ?? prev} → ${STATUS_LABELS[action.value as LeadStatus] ?? action.value}`,
        link: `/leads/${current.id}`,
        data: { id: current.id, name: current.name, previousStatus: prev, status: action.value },
        lead: current,
      }, { skipRules: true });
      break;
    }
    case 'notify': {
      await prisma.notification.create({
        data: {
          companyId: current.companyId,
          type: 'rule.notify',
          title: `Regla: ${ruleName}`,
          message: action.value,
          link: `/leads/${current.id}`,
        },
      });
      break;
    }
    case 'add_activity': {
      await prisma.activity.create({
        data: { leadId: current.id, type: 'nota', description: action.value },
      });
      break;
    }
    case 'send_email': {
      if (!current.email) {
        console.error(`Regla "${ruleName}": send_email omitido (lead sin email)`);
        break;
      }
      const MAILER_URL = process.env.MAILER_URL || 'http://localhost:3004';
      const MAILER_API_KEY = process.env.MAILER_API_KEY || '';
      const subject = interpolate(action.value.subject, current);
      const body = interpolate(action.value.body, current);
      const html = `<p>${escapeHtml(body).replace(/\n/g, '<br/>')}</p>`;

      const mailerRes = await fetch(`${MAILER_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MAILER_API_KEY}`,
        },
        body: JSON.stringify({ to: current.email, subject, text: body, html }),
        signal: AbortSignal.timeout(10000),
      });
      if (!mailerRes.ok) {
        console.error(`Regla "${ruleName}": mailer respondió ${mailerRes.status}`);
      }
      break;
    }
  }
}
