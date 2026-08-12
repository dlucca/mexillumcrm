export type Option = { value: string; label: string };

export const STAGES = [
  { value: "lead_sin_contactar", label: "Lead / sin contactar" },
  { value: "outreach_enviado", label: "Outreach enviado" },
  { value: "respondio_interesado", label: "Respondió / interesado" },
  { value: "diagnostico_web", label: "Diagnóstico web" },
  { value: "webcall_discovery", label: "Webcall / discovery" },
  { value: "propuesta_preparacion", label: "Propuesta en preparación" },
  { value: "propuesta_enviada", label: "Propuesta enviada" },
  { value: "negociacion_objeciones", label: "Negociación / objeciones" },
  { value: "propuesta_aceptada", label: "Propuesta aceptada" },
  { value: "contrato_enviado", label: "Contrato enviado" },
  { value: "contrato_firmado", label: "Contrato firmado" },
  { value: "onboarding_kickoff", label: "Onboarding / kickoff" },
  { value: "cliente_activo", label: "Cliente activo" },
] satisfies Option[];

export const STAGE_GROUPS = [
  { value: "lead", label: "Lead" },
  { value: "qualification", label: "Qualification" },
  { value: "solution", label: "Solution" },
  { value: "commercial", label: "Commercial" },
  { value: "delivery", label: "Delivery" },
  { value: "active", label: "Active" },
] satisfies Option[];

export const STATUSES = [
  { value: "open", label: "Abierto" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
  { value: "paused", label: "Pausado" },
  { value: "active_customer", label: "Cliente activo" },
] satisfies Option[];

export const SOLUTION_TYPES = [
  { value: "solar", label: "Solar" },
  { value: "bess", label: "BESS" },
  { value: "solar_bess", label: "Solar + BESS" },
  { value: "unknown", label: "Sin definir" },
] satisfies Option[];

export const SOURCES = [
  { value: "diagnostico_web", label: "Diagnóstico web" },
  { value: "referido", label: "Referido" },
  { value: "outbound", label: "Outbound" },
  { value: "intermepro", label: "Intermepro" },
  { value: "otro", label: "Otro" },
] satisfies Option[];

export const LOST_REASONS = [
  { value: "precio", label: "Precio" },
  { value: "timing", label: "Timing" },
  { value: "competencia", label: "Competencia" },
  { value: "sin_presupuesto", label: "Sin presupuesto" },
  { value: "sin_respuesta", label: "Sin respuesta" },
  { value: "no_viable_tecnico", label: "No viable técnico" },
  { value: "otro", label: "Otro" },
] satisfies Option[];

export const STAGE_VALUES = STAGES.map((s) => s.value);
export const STATUS_VALUES = STATUSES.map((s) => s.value);
export const SOLUTION_TYPE_VALUES = SOLUTION_TYPES.map((s) => s.value);
export const SOURCE_VALUES = SOURCES.map((s) => s.value);
export const LOST_REASON_VALUES = LOST_REASONS.map((s) => s.value);

const STAGE_TO_GROUP: Record<string, string> = {
  lead_sin_contactar: "lead",
  outreach_enviado: "qualification",
  respondio_interesado: "qualification",
  diagnostico_web: "solution",
  webcall_discovery: "solution",
  propuesta_preparacion: "solution",
  propuesta_enviada: "commercial",
  negociacion_objeciones: "commercial",
  propuesta_aceptada: "commercial",
  contrato_enviado: "delivery",
  contrato_firmado: "delivery",
  onboarding_kickoff: "delivery",
  cliente_activo: "active",
};

export function stageGroupFor(stage: string): string {
  return STAGE_TO_GROUP[stage] ?? "lead";
}

const STAGE_TO_AUTO_STATUS: Record<string, string> = {
  contrato_firmado: "won",
  cliente_activo: "active_customer",
};

export function autoStatusForStage(stage: string): string | null {
  return STAGE_TO_AUTO_STATUS[stage] ?? null;
}

export function labelOf(options: readonly Option[], value: string | null): string {
  if (value == null) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function formatMXN(value: number | null): string {
  return value == null ? "—" : mxnFormatter.format(value);
}
