import Link from "next/link";
import { STAGES, STAGE_GROUPS, SOLUTION_TYPES, STATUSES } from "@/lib/project-pipeline";
import type { PipelineFilters } from "@/lib/pipeline-filters";
import type { Option } from "@/lib/project-pipeline";

const fieldClass = "rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink";
const labelClass = "flex flex-col gap-1 text-xs text-muted";

function EnumSelect({
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
    <label className={labelClass}>
      {label}
      <select name={name} defaultValue={value ?? ""} className={fieldClass}>
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PipelineFilterBar({ filters }: { filters: PipelineFilters }) {
  return (
    <form
      method="get"
      action="/pipeline"
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface-2 p-3"
    >
      <label className={labelClass}>
        Búsqueda
        <input
          type="text"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Proyecto, empresa o planta"
          className={fieldClass}
        />
      </label>
      <EnumSelect name="group" label="Grupo" options={STAGE_GROUPS} value={filters.group} />
      <EnumSelect name="stage" label="Etapa" options={STAGES} value={filters.stage} />
      <EnumSelect name="solution" label="Solución" options={SOLUTION_TYPES} value={filters.solution} />
      <EnumSelect name="status" label="Estado" options={STATUSES} value={filters.status} />
      <label className={labelClass}>
        Valor mín (MXN)
        <input type="number" name="valueMin" defaultValue={filters.valueMin ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Valor máx (MXN)
        <input type="number" name="valueMax" defaultValue={filters.valueMax ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Cierre desde
        <input type="date" name="closeFrom" defaultValue={filters.closeFrom ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Cierre hasta
        <input type="date" name="closeTo" defaultValue={filters.closeTo ?? ""} className={fieldClass} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-solar px-3 py-1 text-sm font-medium text-on-solar">
          Filtrar
        </button>
        <Link href="/pipeline" className="rounded-md border border-line px-3 py-1 text-sm text-ink">
          Limpiar
        </Link>
      </div>
    </form>
  );
}
