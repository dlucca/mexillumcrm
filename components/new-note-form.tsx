"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createNoteAction } from "@/app/projects/actions";
import type { ActionResult } from "@/lib/company-mutations";

export function NewNoteForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createNoteAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="mt-4 grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Nueva nota</span>
        <textarea
          name="body"
          rows={3}
          required
          className="rounded-md border px-3 py-2"
          placeholder="Registrá una nota…"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Agregar nota"}
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
