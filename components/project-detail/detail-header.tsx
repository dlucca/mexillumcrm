import Link from "next/link";
import type { Project } from "@/db/schema";
import { labelOf, STAGES, STAGE_GROUPS, STATUSES, formatMXN } from "@/lib/project-pipeline";
import { formatUSD, MXN_PER_USD } from "@/lib/currency";
import {
  GROUP_DOT,
  SOLUTION_BADGE,
  STATUS_BADGE,
  POT_COLOR,
  potentialBand,
  stageIndex,
  STAGE_COUNT,
  pipelineStepper,
} from "@/lib/dashboard-display";

function Stepper({ stage }: { stage: string }) {
  const segs = pipelineStepper(stage);
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {segs.map((s) => {
        const color = GROUP_DOT[s.group];
        return (
          <div key={s.group} className="relative">
            {s.state === "current" ? (
              <span
                className="absolute -top-6 left-0 whitespace-nowrap rounded-[5px] px-1.5 py-0.5 font-mono text-[0.64rem] font-medium"
                style={{ background: `color-mix(in oklch, ${color} 12%, var(--surface))`, color }}
              >
                ▸ {String(stageIndex(stage)).padStart(2, "0")}
              </span>
            ) : null}
            <span className="block h-[7px] overflow-hidden rounded bg-line">
              <span className="block h-full rounded" style={{ width: `${s.fill}%`, background: color }} />
            </span>
            <div
              className={`col-label mt-1.5 text-[0.68rem] ${
                s.state === "upcoming" ? "text-faint" : "text-muted"
              }`}
              style={s.state === "current" ? { color } : undefined}
            >
              {s.label}
            </div>
            <div className="font-mono text-[0.6rem] text-faint">
              {s.range[0]}
              {s.range[0] !== s.range[1] ? `–${s.range[1]}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Figure({ k, children, sub }: { k: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="col-label text-[0.58rem] text-muted">{k}</div>
      <div className="mt-0.5 font-mono text-[1.25rem] font-medium tabular-nums leading-none">{children}</div>
      {sub ? <div className="mt-1 font-mono text-[0.66rem] text-faint">{sub}</div> : null}
    </div>
  );
}

export function DetailHeader({
  project,
  companyName,
  principalContact,
  actions,
}: {
  project: Project;
  companyName: string;
  principalContact: { name: string; role: string | null } | null;
  actions?: React.ReactNode;
}) {
  const idx = stageIndex(project.stage);
  const groupColor = GROUP_DOT[project.stageGroup] ?? "var(--group-lead)";
  const sol = SOLUTION_BADGE[project.solutionType] ?? SOLUTION_BADGE.unknown;
  const band = potentialBand(project.probability);
  const loc = [project.city, project.state].filter(Boolean).join(", ");

  return (
    <div className="border-b border-line px-5 pb-4 pt-5 md:px-8">
      <div className="mb-2 flex items-center gap-1.5 text-[0.76rem] text-muted">
        <Link href="/projects" className="hover:underline">
          Proyectos
        </Link>
        <span>›</span>
        <Link href={`/companies/${project.companyId}`} className="hover:underline">
          {companyName}
        </Link>
        {loc ? <span className="text-faint">· {loc}</span> : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] font-bold leading-none tracking-display">{project.name}</h1>
          {project.industrySubsegment ? (
            <div className="mt-1 text-[0.86rem] text-muted">{project.industrySubsegment}</div>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span
              className="badge"
              style={{ background: `color-mix(in oklch, ${groupColor} 14%, var(--surface))`, color: groupColor }}
            >
              <span className="size-1.5 rounded-full" style={{ background: groupColor }} />
              {labelOf(STAGE_GROUPS, project.stageGroup)} · {String(idx).padStart(2, "0")}/{STAGE_COUNT}{" "}
              {labelOf(STAGES, project.stage)}
            </span>
            <span className={`badge ${sol.className}`}>{sol.label}</span>
            <span className={`badge ${STATUS_BADGE[project.status] ?? "badge-neutral"}`}>
              {labelOf(STATUSES, project.status)}
            </span>
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
        <Figure
          k="Valor"
          sub={project.estimatedValue != null ? `${formatMXN(project.estimatedValue)} · TC ${MXN_PER_USD.toFixed(2)}` : undefined}
        >
          {formatUSD(project.estimatedValue)} <span className="text-[0.8rem] text-muted">USD</span>
        </Figure>
        <Figure k="Potencial" sub={band ? band.replace(/^\w/, (m) => m.toUpperCase()) : undefined}>
          {project.probability != null ? (
            <span style={{ color: band ? POT_COLOR[band] : undefined }}>
              {project.probability}
              <span className="text-[0.9rem] text-muted">/100</span>
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </Figure>
        <Figure
          k="Contacto principal"
          sub={principalContact?.role ?? undefined}
        >
          <span className="font-sans text-[0.95rem] font-semibold">
            {principalContact?.name ?? "—"}
          </span>
        </Figure>
      </div>

      <div className="mt-6 pb-1">
        <Stepper stage={project.stage} />
      </div>
    </div>
  );
}
