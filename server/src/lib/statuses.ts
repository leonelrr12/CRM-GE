// Estados del lead compartidos entre rutas y el motor de reglas.
// (En lib/ para evitar ciclos de imports: rules.ts ← events.ts ← leads.ts)

export const LEAD_STATUSES = ['nuevo', 'contactado', 'calificado', 'enviar_propuesta', 'negociacion', 'cerrado', 'perdido'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Calificado',
  enviar_propuesta: 'Enviar propuesta',
  negociacion: 'Negociación',
  cerrado: 'Cerrado',
  perdido: 'Perdido',
};
