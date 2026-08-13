import Link from "next/link";
import { db } from "@/db/client";
import { listCompanies } from "@/db/companies";
import { listAllProjects } from "@/db/projects";
import { lastActivityByCompany } from "@/db/activities";
import { summarizeCompanyProjects } from "@/lib/companies";
import { formatUSDCompact, formatUSD } from "@/lib/currency";
import { CompaniesTable, type CompanyRow } from "@/components/companies/companies-table";
import { NewCompanyButton } from "@/components/companies/new-company-button";

export const dynamic = "force-dynamic";

function Total({ k, v, title }: { k: string; v: string; title?: string }) {
  return (
    <div>
      <div className="col-label text-[0.58rem] text-muted">{k}</div>
      <div className="mt-px font-mono text-[1.15rem] font-medium tabular-nums" title={title}>
        {v}
      </div>
    </div>
  );
}

const field =
  "rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[0.8rem] text-ink outline-none focus:border-solar focus:ring-2 focus:ring-solar/25";

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const archived = first(sp.archived) === "1";
  const q = first(sp.q)?.trim() ?? "";
  const sort = first(sp.sort) ?? "value";
  const active = first(sp.active) === "1";

  const companies = await listCompanies(db, { archived });
  const projects = await listAllProjects(db, { archived: false });
  const lastAct = await lastActivityByCompany(db);

  const byCompany = new Map<string, typeof projects>();
  for (const p of projects) {
    const arr = byCompany.get(p.companyId) ?? [];
    arr.push(p);
    byCompany.set(p.companyId, arr);
  }

  const allRows: CompanyRow[] = companies.map((c) => ({
    company: c,
    summary: summarizeCompanyProjects(byCompany.get(c.id) ?? []),
    lastActivityAt: lastAct.get(c.id) ?? null,
  }));

  const totalValue = allRows.reduce((s, r) => s + r.summary.totalValue, 0);
  const withProject = allRows.filter((r) => r.summary.count > 0).length;

  let rows = allRows;
  if (q) {
    const needle = norm(q);
    rows = rows.filter((r) =>
      [r.company.name, r.company.industry ?? "", r.company.headquartersLocation ?? ""].some((h) =>
        norm(h).includes(needle)
      )
    );
  }
  if (active) rows = rows.filter((r) => r.summary.count > 0);
  rows = [...rows].sort((a, b) => {
    if (sort === "name") return a.company.name.localeCompare(b.company.name, "es");
    if (sort === "activity") {
      const av = a.lastActivityAt?.getTime() ?? 0;
      const bv = b.lastActivityAt?.getTime() ?? 0;
      return bv - av;
    }
    return b.summary.totalValue - a.summary.totalValue;
  });

  return (
    <main className="flex min-w-0 flex-col">
      {/* Topbar */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 md:px-8">
        <div>
          <div className="eyebrow text-solar-ink">Directorio comercial</div>
          <h1 className="mt-0.5 font-display text-[2.05rem] font-bold leading-none tracking-display">
            Empresas
          </h1>
        </div>
        <div className="flex items-end gap-6">
          <Total k="Empresas" v={String(companies.length)} />
          <Total k="Con proyecto" v={String(withProject)} />
          <Total k="Valor total" v={formatUSDCompact(totalValue)} title={formatUSD(totalValue)} />
          <NewCompanyButton />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-2.5 md:px-8">
        <form method="get" action="/companies" className="flex flex-wrap items-center gap-2">
          {archived ? <input type="hidden" name="archived" value="1" /> : null}
          {active ? <input type="hidden" name="active" value="1" /> : null}
          <input type="text" name="q" defaultValue={q} placeholder="Buscar empresa, sector, sede…" className={`${field} min-w-[14rem]`} />
          <label className="inline-flex items-center gap-1.5 text-[0.72rem] text-muted">
            Orden
            <select name="sort" defaultValue={sort} aria-label="Orden" className={field}>
              <option value="value">Valor ↓</option>
              <option value="name">Nombre A–Z</option>
              <option value="activity">Últ. actividad</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-solar px-3 py-2 text-[0.8rem] font-semibold text-on-solar transition-colors hover:bg-solar-strong">
            Filtrar
          </button>
        </form>
        <Link
          href={active ? "/companies" : "/companies?active=1"}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[0.78rem] font-semibold transition-colors ${
            active ? "border-solar bg-solar-wash text-solar-ink" : "border-line-strong text-muted hover:text-ink"
          }`}
        >
          Con proyecto
        </Link>
        <div className="ml-auto flex gap-4 text-sm">
          <Link href="/companies" className={archived ? "text-muted hover:text-ink" : "font-semibold"}>
            Activas
          </Link>
          <Link href="/companies?archived=1" className={archived ? "font-semibold" : "text-muted hover:text-ink"}>
            Archivadas
          </Link>
        </div>
      </div>

      <div className="px-5 py-4 md:px-8">
        <CompaniesTable rows={rows} archived={archived} />
      </div>
    </main>
  );
}
