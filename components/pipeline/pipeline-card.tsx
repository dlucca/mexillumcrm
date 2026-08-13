import Link from "next/link";
import type { ProjectListRow } from "@/db/projects";
import type { OpenTaskRow } from "@/db/tasks";
import { labelOf, STAGES, STATUSES, formatMXN } from "@/lib/project-pipeline";
import { formatUSD } from "@/lib/currency";
import {
  GROUP_DOT,
  SOLUTION_BADGE,
  POT_COLOR,
  potentialBand,
  stageIndex,
  STAGE_COUNT,
} from "@/lib/dashboard-display";

const dueFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

function dueChip(due: string, today: string): { label: string; cls: string } {
  const d = () => dueFmt.format(new Date(`${due}T00:00:00`));
  if (due < today) return { label: `Vencido ${d()}`, cls: "bg-danger-wash text-danger-ink" };
  if (due === today) return { label: "Hoy", cls: "bg-solar-wash text-solar-ink" };
  return { label: d(), cls: "bg-surface-2 text-muted" };
}

export function PipelineCard({
  project,
  nextAction,
  today,
}: {
  project: ProjectListRow;
  nextAction: OpenTaskRow | null;
  today: string;
}) {
  const sol = SOLUTION_BADGE[project.solutionType] ?? SOLUTION_BADGE.unknown;
  const band = potentialBand(project.probability);
  const idx = stageIndex(project.stage);
  const progress = (idx / STAGE_COUNT) * 100;
  const groupColor = GROUP_DOT[project.stageGroup] ?? "var(--group-lead)";
  const isOpen = project.status === "open";
  const paused = project.status === "paused";
  const sub = [project.companyName, project.plantName].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`relative flex flex-col gap-1.5 rounded-[10px] border bg-surface p-[0.6rem_0.65rem_0.55rem] shadow-[0_1px_2px_oklch(0.5_0.02_60/0.05)] transition-colors hover:border-line-strong ${
        paused ? "border-[color-mix(in_oklch,var(--danger)_40%,var(--line))]" : "border-line"
      }`}
    >
      {!isOpen ? (
        <span
          className={`absolute -top-1.5 right-2 rounded-[5px] px-1.5 py-[0.08rem] text-[0.55rem] font-bold uppercase tracking-[0.06em] ${
            paused ? "bg-danger text-white" : "bg-surface-2 text-muted"
          }`}
        >
          {labelOf(STATUSES, project.status)}
        </span>
      ) : null}

      {/* toprow: solución + potencial */}
      <div className="flex items-center gap-1.5">
        <span className={`badge ${sol.className} text-[0.6rem]`}>{sol.label}</span>
        {project.probability != null ? (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[0.68rem] text-muted">
            <span
              className="size-2 rounded-[2px]"
              style={{ background: band ? POT_COLOR[band] : "var(--faint)" }}
            />
            {project.probability}
          </span>
        ) : null}
      </div>

      <div className="font-display text-[0.98rem] font-semibold leading-[1.08]">{project.name}</div>
      {sub ? <div className="-mt-1 text-[0.68rem] text-muted">{sub}</div> : null}

      <div>
        <div className="font-mono text-[0.98rem] font-medium tabular-nums">
          {formatUSD(project.estimatedValue)} <span className="text-[0.62rem] text-muted">USD</span>
        </div>
        {project.estimatedValue != null ? (
          <div className="-mt-0.5 font-mono text-[0.66rem] text-faint">
            {formatMXN(project.estimatedValue)}
          </div>
        ) : null}
      </div>

      {/* etapa + progreso */}
      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap font-mono text-[0.64rem] text-muted">
          {String(idx).padStart(2, "0")} · {labelOf(STAGES, project.stage)}
        </span>
        <span className="h-1 flex-1 overflow-hidden rounded-[3px] bg-line">
          <span className="block h-full rounded-[3px]" style={{ width: `${progress}%`, background: groupColor }} />
        </span>
      </div>

      <div className="my-[0.05rem] h-px bg-line" />

      {/* próxima acción */}
      {nextAction ? (
        <div className="flex items-center gap-1.5">
          <span
            className={`whitespace-nowrap rounded-[5px] px-1.5 py-[0.08rem] font-mono text-[0.6rem] font-medium ${
              dueChip(nextAction.dueDate, today).cls
            }`}
          >
            {dueChip(nextAction.dueDate, today).label}
          </span>
          <span className="min-w-0 truncate text-[0.72rem] text-ink">{nextAction.title}</span>
        </div>
      ) : (
        <div className="text-[0.68rem] text-solar-ink">Sin próxima acción</div>
      )}
    </Link>
  );
}
