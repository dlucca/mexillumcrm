"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";

type NavItem = { href: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="size-4 shrink-0 opacity-85" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
        <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: (
      <svg className="size-4 shrink-0 opacity-85" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2 3h4v10H2zM6 3h4v6H6zM10 3h4v8h-4z" />
      </svg>
    ),
  },
  {
    href: "/companies",
    label: "Empresas",
    icon: (
      <svg className="size-4 shrink-0 opacity-85" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2 13V6l6-4 6 4v7M6 13V9h4v4" />
      </svg>
    ),
  },
  {
    href: "/projects",
    label: "Proyectos",
    icon: (
      <svg className="size-4 shrink-0 opacity-85" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="5" r="2.5" />
        <path d="M3 13.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" />
      </svg>
    ),
  },
  {
    href: "/my-actions",
    label: "Siguientes acciones",
    icon: (
      <svg className="size-4 shrink-0 opacity-85" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M8 4v4l2.5 1.5" />
        <circle cx="8" cy="8" r="6.5" />
      </svg>
    ),
  },
];

function initialsFromEmail(email: string | null): string {
  if (!email) return "MX";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const two = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return two.toUpperCase() || "MX";
}

export function AppShell({
  user,
  children,
}: {
  user: { email: string | null } | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  if (pathname === "/login") return <>{children}</>;

  const email = user?.email ?? null;
  const name = email ? email.split("@")[0] : "Invitado";

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[248px_1fr]">
      <aside className="flex flex-col bg-[var(--nav-bg)] text-[var(--nav-ink)] md:sticky md:top-0 md:h-screen">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <span className="relative size-[30px] shrink-0 rounded-lg bg-solar">
            <span
              className="absolute inset-[8px] rounded-[3px] bg-[var(--nav-bg)]"
              style={{ clipPath: "polygon(0 100%, 55% 0, 55% 55%, 100% 55%, 100% 100%)" }}
            />
          </span>
          <span className="font-display text-[1.35rem] font-bold leading-none tracking-display">
            Mexillum
            <small className="mt-0.5 block font-display text-[0.5rem] font-semibold tracking-[0.24em] text-[var(--nav-muted)]">
              CRM · SOLAR + BESS
            </small>
          </span>
        </div>

        {/* Nav */}
        <div className="eyebrow px-5 pb-2 pt-2 text-[var(--nav-muted)]">Operación</div>
        <nav className="flex flex-col">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 border-l-[2.5px] px-5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-l-solar bg-[var(--nav-surface)] text-[var(--nav-ink)]"
                    : "border-l-transparent text-[var(--nav-muted)] hover:text-[var(--nav-ink)]"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="mt-auto px-5">
          <div className="eyebrow pb-2 pt-4 text-[var(--nav-muted)]">Cuenta</div>
          <div className="flex items-center gap-2.5 border-t border-[var(--nav-line)] pt-3.5">
            <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-solar-wash font-display text-sm font-bold text-solar-ink">
              {initialsFromEmail(email)}
            </span>
            <div className="min-w-0 leading-tight">
              <b className="block truncate text-[0.82rem] font-semibold capitalize">{name}</b>
              <span className="block truncate text-[0.68rem] text-[var(--nav-muted)]">
                {email ?? "Sin sesión"}
              </span>
            </div>
          </div>
          <form action={signOut} className="pb-5 pt-2">
            <button
              type="submit"
              className="text-[0.72rem] font-medium text-[var(--nav-muted)] transition-colors hover:text-[var(--nav-ink)]"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
