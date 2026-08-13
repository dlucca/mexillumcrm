import Link from "next/link";
import type { ProjectListRow } from "@/db/projects";
import type { OpenTaskRow } from "@/db/tasks";
import { labelOf, STATUSES } from "@/lib/project-pipeline";
import { formatUSD, formatMXNCompact } from "@/lib/currency";
import { SOLUTION_BADGE, stageIndex, STAGE_COUNT, GROUP_DOT } from "@/lib/dashboard-display";

const dueFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "badge-solar",
    won: "badge-success",
    active_customer: "badge-success",
    lost: "badge-danger",
    paused: "badge-neutral",
  };
  return <span className={`badge ${map[status] ?? "badge-neutral"}`}>{labelOf(STATUSES, status)}</span>;
}

export function PipelineList({
  projects,
  nextAction,
  today,
}: {
  projects: ProjectListRow[];
  nextAction: Map<string, OpenTaskRow>;
  today: string;
}) {
  return (
    <div className="flex-1 overflow-auto px-5 py-4 md:px-8">
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-strong bg-surface-2 text-left">
              <th className="col-label px-4 py-2.5 text-muted">Proyecto</th>
              <th className="col-label px-4 py-2.5 text-muted">Solución</th>
              <th className="col-label px-4 py-2.5 text-muted">Etapa</th>
              <th className="col-label px-4 py-2.5 text-right text-muted">Valor USD</th>
              <th className="col-label px-4 py-2.5 text-muted">Estado</th>
              <th className="col-label px-4 py-2.5 text-muted">Próxima acción</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const sol = SOLUTION_BADGE[p.solutionType] ?? SOLUTION_BADGE.unknown;
              const idx = stageIndex(p.stage);
              const na = nextAction.get(p.id) ?? null;
              const over = na != null && na.dueDate < today;
              return (
                <tr key={p.id} className="border-b border-line last:border-b-0 hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {[p.companyName, p.plantName].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`badge ${sol.className}`}>{sol.label}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: GROUP_DOT[p.stageGroup] }}
                      />
                      <span className="font-mono text-xs tabular-nums text-muted">
                        {idx}/{STAGE_COUNT}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="font-mono tabular-nums">{formatUSD(p.estimatedValue)}</div>
                    {p.estimatedValue != null ? (
                      <div className="font-mono text-[0.66rem] text-faint">
                        {formatMXNCompact(p.estimatedValue)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    {na ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`whitespace-nowrap font-mono text-[0.68rem] ${
                            over ? "font-medium text-danger-ink" : "text-muted"
                          }`}
                        >
                          {over ? "Vencido " : ""}
                          {dueFmt.format(new Date(`${na.dueDate}T00:00:00`))}
                        </span>
                        <span className="min-w-0 truncate text-xs text-ink">{na.title}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-solar-ink">Sin próxima acción</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
