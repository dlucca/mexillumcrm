"use client";

import { useActionState } from "react";
import { updateCompanyAction } from "@/app/companies/[id]/actions";
import type { ActionResult } from "@/lib/company-mutations";
import type { Company } from "@/db/schema";

type TextField = {
  name: "legalName" | "industry" | "companyType" | "website" | "taxId" | "headquartersLocation" | "sizeSegment" | "notes";
  label: string;
  textarea?: boolean;
};

const FIELDS: TextField[] = [
  { name: "legalName", label: "Razón social" },
  { name: "industry", label: "Industria" },
  { name: "companyType", label: "Tipo de empresa" },
  { name: "website", label: "Sitio web" },
  { name: "taxId", label: "RFC / Tax ID" },
  { name: "headquartersLocation", label: "Ubicación" },
  { name: "sizeSegment", label: "Segmento de tamaño" },
  { name: "notes", label: "Notas", textarea: true },
];

export function CompanyDetailForm({ company }: { company: Company }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateCompanyAction,
    null
  );

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      <input type="hidden" name="id" value={company.id} />
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Nombre</span>
        <input
          name="name"
          required
          defaultValue={company.name}
          className="rounded-md border px-3 py-2"
        />
      </label>
      {FIELDS.map((f) => (
        <label key={f.name} className="flex flex-col gap-1">
          <span className="font-medium text-sm">{f.label}</span>
          {f.textarea ? (
            <textarea
              name={f.name}
              defaultValue={company[f.name] ?? ""}
              rows={3}
              className="rounded-md border px-3 py-2"
            />
          ) : (
            <input
              name={f.name}
              defaultValue={company[f.name] ?? ""}
              className="rounded-md border px-3 py-2"
            />
          )}
        </label>
      ))}
      <div className="flex items-center gap-3">
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
