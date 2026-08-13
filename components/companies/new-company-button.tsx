"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCompanyAction } from "@/app/companies/actions";
import type { ActionResult } from "@/lib/company-mutations";

export function NewCompanyButton() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createCompanyAction,
    null
  );
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok && detailsRef.current) {
      detailsRef.current.open = false;
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [state]);

  return (
    <details ref={detailsRef} className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-solar px-3.5 py-2.5 text-sm font-semibold text-on-solar transition-colors hover:bg-solar-strong marker:hidden">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 2v10M2 7h10" />
        </svg>
        Nueva empresa
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-[0_8px_28px_oklch(0.3_0.02_60/0.14)]">
        <form action={formAction} className="flex flex-col gap-2">
          <label className="col-label text-[0.68rem] text-muted">Nombre de la empresa</label>
          <input
            ref={inputRef}
            name="name"
            required
            autoFocus
            placeholder="Grupo Alcázar"
            className="rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-solar focus:ring-2 focus:ring-solar/25"
          />
          {state && !state.ok ? (
            <p className="text-[0.78rem] text-danger-ink">{state.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-0.5 rounded-lg bg-solar px-3 py-2 text-[0.82rem] font-semibold text-on-solar transition-colors hover:bg-solar-strong disabled:opacity-50"
          >
            {pending ? "Creando…" : "Crear empresa"}
          </button>
        </form>
      </div>
    </details>
  );
}
