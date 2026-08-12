"use client";

import { useActionState, useEffect, useRef } from "react";
import { createContactAction } from "@/app/companies/[id]/contacts/actions";
import type { ActionResult } from "@/lib/company-mutations";

export function NewContactForm({ companyId }: { companyId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createContactAction,
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
        <span className="font-medium text-sm">Email</span>
        <input name="email" className="rounded-md border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Teléfono</span>
        <input name="phone" className="rounded-md border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Puesto</span>
        <input name="role" className="rounded-md border px-3 py-2" />
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
          {pending ? "Guardando…" : "Agregar contacto"}
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
