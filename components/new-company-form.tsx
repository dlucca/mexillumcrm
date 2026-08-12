"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCompanyAction, type ActionResult } from "@/app/companies/actions";

export function NewCompanyForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createCompanyAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-6 flex items-end gap-3">
      <label className="flex flex-1 flex-col gap-1">
        <span className="font-medium text-sm">Nueva empresa</span>
        <input name="name" required className="rounded-md border px-3 py-2" placeholder="Nombre" />
      </label>
      <button type="submit" disabled={pending} className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50">
        {pending ? "Guardando…" : "Agregar"}
      </button>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
