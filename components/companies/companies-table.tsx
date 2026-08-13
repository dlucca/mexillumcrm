import Link from "next/link";
import type { Company } from "@/db/schema";
import type { CompanySummary } from "@/lib/companies";
import { labelOf, STAGE_GROUPS, SOLUTION_TYPES } from "@/lib/project-pipeline";
import { formatUSD, formatMXNCompact } from "@/lib/currency";
import { GROUP_DOT, SOLUTION_BADGE } from "@/lib/dashboard-display";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";
import { buildImpactRows } from "@/lib/delete-impact";
import type { CompanyRelationCounts } from "@/db/delete-counts";
import { deleteCompanyAction } from "@/app/companies/[id]/actions";

const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

// Paleta de logo determinística por nombre (washes de marca).
const LOGO_PALETTE = [
  "bg-solar-wash text-solar-ink",
  "bg-storage-wash text-storage-ink",
  "bg-success-wash text-success-ink",
  "bg-surface-2 text-ink",
];
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const two = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return two.toUpperCase() || "—";
}
function logoClass(name: string): string {
  let h = 0;
  for (const ch of name) h = (h + ch.charCodeAt(0)) % 997;
  return LOGO_PALETTE[h % LOGO_PALETTE.length];
}

function statusClass(key: string): string {
  if (key === "active") return "badge-success";
  if (key === "none" || key === "closed") return "badge-neutral";
  return "";
}

export type CompanyRow = {
  company: Company;
  summary: CompanySummary;
  lastActivityAt: Date | null;
  relCounts: CompanyRelationCounts;
};

const TH = "col-label whitespace-nowrap border-b-[1.5px] border-line-strong px-3 py-2.5 text-[0.66rem] text-muted";

export function CompaniesTable({ rows, archived }: { rows: CompanyRow[]; archived: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="px-1 py-8 text-sm text-muted">
        {archived ? "No hay empresas archivadas." : "Sin empresas que coincidan."}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[960px] border-collapse text-left">
        <thead>
          <tr>
            <th className={TH}>Empresa</th>
            <th className={TH}>Ubicación</th>
            <th className={TH}>Proyectos</th>
            <th className={`${TH} text-right`}>Valor pipeline</th>
            <th className={TH}>Solución</th>
            <th className={`${TH} text-right`}>Últ. actividad</th>
            <th className={TH}>Estado</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ company: c, summary: s, lastActivityAt, relCounts: rc }) => (
            <tr key={c.id} className="group border-b border-line last:border-b-0 hover:bg-surface-2/60">
              {/* Empresa */}
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={`grid size-[34px] shrink-0 place-items-center rounded-[9px] font-display text-[0.9rem] font-bold ${logoClass(c.name)}`}>
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0">
                    <Link href={`/companies/${c.id}`} className="font-display text-[0.94rem] font-semibold leading-tight hover:underline">
                      {c.name}
                    </Link>
                    {c.industry ? <div className="truncate text-[0.72rem] text-muted">{c.industry}</div> : null}
                  </div>
                </div>
              </td>
              {/* Ubicación */}
              <td className="px-3 py-2.5 text-[0.84rem]">{c.headquartersLocation ?? "—"}</td>
              {/* Proyectos */}
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.92rem] font-medium tabular-nums">{s.count}</span>
                  <span className="inline-flex gap-[3px]">
                    {s.groups.map((g) => (
                      <span key={g} className="size-[7px] rounded-full" style={{ background: GROUP_DOT[g] }} title={labelOf(STAGE_GROUPS, g)} />
                    ))}
                  </span>
                </div>
              </td>
              {/* Valor */}
              <td className="px-3 py-2.5 text-right">
                <div className="font-mono text-[0.9rem] font-medium tabular-nums">
                  {formatUSD(s.totalValue)} <span className="text-[0.6rem] text-muted">USD</span>
                </div>
                <div className="font-mono text-[0.64rem] text-faint">{formatMXNCompact(s.totalValue)}</div>
              </td>
              {/* Solución */}
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {s.solutions.length === 0 ? (
                    <span className="text-[0.72rem] text-faint">—</span>
                  ) : (
                    s.solutions.map((sol) => (
                      <span key={sol} className={`badge ${SOLUTION_BADGE[sol]?.className ?? "badge-neutral"} text-[0.6rem]`}>
                        {labelOf(SOLUTION_TYPES, sol)}
                      </span>
                    ))
                  )}
                </div>
              </td>
              {/* Últ. actividad */}
              <td className="px-3 py-2.5 text-right font-mono text-[0.76rem] text-muted">
                {lastActivityAt ? dateFmt.format(lastActivityAt) : "—"}
              </td>
              {/* Estado */}
              <td className="px-3 py-2.5">
                <span
                  className={`badge ${statusClass(s.status.key)}`}
                  style={statusClass(s.status.key) === "" ? { background: `color-mix(in oklch, ${GROUP_DOT[s.status.key]} 15%, var(--surface))`, color: GROUP_DOT[s.status.key] } : undefined}
                >
                  {s.status.label}
                </span>
              </td>
              {/* Acciones */}
              <td className="px-3 py-2.5 text-right">
                <div className="inline-flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Link href={`/companies/${c.id}`} className="text-sm text-storage-ink hover:underline">
                    Editar
                  </Link>
                  <DeleteEntityDialog
                    id={c.id}
                    action={deleteCompanyAction}
                    name={c.name}
                    entityLabel="empresa"
                    entityArticle="la"
                    confirmName
                    impact={buildImpactRows({
                      projects: s.count,
                      contacts: rc.contacts,
                      activities: rc.activities,
                      tasks: rc.tasks,
                      pipelineValueMxn: s.totalValue,
                    })}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
