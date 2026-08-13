import Link from "next/link";
import type { Company } from "@/db/schema";
import type { CompanyStatus } from "@/lib/companies";
import { formatUSD, MXN_PER_USD } from "@/lib/currency";
import { formatMXN } from "@/lib/project-pipeline";
import { GROUP_DOT } from "@/lib/dashboard-display";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const two = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return two.toUpperCase() || "—";
}

function statusStyle(key: string): { className: string; style?: React.CSSProperties } {
  if (key === "active") return { className: "badge-success" };
  if (key === "none" || key === "closed") return { className: "badge-neutral" };
  return {
    className: "badge",
    style: { background: `color-mix(in oklch, ${GROUP_DOT[key]} 14%, var(--surface))`, color: GROUP_DOT[key] },
  };
}

function Figure({ k, children, sub }: { k: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="col-label text-[0.58rem] text-muted">{k}</div>
      <div className="mt-0.5 font-mono text-[1.3rem] font-medium tabular-nums leading-none">{children}</div>
      {sub ? <div className="mt-1 font-mono text-[0.66rem] text-faint">{sub}</div> : null}
    </div>
  );
}

export function CompanyDetailHeader({
  company,
  status,
  totalValue,
  count,
  projectsSub,
  contactCount,
  lastActivityAt,
  actions,
}: {
  company: Company;
  status: CompanyStatus;
  totalValue: number;
  count: number;
  projectsSub: string;
  contactCount: number;
  lastActivityAt: string | null;
  actions?: React.ReactNode;
}) {
  const sub = [company.industry, company.headquartersLocation].filter(Boolean).join(" · ");
  const st = statusStyle(status.key);
  return (
    <div className="border-b border-line px-5 pb-4 pt-5 md:px-8">
      <div className="mb-2 text-[0.76rem] text-muted">
        <Link href="/companies" className="hover:underline">
          Empresas
        </Link>{" "}
        › {company.name}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_oklch,var(--sol-both)_15%,var(--surface))] font-display text-2xl font-bold text-[var(--sol-both)]">
            {initials(company.name)}
          </span>
          <div>
            <h1 className="font-display text-[2rem] font-bold leading-none tracking-display">{company.name}</h1>
            {sub ? <div className="mt-1 text-[0.86rem] text-muted">{sub}</div> : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={st.className} style={st.style}>
                {status.label}
              </span>
              <span className="badge badge-neutral">
                {count} {count === 1 ? "proyecto" : "proyectos"}
              </span>
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
        <Figure k="Valor total" sub={`${formatMXN(totalValue)} · TC ${MXN_PER_USD.toFixed(2)}`}>
          {formatUSD(totalValue)} <span className="text-[0.8rem] text-muted">USD</span>
        </Figure>
        <Figure k="Proyectos" sub={projectsSub || undefined}>
          {count}
        </Figure>
        <Figure k="Contactos">{contactCount}</Figure>
        <Figure k="Últ. actividad">
          <span className="text-[1.05rem]">{lastActivityAt ?? "—"}</span>
        </Figure>
      </div>
    </div>
  );
}
