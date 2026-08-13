"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-7 flex items-center gap-2.5">
          <span className="relative size-9 shrink-0 rounded-lg bg-solar">
            <span
              className="absolute inset-2.5 rounded-[3px] bg-background"
              style={{ clipPath: "polygon(0 100%, 55% 0, 55% 55%, 100% 55%, 100% 100%)" }}
            />
          </span>
          <span className="font-display text-2xl font-bold leading-none tracking-display">
            Mexillum
            <small className="mt-0.5 block font-display text-[0.5rem] font-semibold tracking-[0.24em] text-muted">
              CRM · SOLAR + BESS
            </small>
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-7 shadow-[0_1px_3px_oklch(0.5_0.02_60/0.06)]">
          <div className="eyebrow text-solar-ink">Acceso interno</div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-display">Inicia sesión</h1>
          <p className="mt-1 text-sm text-muted">Panel comercial y operativo de Mexillum.</p>

          <form action={formAction} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="col-label text-muted">Correo</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                className="rounded-lg border border-line-strong bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-solar focus:ring-2 focus:ring-solar/30"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="col-label text-muted">Contraseña</span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="rounded-lg border border-line-strong bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-solar focus:ring-2 focus:ring-solar/30"
              />
            </label>

            {state?.error ? (
              <p className="rounded-lg bg-danger-wash px-3 py-2 text-sm font-medium text-danger-ink">
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 rounded-lg bg-solar px-4 py-2.5 text-sm font-semibold text-on-solar transition-colors hover:bg-solar-strong disabled:opacity-50"
            >
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
