"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction } from "@/app/projects/actions";
import type { ActionResult } from "@/lib/company-mutations";

export function NewTaskForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createTaskAction,
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
    <form ref={formRef} action={formAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <input type="hidden" name="projectId" value={projectId} />
      <input
        name="title"
        required
        placeholder="Nueva tarea…"
        className="rounded-md border px-3 py-2"
      />
      <input name="dueDate" type="date" required className="rounded-md border px-3 py-2" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Agregar tarea"}
      </button>
      {state && !state.ok && <p className="text-sm text-red-600 sm:col-span-3">{state.error}</p>}
    </form>
  );
}
