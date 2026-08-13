"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/my-actions", label: "My Actions" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/projects", label: "Proyectos" },
  { href: "/companies", label: "Empresas" },
];

export function Nav() {
  const pathname = usePathname() ?? "";
  if (pathname === "/login") return null;
  return (
    <nav className="border-b">
      <div className="mx-auto flex max-w-4xl items-center gap-4 px-8 py-3 text-sm">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={active ? "font-semibold" : "text-neutral-500 hover:text-neutral-900"}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
