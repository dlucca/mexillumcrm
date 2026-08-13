import { STAGES, stageGroupFor } from "@/lib/project-pipeline";

// Punto del grupo en el kanban — temperatura del deal (ver docs/color-spec).
export const GROUP_DOT: Record<string, string> = {
  lead: "var(--group-lead)",
  qualification: "var(--group-qual)",
  solution: "var(--group-solution)",
  commercial: "var(--group-commercial)",
  delivery: "var(--group-delivery)",
  active: "var(--group-active)",
};

// Badge de solution_type: label + clase de globals.css.
export const SOLUTION_BADGE: Record<string, { label: string; className: string }> = {
  solar: { label: "Solar", className: "badge-solar" },
  bess: { label: "BESS", className: "badge-storage" },
  solar_bess: { label: "Solar + BESS", className: "badge-both" },
  unknown: { label: "Sin definir", className: "badge-neutral" },
};

// Color sólido por solución para barras/leyendas (mezcla de solución).
export const SOLUTION_COLOR: Record<string, string> = {
  solar: "var(--solar)",
  bess: "var(--storage)",
  solar_bess: "var(--sol-both)",
  unknown: "var(--faint)",
};

export const STAGE_COUNT = STAGES.length;

// Posición 1-based de la etapa en el flujo de 13; 0 si no existe.
export function stageIndex(stage: string): number {
  const i = STAGES.findIndex((s) => s.value === stage);
  return i < 0 ? 0 : i + 1;
}

// Banda de potencial (heatmap secuencial cálido) a partir de un score 0–100.
export type PotBand = "bajo" | "medio" | "alto" | "muyalto";

export const POT_COLOR: Record<string, string> = {
  bajo: "var(--pot-bajo)",
  medio: "var(--pot-medio)",
  alto: "var(--pot-alto)",
  muyalto: "var(--pot-muyalto)",
};

export function potentialBand(score: number | null): PotBand | null {
  if (score == null) return null;
  if (score < 50) return "bajo";
  if (score < 70) return "medio";
  if (score < 85) return "alto";
  return "muyalto";
}

// Rango 1-based [min, max] de etapas que pertenecen a un stage_group.
export function groupStageRange(group: string): [number, number] {
  const idxs = STAGES.map((s, i) => (stageGroupFor(s.value) === group ? i + 1 : -1)).filter(
    (i) => i > 0
  );
  if (idxs.length === 0) return [0, 0];
  return [Math.min(...idxs), Math.max(...idxs)];
}
