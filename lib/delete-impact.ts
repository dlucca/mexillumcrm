import { formatUSDCompact } from "@/lib/currency";

// Conteos de registros que el borrado en cascada arrastra (§ runDeleteCompany /
// runDeleteProject). `pipelineValueMxn` es la suma cruda de estimated_value (MXN),
// que el display convierte a USD compacto. Se difiere "documentos" (sin tabla).
export type ImpactCounts = {
  projects?: number;
  contacts?: number;
  activities?: number;
  tasks?: number;
  pipelineValueMxn?: number | null;
};

export type ImpactKey = "projects" | "contacts" | "activities" | "tasks" | "pipeline";

export type ImpactRow = { key: ImpactKey; value: string; label: string };

// Orden fijo de aparición en la caja de cascada del dialog.
const COUNT_ROWS: {
  key: Exclude<ImpactKey, "pipeline">;
  field: keyof ImpactCounts;
  singular: string;
  plural: string;
}[] = [
  { key: "projects", field: "projects", singular: "proyecto (planta)", plural: "proyectos (plantas)" },
  { key: "contacts", field: "contacts", singular: "contacto", plural: "contactos" },
  { key: "activities", field: "activities", singular: "actividad registrada", plural: "actividades registradas" },
  { key: "tasks", field: "tasks", singular: "tarea", plural: "tareas" },
];

// Arma las filas de impacto omitiendo conteos en 0/undefined; el pipeline solo
// aparece si hay un monto positivo. El componente mapea `key` → icono.
export function buildImpactRows(counts: ImpactCounts): ImpactRow[] {
  const rows: ImpactRow[] = [];
  for (const r of COUNT_ROWS) {
    const n = counts[r.field];
    if (typeof n === "number" && n > 0) {
      rows.push({ key: r.key, value: String(n), label: n === 1 ? r.singular : r.plural });
    }
  }
  const mxn = counts.pipelineValueMxn;
  if (typeof mxn === "number" && mxn > 0) {
    rows.push({ key: "pipeline", value: formatUSDCompact(mxn), label: "en pipeline asociado" });
  }
  return rows;
}

// Gating del type-to-confirm: el texto escrito (sin espacios sobrantes) debe
// coincidir exactamente con el nombre de la entidad. Sensible a mayúsculas.
export function matchesConfirmation(input: string, name: string): boolean {
  return input.trim() === name.trim() && name.trim().length > 0;
}
