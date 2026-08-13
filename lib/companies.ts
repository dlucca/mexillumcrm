import { STAGE_GROUPS, SOLUTION_TYPES, labelOf } from "@/lib/project-pipeline";
import { stageIndex } from "@/lib/dashboard-display";

type CompanyProject = {
  stageGroup: string;
  stage: string;
  solutionType: string;
  estimatedValue: number | null;
  status: string;
};

export type CompanyStatus = { key: string; label: string };

export type CompanySummary = {
  count: number;
  totalValue: number;
  groups: string[]; // stage_groups únicos presentes, en orden canónico
  solutions: string[]; // solution_types únicos (sin unknown), en orden canónico
  status: CompanyStatus;
};

// Estado derivado de la empresa a partir de sus proyectos:
// cliente activo domina; si no, el grupo de la etapa abierta más avanzada;
// si no hay abiertos ni activos, "closed"; sin proyectos, "none".
function deriveStatus(projects: CompanyProject[]): CompanyStatus {
  if (projects.length === 0) return { key: "none", label: "Sin proyectos" };
  if (projects.some((p) => p.status === "active_customer")) {
    return { key: "active", label: "Cliente activo" };
  }
  const open = projects.filter((p) => p.status === "open");
  if (open.length === 0) return { key: "closed", label: "Cerrado" };
  const hottest = open.reduce((a, b) => (stageIndex(b.stage) > stageIndex(a.stage) ? b : a));
  return { key: hottest.stageGroup, label: labelOf(STAGE_GROUPS, hottest.stageGroup) };
}

export function summarizeCompanyProjects(projects: CompanyProject[]): CompanySummary {
  const totalValue = projects.reduce((s, p) => s + (p.estimatedValue ?? 0), 0);
  const groupSet = new Set(projects.map((p) => p.stageGroup));
  const solSet = new Set(projects.map((p) => p.solutionType));
  return {
    count: projects.length,
    totalValue,
    groups: STAGE_GROUPS.map((g) => g.value).filter((g) => groupSet.has(g)),
    solutions: SOLUTION_TYPES.map((s) => s.value).filter((s) => s !== "unknown" && solSet.has(s)),
    status: deriveStatus(projects),
  };
}
