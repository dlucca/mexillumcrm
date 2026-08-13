import Link from "next/link";
import type { ProjectCountRow } from "@/db/projects";
import type { OpenTaskRow } from "@/db/tasks";
import { labelOf, STAGE_GROUPS, STATUSES } from "@/lib/project-pipeline";
import { formatUSD, formatMXNCompact } from "@/lib/currency";
import {
  GROUP_DOT,
  SOLUTION_BADGE,
  STATUS_BADGE,
  POT_COLOR,
  potentialBand,
  stageIndex,
  STAGE_COUNT,
} from "@/lib/dashboard-display";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";
import { buildImpactRows } from "@/lib/delete-impact";
import { deleteProjectAction } from "@/app/projects/actions";

const dueFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

const TH = "col-label whitespace-nowrap border-b-[1.5px] border-line-strong px-3 py-2.5 text-[0.66rem] text-muted";

export function ProjectsTable({
  rows,
  nextAction,
  today,
  archived = false,
}: {
  rows: ProjectCountRow[];
  nextAction: Map<string, OpenTaskRow>;
  today: string;
  archived?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-1 py-8 text-sm text-muted">
        {archived ? "No hay proyectos archivados." : "Sin proyectos que coincidan."}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[960px] border-collapse text-left">
        <thead>
          <tr>
            <th className={TH}>Proyecto</th>
            <th className={TH}>Etapa</th>
            <th className={TH}>Solución</th>
            <th className={`${TH} text-right`}>Valor</th>
            <th className={`${TH} text-center`}>Potencial</th>
            <th className={TH}>Siguiente acción</th>
            <th className={TH}>Estado</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const sol = SOLUTION_BADGE[p.solutionType] ?? SOLUTION_BADGE.unknown;
            const idx = stageIndex(p.stage);
            const band = potentialBand(p.probability);
            const groupColor = GROUP_DOT[p.stageGroup] ?? "var(--group-lead)";
            const na = nextAction.get(p.id) ?? null;
            const over = na != null && na.dueDate < today;
            const isToday = na != null && na.dueDate === today;
            const meta = [p.city, p.state].filter(Boolean).join(" · ");
            return (
              <tr key={p.id} className="group border-b border-line last:border-b-0 hover:bg-surface-2/60">
                {/* Proyecto */}
                <td className="px-3 py-2.5">
                  <Link href={`/projects/${p.id}`} className="font-display text-[0.94rem] font-semibold leading-[1.12] hover:underline">
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-1.5 text-[0.71rem] text-muted">
                    <span>{p.companyName}</span>
                    {meta ? <span className="text-faint">· {meta}</span> : null}
                  </div>
                </td>
                {/* Etapa */}
                <td className="px-3 py-2.5">
                  <div className="min-w-[120px]">
                    <div className="flex items-center gap-1.5">
                      <span className="col-label text-[0.7rem]" style={{ color: groupColor }}>
                        {labelOf(STAGE_GROUPS, p.stageGroup)}
                      </span>
                      <span className="font-mono text-[0.68rem] tabular-nums text-muted">
                        {String(idx).padStart(2, "0")}/{STAGE_COUNT}
                      </span>
                    </div>
                    <span className="mt-1 block h-1 overflow-hidden rounded-[3px] bg-line">
                      <span
                        className="block h-full rounded-[3px]"
                        style={{ width: `${(idx / STAGE_COUNT) * 100}%`, background: groupColor }}
                      />
                    </span>
                  </div>
                </td>
                {/* Solución */}
                <td className="px-3 py-2.5">
                  <span className={`badge ${sol.className}`}>{sol.label}</span>
                </td>
                {/* Valor */}
                <td className="px-3 py-2.5 text-right">
                  <div className="font-mono text-[0.9rem] font-medium tabular-nums">
                    {formatUSD(p.estimatedValue)} <span className="text-[0.6rem] text-muted">USD</span>
                  </div>
                  {p.estimatedValue != null ? (
                    <div className="font-mono text-[0.64rem] text-faint">{formatMXNCompact(p.estimatedValue)}</div>
                  ) : null}
                </td>
                {/* Potencial */}
                <td className="px-3 py-2.5 text-center">
                  {p.probability != null ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[0.86rem] font-medium tabular-nums">
                      <span className="size-2.5 rounded-[3px]" style={{ background: band ? POT_COLOR[band] : "var(--faint)" }} />
                      {p.probability}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-faint">—</span>
                  )}
                </td>
                {/* Siguiente acción */}
                <td className="px-3 py-2.5">
                  {na ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={`whitespace-nowrap rounded-[5px] px-1.5 py-[0.1rem] font-mono text-[0.62rem] font-medium ${
                          over ? "bg-danger-wash text-danger-ink" : isToday ? "bg-solar-wash text-solar-ink" : "bg-surface-2 text-muted"
                        }`}
                      >
                        {over ? "Vencido " : isToday ? "Hoy" : dueFmt.format(new Date(`${na.dueDate}T00:00:00`))}
                        {over ? dueFmt.format(new Date(`${na.dueDate}T00:00:00`)) : ""}
                      </span>
                      <span className="max-w-[16ch] truncate text-[0.78rem]">{na.title}</span>
                    </div>
                  ) : (
                    <span className="text-[0.72rem] text-solar-ink">Sin próxima acción</span>
                  )}
                </td>
                {/* Estado */}
                <td className="px-3 py-2.5">
                  <span className={`badge ${STATUS_BADGE[p.status] ?? "badge-neutral"}`}>
                    {labelOf(STATUSES, p.status)}
                  </span>
                </td>
                {/* Acciones */}
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {!archived ? (
                      <Link href={`/projects/${p.id}`} className="text-sm text-storage-ink hover:underline">
                        Editar
                      </Link>
                    ) : null}
                    <DeleteEntityDialog
                      id={p.id}
                      action={deleteProjectAction}
                      name={p.name}
                      entityLabel="proyecto"
                      entityArticle="el"
                      impact={buildImpactRows({
                        activities: p.activityCount,
                        tasks: p.taskCount,
                      })}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
