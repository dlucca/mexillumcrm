import { STAGES, SOLUTION_TYPES, stageGroupFor } from "@/lib/project-pipeline";
import { projectsMissingNextAction, bucketTasksByDueDate, addDays } from "@/lib/my-actions";

export type StageBucket = {
  stage: string;
  label: string;
  group: string;
  count: number;
  totalValue: number;
};

export function pipelineByStage<P extends { stage: string; estimatedValue: number | null }>(
  projects: P[]
): StageBucket[] {
  return STAGES.map((s) => {
    const inStage = projects.filter((p) => p.stage === s.value);
    return {
      stage: s.value,
      label: s.label,
      group: stageGroupFor(s.value),
      count: inStage.length,
      totalValue: inStage.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0),
    };
  });
}

export type DashboardTotals = {
  openCount: number;
  openValue: number;
  missingNextAction: number;
  overdueTasks: number;
};

export function dashboardTotals(
  projects: { id: string; status: string; estimatedValue: number | null }[],
  openTasks: { projectId: string; dueDate: string }[],
  today: string
): DashboardTotals {
  const open = projects.filter((p) => p.status === "open");
  return {
    openCount: open.length,
    openValue: open.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0),
    missingNextAction: projectsMissingNextAction(projects, openTasks).length,
    overdueTasks: bucketTasksByDueDate(openTasks, today).overdue.length,
  };
}

// ── Mezcla de solución (por valor) ─────────────────────────────
export type SolutionMixRow = {
  type: string;
  label: string;
  value: number;
  count: number;
  share: number; // fracción 0..1 sobre el valor total
};

export function solutionMix<P extends { solutionType: string; estimatedValue: number | null }>(
  projects: P[]
): SolutionMixRow[] {
  const total = projects.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0);
  return SOLUTION_TYPES.map((s) => {
    const inType = projects.filter((p) => p.solutionType === s.value);
    const value = inType.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0);
    return {
      type: s.value,
      label: s.label,
      value,
      count: inType.length,
      share: total > 0 ? value / total : 0,
    };
  });
}

// ── Conversión: won / (won + lost) ─────────────────────────────
export type ConversionRate = { won: number; lost: number; rate: number | null };

const WON_STATUSES = new Set(["won", "active_customer"]);

export function conversionRate(projects: { status: string }[]): ConversionRate {
  let won = 0;
  let lost = 0;
  for (const p of projects) {
    if (WON_STATUSES.has(p.status)) won++;
    else if (p.status === "lost") lost++;
  }
  const closed = won + lost;
  return { won, lost, rate: closed > 0 ? won / closed : null };
}

// ── Valor ponderado por probabilidad ───────────────────────────
// Σ(valor × probabilidad/100). valor o probabilidad null aportan 0.
export function weightedPipelineValue(
  projects: { estimatedValue: number | null; probability: number | null }[]
): number {
  return projects.reduce(
    (sum, p) => sum + (p.estimatedValue ?? 0) * ((p.probability ?? 0) / 100),
    0
  );
}

// ── Salud del pipeline (solo proyectos open) ───────────────────
// atRisk: tiene task vencida.  momentum: última actividad dentro de la ventana.
// stale: resto (inactivo hace >staleDays o sin actividad).
export type PipelineHealth = { momentum: number; stale: number; atRisk: number; total: number };

export function pipelineHealth(
  projects: { id: string; status: string }[],
  lastActivity: Map<string, string>,
  openTasks: { projectId: string; dueDate: string }[],
  today: string,
  staleDays = 7
): PipelineHealth {
  const overdueBy = new Set(
    openTasks.filter((t) => t.dueDate < today).map((t) => t.projectId)
  );
  const threshold = addDays(today, -staleDays);
  const open = projects.filter((p) => p.status === "open");
  let momentum = 0;
  let stale = 0;
  let atRisk = 0;
  for (const p of open) {
    if (overdueBy.has(p.id)) atRisk++;
    else {
      const last = lastActivity.get(p.id);
      if (last && last >= threshold) momentum++;
      else stale++;
    }
  }
  return { momentum, stale, atRisk, total: open.length };
}

// Rampa Sol→Almacenamiento por grupo. Los var(--pipe-N) se definen en app/globals.css (Task 3).
export const GROUP_COLORS: Record<string, string> = {
  lead: "var(--pipe-1)",
  qualification: "var(--pipe-2)",
  solution: "var(--pipe-3)",
  commercial: "var(--pipe-4)",
  delivery: "var(--pipe-5)",
  active: "var(--pipe-6)",
};
