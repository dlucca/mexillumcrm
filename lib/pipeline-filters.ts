import {
  STAGE_VALUES,
  STATUS_VALUES,
  SOLUTION_TYPE_VALUES,
  STAGE_GROUPS,
} from "@/lib/project-pipeline";

const GROUP_VALUES = STAGE_GROUPS.map((g) => g.value);

export type PipelineFilters = {
  stage: string | null;
  group: string | null;
  solution: string | null;
  status: string | null;
  valueMin: number | null;
  valueMax: number | null;
  closeFrom: string | null;
  closeTo: string | null;
  q: string | null;
};

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function enumOrNull(v: SP[string], allowed: readonly string[]): string | null {
  const s = first(v);
  return s != null && allowed.includes(s) ? s : null;
}

function intOrNull(v: SP[string]): number | null {
  const s = first(v);
  if (s == null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

function dateOrNull(v: SP[string]): string | null {
  const s = first(v);
  return s != null && s.trim() !== "" ? s : null;
}

function textOrNull(v: SP[string]): string | null {
  const s = first(v)?.trim();
  return s ? s : null;
}

export function parsePipelineFilters(sp: SP): PipelineFilters {
  return {
    stage: enumOrNull(sp.stage, STAGE_VALUES),
    group: enumOrNull(sp.group, GROUP_VALUES),
    solution: enumOrNull(sp.solution, SOLUTION_TYPE_VALUES),
    status: enumOrNull(sp.status, STATUS_VALUES),
    valueMin: intOrNull(sp.valueMin),
    valueMax: intOrNull(sp.valueMax),
    closeFrom: dateOrNull(sp.closeFrom),
    closeTo: dateOrNull(sp.closeTo),
    q: textOrNull(sp.q),
  };
}

export function hasActiveFilters(f: PipelineFilters): boolean {
  return Object.values(f).some((v) => v !== null);
}

export type FilterableProject = {
  stage: string;
  stageGroup: string;
  solutionType: string;
  status: string;
  estimatedValue: number | null;
  expectedCloseDate: string | null;
  name: string;
  companyName: string;
  plantName: string | null;
};

function normalizeText(s: string): string {
  // \u0300-\u036f = bloque de marcas diacríticas combinantes (quita acentos tras NFD)
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function matchesFilters(p: FilterableProject, f: PipelineFilters): boolean {
  if (f.stage && p.stage !== f.stage) return false;
  if (f.group && p.stageGroup !== f.group) return false;
  if (f.solution && p.solutionType !== f.solution) return false;
  if (f.status && p.status !== f.status) return false;

  if (f.valueMin != null || f.valueMax != null) {
    if (p.estimatedValue == null) return false;
    if (f.valueMin != null && p.estimatedValue < f.valueMin) return false;
    if (f.valueMax != null && p.estimatedValue > f.valueMax) return false;
  }

  if (f.closeFrom != null || f.closeTo != null) {
    if (p.expectedCloseDate == null) return false;
    if (f.closeFrom != null && p.expectedCloseDate < f.closeFrom) return false;
    if (f.closeTo != null && p.expectedCloseDate > f.closeTo) return false;
  }

  if (f.q) {
    const needle = normalizeText(f.q);
    const hay = [p.name, p.companyName, p.plantName ?? ""].map(normalizeText);
    if (!hay.some((h) => h.includes(needle))) return false;
  }

  return true;
}

export function filterProjects<P extends FilterableProject>(
  projects: P[],
  f: PipelineFilters
): P[] {
  return projects.filter((p) => matchesFilters(p, f));
}