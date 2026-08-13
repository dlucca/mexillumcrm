import Link from "next/link";
import { STAGE_GROUPS, SOLUTION_TYPES, STATUSES } from "@/lib/project-pipeline";
import type { Option } from "@/lib/project-pipeline";
import type { PipelineFilters } from "@/lib/pipeline-filters";
import { PROJECT_SORTS } from "@/lib/project-sort";

const field =
  "rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[0.8rem] text-ink outline-none focus:border-solar focus:ring-2 focus:ring-solar/25";

function Select({
  name,
  label,
  options,
  value,
}: {
  name: string;
  label: string;
  options: readonly Option[];
  value: string | null;
}) {
  return (
    <select name={name} defaultValue={value ?? ""} aria-label={label} className={field}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type State = {
  filters: PipelineFilters;
  sort: string;
  na: boolean;
  archived: boolean;
};

function href(base: string, params: Record<string, string | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") p.set(k, String(v));
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

export function ProjectsToolbar({ filters, sort, na, archived }: State) {
  // Filtros vigentes como querystring, para arrastrarlos entre vistas.
  const filterParams: Record<string, string | null> = {
    q: filters.q,
    group: filters.group,
    solution: filters.solution,
    status: filters.status,
  };
  const segBase = "inline-flex items-center gap-1.5 px-3 py-2 text-[0.8rem] font-semibold transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-2.5 md:px-8">
      {/* Toggle Tabla / Kanban */}
      <div className="inline-flex overflow-hidden rounded-lg border border-line-strong">
        <span className={`${segBase} bg-ink text-background`}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 4h12M2 8h12M2 12h12" />
          </svg>
          Tabla
        </span>
        <Link href={href("/pipeline", filterParams)} className={`${segBase} text-muted hover:text-ink`}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="4" height="14" rx="1" />
            <rect x="6" y="1" width="4" height="9" rx="1" />
            <rect x="11" y="1" width="4" height="11" rx="1" />
          </svg>
          Kanban
        </Link>
      </div>

      {/* Filtros (GET) */}
      <form method="get" action="/projects" className="flex flex-wrap items-center gap-2">
        {archived ? <input type="hidden" name="archived" value="1" /> : null}
        {na ? <input type="hidden" name="na" value="1" /> : null}
        <input
          type="text"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Buscar proyecto, planta…"
          className={`${field} min-w-[12rem]`}
        />
        <Select name="group" label="Grupo" options={STAGE_GROUPS} value={filters.group} />
        <Select name="solution" label="Solución" options={SOLUTION_TYPES} value={filters.solution} />
        <Select name="status" label="Estado" options={STATUSES} value={filters.status} />
        <label className="inline-flex items-center gap-1.5 text-[0.72rem] text-muted">
          Orden
          <select name="sort" defaultValue={sort} aria-label="Orden" className={field}>
            {PROJECT_SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-solar px-3 py-2 text-[0.8rem] font-semibold text-on-solar transition-colors hover:bg-solar-strong"
        >
          Filtrar
        </button>
      </form>

      {/* Chip: sin siguiente acción (toggle) */}
      <Link
        href={
          na
            ? href("/projects", { ...filterParams, sort, archived: archived ? "1" : null })
            : href("/projects", { ...filterParams, sort, na: "1", archived: archived ? "1" : null })
        }
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[0.78rem] font-semibold transition-colors ${
          na
            ? "border-[color-mix(in_oklch,var(--danger)_40%,var(--line))] bg-danger-wash text-danger-ink"
            : "border-line-strong text-muted hover:text-ink"
        }`}
      >
        ⚠ Sin siguiente acción
      </Link>

      <Link
        href={href("/projects", { archived: archived ? "1" : null })}
        className="px-1.5 text-[0.78rem] font-semibold text-storage-ink hover:underline"
      >
        Limpiar
      </Link>
    </div>
  );
}
