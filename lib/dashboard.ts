import { STAGES, stageGroupFor } from "@/lib/project-pipeline";
import { projectsMissingNextAction, bucketTasksByDueDate } from "@/lib/my-actions";

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

// Rampa Sol→Almacenamiento por grupo. Los var(--pipe-N) se definen en app/globals.css (Task 3).
export const GROUP_COLORS: Record<string, string> = {
  lead: "var(--pipe-1)",
  qualification: "var(--pipe-2)",
  solution: "var(--pipe-3)",
  commercial: "var(--pipe-4)",
  delivery: "var(--pipe-5)",
  active: "var(--pipe-6)",
};
