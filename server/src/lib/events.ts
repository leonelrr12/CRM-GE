import crypto from 'crypto';
import { runRules, RULE_TRIGGERS } from './rules';
import type { RuleLead, RuleTrigger } from './rules';
import prisma from './prisma';

export const EVENT_TYPES = ['lead.created', 'lead.status_changed', 'lead.updated', 'activity.created'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const WEBHOOK_TIMEOUT_MS = 5000;

interface EmitEventOptions {
  type: EventType;
  companyId: string; // siempre existe: proviene del lead creado/cargado
  title: string;
  message?: string;
  link?: string;
  data?: Record<string, unknown>;
  lead?: RuleLead; // presente en eventos de lead → dispara las reglas
}

interface EmitEventFlags {
  skipRules?: boolean; // true cuando el cambio vino de una acción de regla (anti-loop)
}

// La notificación in-app se espera (rápida, y garantiza que exista cuando
// responde el endpoint); las reglas también (determinista antes de responder);
// el dispatch de webhooks es fire-and-forget y nunca bloquea la respuesta.
// Nunca lanza: errores → console.error.
export async function emitEvent({ type, companyId, title, message, link, data, lead }: EmitEventOptions, flags: EmitEventFlags = {}): Promise<void> {
  try {
    await prisma.notification.create({ data: { companyId, type, title, message, link } });
  } catch (err) {
    console.error('emitEvent: notification.create falló', err);
  }

  if (!flags.skipRules && lead && (RULE_TRIGGERS as readonly string[]).includes(type)) {
    try {
      await runRules(type as RuleTrigger, lead);
    } catch (err) {
      console.error('runRules falló', err);
    }
  }

  void dispatchWebhooks(type, companyId, data).catch((err) => console.error('dispatchWebhooks falló', err));
}

async function dispatchWebhooks(type: EventType, companyId: string, data?: Record<string, unknown>): Promise<void> {
  // Webhooks de la empresa del evento + globales (companyId null).
  // Solo v1: un intento por webhook.
  const [webhooks, company] = await Promise.all([
    prisma.webhook.findMany({
      where: { active: true, events: { has: type }, OR: [{ companyId }, { companyId: null }] },
    }),
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, slug: true } }),
  ]);
  if (webhooks.length === 0) return;

  // El body se serializa UNA vez: la firma cubre exactamente ese string.
  const body = JSON.stringify({
    event: type,
    timestamp: new Date().toISOString(),
    company: company ? { id: company.id, name: company.name, slug: company.slug } : null,
    data: data ?? {},
  });

  await Promise.allSettled(webhooks.map((wh) => sendWebhook(wh, body)));
}

async function sendWebhook(wh: { id: string; url: string; secret: string }, body: string): Promise<void> {
  const signature = crypto.createHmac('sha256', wh.secret).update(body).digest('hex');
  try {
    const res = await fetch(wh.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`Webhook ${wh.id} (${wh.url}) respondió ${res.status}`);
    }
  } catch (err) {
    console.error(`Webhook ${wh.id} (${wh.url}) falló:`, err instanceof Error ? err.message : err);
  }
}
