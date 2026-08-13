import Link from "next/link";
import { STAGES, STAGE_GROUPS, SOLUTION_TYPES, STATUSES } from "@/lib/project-pipeline";
import type { Option } from "@/lib/project-pipeline";
import type { PipelineFilters } from "@/lib/pipeline-filters";

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

function toHref(filters: PipelineFilters, view: "kanban" | "list"): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v != null) p.set(k, String(v));
  if (view === "list") p.set("view", "list");
  const qs = p.toString();
  return qs ? `/pipeline?${qs}` : "/pipeline";
}

export function PipelineToolbar({
  filters,
  view,
}: {
  filters: PipelineFilters;
  view: "kanban" | "list";
}) {
  const segBase =
    "inline-flex items-center gap-1.5 px-3 py-2 text-[0.8rem] font-semibold transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-2.5 md:px-8">
      {/* Toggle Kanban / Lista */}
      <div className="inline-flex overflow-hidden rounded-lg border border-line-strong">
        <Link
          href={toHref(filters, "kanban")}
          className={`${segBase} ${view === "kanban" ? "bg-ink text-background" : "text-muted hover:text-ink"}`}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="4" height="14" rx="1" />
            <rect x="6" y="1" width="4" height="9" rx="1" />
            <rect x="11" y="1" width="4" height="11" rx="1" />
          </svg>
          Kanban
        </Link>
        <Link
          href={toHref(filters, "list")}
          className={`${segBase} ${view === "list" ? "bg-ink text-background" : "text-muted hover:text-ink"}`}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 4h12M2 8h12M2 12h12" />
          </svg>
          Lista
        </Link>
      </div>

      {/* Filtros (GET) */}
      <form method="get" action="/pipeline" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="view" value={view} />
        <input
          type="text"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Buscar proyecto…"
          className={`${field} min-w-[10rem]`}
        />
        <Select name="group" label="Grupo" options={STAGE_GROUPS} value={filters.group} />
        <Select name="solution" label="Solución" options={SOLUTION_TYPES} value={filters.solution} />
        <Select name="status" label="Estado" options={STATUSES} value={filters.status} />

        <details className="group relative">
          <summary className={`${field} cursor-pointer list-none select-none marker:hidden`}>
            Más ▾
          </summary>
          <div className="absolute z-10 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-line bg-surface p-3 shadow-[0_6px_24px_oklch(0.3_0.02_60/0.12)]">
            <Select name="stage" label="Etapa" options={STAGES} value={filters.stage} />
            <div className="flex gap-2">
              <input type="number" name="valueMin" defaultValue={filters.valueMin ?? ""} placeholder="Valor mín (MXN)" className={`${field} w-full`} />
              <input type="number" name="valueMax" defaultValue={filters.valueMax ?? ""} placeholder="máx" className={`${field} w-24`} />
            </div>
            <div className="flex gap-2">
              <input type="date" name="closeFrom" defaultValue={filters.closeFrom ?? ""} className={`${field} w-full`} />
              <input type="date" name="closeTo" defaultValue={filters.closeTo ?? ""} className={`${field} w-full`} />
            </div>
          </div>
        </details>

        <button
          type="submit"
          className="rounded-lg bg-solar px-3 py-2 text-[0.8rem] font-semibold text-on-solar transition-colors hover:bg-solar-strong"
        >
          Filtrar
        </button>
        <Link
          href={view === "list" ? "/pipeline?view=list" : "/pipeline"}
          className="px-1.5 text-[0.78rem] font-semibold text-storage-ink hover:underline"
        >
          Limpiar
        </Link>
      </form>
    </div>
  );
}
