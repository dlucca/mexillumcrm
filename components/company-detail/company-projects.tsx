import Link from "next/link";
import type { Project } from "@/db/schema";
import type { OpenTaskRow } from "@/db/tasks";
import { labelOf, STAGES, formatMXN } from "@/lib/project-pipeline";
import { formatUSD } from "@/lib/currency";
import { GROUP_DOT, SOLUTION_BADGE, stageIndex } from "@/lib/dashboard-display";

const dueFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

export function CompanyProjects({
  projects,
  nextAction,
  today,
}: {
  projects: Project[];
  nextAction: Map<string, OpenTaskRow>;
  today: string;
}) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted">Esta empresa aún no tiene proyectos.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {projects.map((p) => {
        const sol = SOLUTION_BADGE[p.solutionType] ?? SOLUTION_BADGE.unknown;
        const idx = stageIndex(p.stage);
        const color = GROUP_DOT[p.stageGroup] ?? "var(--group-lead)";
        const na = nextAction.get(p.id) ?? null;
        const over = na != null && na.dueDate < today;
        const isToday = na != null && na.dueDate === today;
        return (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="grid grid-cols-[1.6fr_1fr_auto] items-center gap-4 rounded-xl border border-line p-3 transition-colors hover:bg-surface-2"
          >
            <div className="min-w-0">
              <div className="font-display text-[1rem] font-semibold leading-tight">{p.name}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className="whitespace-nowrap rounded-[5px] px-1.5 py-0.5 font-mono text-[0.6rem]"
                  style={{ background: `color-mix(in oklch, ${color} 13%, var(--surface))`, color }}
                >
                  {String(idx).padStart(2, "0")} · {labelOf(STAGES, p.stage)}
                </span>
                <span className={`badge ${sol.className} text-[0.58rem]`}>{sol.label}</span>
              </div>
            </div>
            <div className="min-w-0 text-[0.76rem] text-muted">
              {na ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className={`whitespace-nowrap rounded-[5px] px-1.5 py-0.5 font-mono text-[0.6rem] ${
                      over ? "bg-danger-wash text-danger-ink" : isToday ? "bg-solar-wash text-solar-ink" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {over ? "Vencido " : isToday ? "Hoy" : dueFmt.format(new Date(`${na.dueDate}T00:00:00`))}
                    {over ? dueFmt.format(new Date(`${na.dueDate}T00:00:00`)) : ""}
                  </span>
                  <span className="truncate">{na.title}</span>
                </span>
              ) : (
                <span className="text-solar-ink">Sin próxima acción</span>
              )}
            </div>
            <div className="text-right">
              <div className="font-mono text-[0.98rem] font-medium tabular-nums">
                {formatUSD(p.estimatedValue)} <span className="text-[0.6rem] text-muted">USD</span>
              </div>
              <div className="font-mono text-[0.64rem] text-faint">
                {formatMXN(p.estimatedValue)}
                {p.probability != null ? ` · Pot. ${p.probability}` : ""}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
