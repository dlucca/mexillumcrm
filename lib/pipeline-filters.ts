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
