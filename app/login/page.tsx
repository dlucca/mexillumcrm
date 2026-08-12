"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">Mexillum CRM</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-sm">Correo</span>
          <input name="email" type="email" required className="rounded-md border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-sm">Contraseña</span>
          <input name="password" type="password" required className="rounded-md border px-3 py-2" />
        </label>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
