import { STAGES, labelOf, stageGroupFor, type Option } from "@/lib/project-pipeline";

export const ACTIVITY_TYPES = [
  { value: "email", label: "Email" },
  { value: "call", label: "Llamada" },
  { value: "meeting", label: "Reunión" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "note", label: "Nota" },
  { value: "task", label: "Tarea" },
  { value: "diagnostic", label: "Diagnóstico" },
  { value: "document", label: "Documento" },
  { value: "stage_change", label: "Cambio de etapa" },
  { value: "proposal", label: "Propuesta" },
  { value: "contract", label: "Contrato" },
  { value: "system", label: "Sistema" },
] satisfies Option[];
export const ACTIVITY_TYPE_VALUES = ACTIVITY_TYPES.map((t) => t.value);

export const ACTIVITY_DIRECTIONS = [
  { value: "inbound", label: "Entrante" },
  { value: "outbound", label: "Saliente" },
  { value: "internal", label: "Interno" },
  { value: "none", label: "N/A" },
] satisfies Option[];
export const ACTIVITY_DIRECTION_VALUES = ACTIVITY_DIRECTIONS.map((d) => d.value);

export const ACTIVITY_SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "diagnostic_engine", label: "Diagnóstico web" },
  { value: "gmail", label: "Gmail" },
  { value: "calendar", label: "Calendario" },
  { value: "system", label: "Sistema" },
] satisfies Option[];
export const ACTIVITY_SOURCE_VALUES = ACTIVITY_SOURCES.map((s) => s.value);

export type StageChangeMetadata = {
  fromStage: string;
  toStage: string;
  fromGroup: string;
  toGroup: string;
};

export function stageChangeMetadata(fromStage: string, toStage: string): StageChangeMetadata {
  return {
    fromStage,
    toStage,
    fromGroup: stageGroupFor(fromStage),
    toGroup: stageGroupFor(toStage),
  };
}

export function describeStageChange(metadata: StageChangeMetadata): string {
  return `${labelOf(STAGES, metadata.fromStage)} → ${labelOf(STAGES, metadata.toStage)}`;
}

export function activityTypeLabel(type: string): string {
  return labelOf(ACTIVITY_TYPES, type);
}

export function activityHeadline(activity: {
  type: string;
  body: string | null;
  metadata: unknown;
}): string {
  if (activity.type === "stage_change" && activity.metadata) {
    return describeStageChange(activity.metadata as StageChangeMetadata);
  }
  if (activity.type === "system") return "Proyecto creado";
  if (activity.type === "note") return activity.body ?? "";
  return activityTypeLabel(activity.type);
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(date: Date | string): string {
  return dateTimeFormatter.format(typeof date === "string" ? new Date(date) : date);
}
