"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateContactAction } from "@/app/companies/[id]/contacts/actions";
import type { ActionResult } from "@/lib/company-mutations";
import type { Contact } from "@/db/schema";

export function ContactEditForm({
  contact,
  onDone,
}: {
  contact: Contact;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateContactAction,
    null
  );
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (state?.ok && !handled.current) {
      handled.current = true;
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  return (
    <form action={formAction} className="grid gap-3 py-2 sm:grid-cols-2">
      <input type="hidden" name="id" value={contact.id} />
      <input type="hidden" name="companyId" value={contact.companyId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Nombre</span>
        <input
          name="name"
          required
          defaultValue={contact.name}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Email</span>
        <input
          name="email"
          defaultValue={contact.email ?? ""}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Teléfono</span>
        <input
          name="phone"
          defaultValue={contact.phone ?? ""}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Puesto</span>
        <input
          name="role"
          defaultValue={contact.role ?? ""}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-medium text-sm">Notas</span>
        <textarea
          name="notes"
          defaultValue={contact.notes ?? ""}
          rows={2}
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
        <button
          type="button"
          onClick={onDone}
          className="text-sm underline"
        >
          Cancelar
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
