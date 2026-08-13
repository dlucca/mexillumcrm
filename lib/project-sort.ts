import { stageIndex } from "@/lib/dashboard-display";
import type { Option } from "@/lib/project-pipeline";

export const PROJECT_SORTS = [
  { value: "value", label: "Valor ↓" },
  { value: "value_asc", label: "Valor ↑" },
  { value: "potential", label: "Potencial ↓" },
  { value: "stage", label: "Etapa ↓" },
  { value: "name", label: "Nombre A–Z" },
] satisfies Option[];

type Sortable = {
  name: string;
  estimatedValue: number | null;
  probability: number | null;
  stage: string;
};

// Compara números poniendo null siempre al final, según dir asc/desc.
function byNumberNullsLast(a: number | null, b: number | null, dir: "asc" | "desc"): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === "asc" ? a - b : b - a;
}

// Ordena una copia; `sort` desconocido → "value". No muta el arreglo original.
export function sortProjects<P extends Sortable>(projects: P[], sort: string | null): P[] {
  const copy = [...projects];
  switch (sort) {
    case "value_asc":
      return copy.sort((a, b) => byNumberNullsLast(a.estimatedValue, b.estimatedValue, "asc"));
    case "potential":
      return copy.sort((a, b) => byNumberNullsLast(a.probability, b.probability, "desc"));
    case "stage":
      return copy.sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "es"));
    case "value":
    default:
      return copy.sort((a, b) => byNumberNullsLast(a.estimatedValue, b.estimatedValue, "desc"));
  }
}
