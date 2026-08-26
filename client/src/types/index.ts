export interface Company {
  id: string;
  name: string;
  slug: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
  createdAt?: string;
  leadCount?: number;
  userCount?: number;
}

export interface NotificationItem {
  id: string;
  companyId: string;
  type: string;
  title: string;
  message?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export type WebhookEvent = 'lead.created' | 'lead.status_changed' | 'lead.updated' | 'activity.created';

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  companyId?: string | null;
  company?: Company | null;
  createdAt: string;
  secret?: string; // solo en la respuesta de create/regenerate
}

export const WEBHOOK_EVENTS: { value: WebhookEvent; label: string }[] = [
  { value: 'lead.created', label: 'Lead creado' },
  { value: 'lead.status_changed', label: 'Estado cambiado' },
  { value: 'lead.updated', label: 'Lead editado' },
  { value: 'activity.created', label: 'Actividad creada' },
];

export type RuleTrigger = 'lead.created' | 'lead.status_changed' | 'lead.updated';
export type RuleField = 'source' | 'status' | 'serviceInterest' | 'city' | 'name' | 'budget';
export type RuleOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
export type RuleActionType = 'set_status' | 'notify' | 'add_activity' | 'send_email';

export interface RuleCondition {
  field: RuleField;
  op: RuleOp;
  value: string;
}

export interface RuleAction {
  type: RuleActionType;
  value: string | { subject: string; body: string };
}

export interface Rule {
  id: string;
  name: string;
  active: boolean;
  trigger: RuleTrigger;
  conditions: RuleCondition[];
  actions: RuleAction[];
  companyId: string;
  company?: Company | null;
  createdAt: string;
  updatedAt: string;
}

export const RULE_TRIGGERS: { value: RuleTrigger; label: string }[] = [
  { value: 'lead.created', label: 'Lead creado' },
  { value: 'lead.status_changed', label: 'Estado cambiado' },
  { value: 'lead.updated', label: 'Lead editado' },
];

export const RULE_FIELDS: { value: RuleField; label: string }[] = [
  { value: 'source', label: 'Origen' },
  { value: 'status', label: 'Estado' },
  { value: 'serviceInterest', label: 'Servicio de interés' },
  { value: 'city', label: 'Ciudad' },
  { value: 'name', label: 'Nombre' },
  { value: 'budget', label: 'Presupuesto' },
];

export const RULE_OP_LABELS: Record<RuleOp, string> = {
  eq: 'es igual a',
  neq: 'no es igual a',
  contains: 'contiene',
  gt: 'mayor que',
  lt: 'menor que',
};

export const RULE_OPS_BY_FIELD: Record<RuleField, RuleOp[]> = {
  source: ['eq', 'neq'],
  status: ['eq', 'neq'],
  name: ['eq', 'neq', 'contains'],
  serviceInterest: ['eq', 'neq', 'contains'],
  city: ['eq', 'neq', 'contains'],
  budget: ['gt', 'lt'],
};

export const RULE_ACTION_TYPES: { value: RuleActionType; label: string }[] = [
  { value: 'set_status', label: 'Cambiar estado' },
  { value: 'notify', label: 'Notificar' },
  { value: 'add_activity', label: 'Agregar actividad' },
  { value: 'send_email', label: 'Enviar correo' },
];

export interface ChatMessage {
  id: number;
  chatId: string;
  fromMe: boolean;
  text: string;
  timestamp: string;
  type?: string;
}

export interface ChatResponse {
  chatId: string;
  session: string;
  messages: ChatMessage[];
  total: number;
  canReply: boolean;
  windowOpensAt: string | null;
}

export type UserRole = 'admin' | 'company_admin' | 'user' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string | null;
  company?: Company | null;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contactPhone: string | null;
  serviceInterest: string | null;
  city: string | null;
  budget: string | null;
  receiptImage: string | null;
  source: string;
  status: LeadStatus;
  notes: string | null;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
  activities?: Activity[];
}

export type LeadStatus = 'nuevo' | 'contactado' | 'calificado' | 'enviar_propuesta' | 'negociacion' | 'cerrado' | 'perdido';

export interface Activity {
  id: string;
  leadId: string;
  type: string;
  description: string;
  createdAt: string;
}

export interface DashboardStats {
  totalLeads: number;
  bySource: { source: string; count: number }[];
  byStatus: { status: string; count: number }[];
  conversionRate: number;
  newThisWeek: number;
  newToday: number;
  byCompany: { companyId: string | null; name: string; count: number }[];
  growthPercent: string;
  recentLeads: Pick<Lead, 'id' | 'name' | 'source' | 'status' | 'createdAt'>[];
}

export const SOURCES = [
  { value: 'web', label: 'Sitio Web' },
  { value: 'ig_ads', label: 'Instagram Ads' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'otro', label: 'Otro' },
] as const;

export const STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'nuevo', label: 'Nuevo', color: 'bg-blue-100 text-blue-800' },
  { value: 'contactado', label: 'Contactado', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'calificado', label: 'Calificado', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'enviar_propuesta', label: 'Enviar propuesta', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'negociacion', label: 'Negociación', color: 'bg-purple-100 text-purple-800' },
  { value: 'cerrado', label: 'Cerrado', color: 'bg-green-100 text-green-800' },
  { value: 'perdido', label: 'Perdido', color: 'bg-red-100 text-red-800' },
];

export const ACTIVITY_TYPES = [
  { value: 'llamada', label: 'Llamada', icon: '📞' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'reunion', label: 'Reunión', icon: '🤝' },
  { value: 'nota', label: 'Nota', icon: '📝' },
];
