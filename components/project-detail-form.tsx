"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateProjectAction } from "@/app/projects/actions";
import type { ActionResult } from "@/lib/company-mutations";
import type { Project } from "@/db/schema";
import {
  STAGES,
  STATUSES,
  SOLUTION_TYPES,
  SOURCES,
  LOST_REASONS,
  labelOf,
  STAGE_GROUPS,
  stageGroupFor,
} from "@/lib/project-pipeline";

type Opt = { value: string; label: string };

function Select({
  name,
  label,
  options,
  defaultValue,
  includeBlank,
}: {
  name: string;
  label: string;
  options: readonly Opt[];
  defaultValue: string;
  includeBlank?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium text-sm">{label}</span>
      <select name={name} defaultValue={defaultValue} className="rounded-md border px-3 py-2">
        {includeBlank && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Text({
  name,
  label,
  defaultValue,
  type = "text",
  full,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1${full ? " sm:col-span-2" : ""}`}>
      <span className="font-medium text-sm">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="rounded-md border px-3 py-2"
      />
    </label>
  );
}

export function ProjectDetailForm({ project }: { project: Project }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateProjectAction,
    null
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="mt-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={project.id} />
      <input type="hidden" name="companyId" value={project.companyId} />

      <Text name="name" label="Nombre" defaultValue={project.name} full />

      <Select name="stage" label="Etapa" options={STAGES} defaultValue={project.stage} />
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Grupo (derivado)</span>
        <input
          disabled
          value={labelOf(STAGE_GROUPS, stageGroupFor(project.stage))}
          className="rounded-md border bg-neutral-100 px-3 py-2 text-neutral-500"
        />
      </label>

      <Select name="status" label="Status" options={STATUSES} defaultValue={project.status} />
      <Select
        name="solutionType"
        label="Solución"
        options={SOLUTION_TYPES}
        defaultValue={project.solutionType}
      />

      <Text
        name="estimatedValue"
        label="Valor estimado (MXN)"
        type="number"
        defaultValue={project.estimatedValue?.toString() ?? ""}
      />
      <Text
        name="probability"
        label="Probabilidad (%)"
        type="number"
        defaultValue={project.probability?.toString() ?? ""}
      />
      <Text
        name="expectedCloseDate"
        label="Cierre esperado"
        type="date"
        defaultValue={project.expectedCloseDate ?? ""}
      />
      <Select
        name="source"
        label="Fuente"
        options={SOURCES}
        defaultValue={project.source ?? ""}
        includeBlank
      />

      <Select
        name="lostReason"
        label="Motivo de pérdida"
        options={LOST_REASONS}
        defaultValue={project.lostReason ?? ""}
        includeBlank
      />
      <Text name="lostReasonNote" label="Nota de pérdida" defaultValue={project.lostReasonNote ?? ""} />

      <Text name="plantName" label="Planta" defaultValue={project.plantName ?? ""} />
      <Text name="industrySubsegment" label="Subsegmento" defaultValue={project.industrySubsegment ?? ""} />
      <Text name="locationAddress" label="Dirección" defaultValue={project.locationAddress ?? ""} full />
      <Text name="city" label="Ciudad" defaultValue={project.city ?? ""} />
      <Text name="state" label="Estado" defaultValue={project.state ?? ""} />
      <Text name="country" label="País" defaultValue={project.country ?? ""} />

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-medium text-sm">Notas</span>
        <textarea
          name="notes"
          defaultValue={project.notes ?? ""}
          rows={3}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        {state?.ok && <p className="text-sm text-green-600">Cambios guardados.</p>}
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
