import { STAGE_GROUPS } from "@/lib/project-pipeline";

export type PipelineColumn<P> = {
  group: string;
  label: string;
  projects: P[];
  count: number;
  totalValue: number;
};

export function groupProjectsByStageGroup<
  P extends { stageGroup: string; estimatedValue: number | null }
>(projects: P[]): PipelineColumn<P>[] {
  return STAGE_GROUPS.map((g) => {
    const inGroup = projects.filter((p) => p.stageGroup === g.value);
    return {
      group: g.value,
      label: g.label,
      projects: inGroup,
      count: inGroup.length,
      totalValue: inGroup.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0),
    };
  });
}

export function nextActionByProject<T extends { projectId: string }>(
  openTasks: T[]
): Map<string, T> {
  const map = new Map<string, T>();
  for (const t of openTasks) if (!map.has(t.projectId)) map.set(t.projectId, t);
  return map;
}
