"use client";

import { useActionState, useEffect, useRef } from "react";
import { createProjectAction } from "@/app/projects/actions";
import type { ActionResult } from "@/lib/company-mutations";
import { STAGES, SOLUTION_TYPES } from "@/lib/project-pipeline";

export function NewProjectForm({ companyId }: { companyId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createProjectAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Nombre</span>
        <input name="name" required className="rounded-md border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Solución</span>
        <select name="solutionType" defaultValue="unknown" className="rounded-md border px-3 py-2">
          {SOLUTION_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Etapa</span>
        <select name="stage" defaultValue="lead_sin_contactar" className="rounded-md border px-3 py-2">
          {STAGES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Valor estimado (MXN)</span>
        <input name="estimatedValue" type="number" min="0" className="rounded-md border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-medium text-sm">Notas</span>
        <textarea name="notes" rows={2} className="rounded-md border px-3 py-2" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Agregar proyecto"}
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
