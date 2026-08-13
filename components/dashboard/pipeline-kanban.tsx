import Link from "next/link";
import { formatUSDCompact, formatUSD, formatMXNCompact } from "@/lib/currency";
import { GROUP_DOT, SOLUTION_BADGE, stageIndex, STAGE_COUNT } from "@/lib/dashboard-display";

type KanbanProject = {
  id: string;
  name: string;
  estimatedValue: number | null;
  solutionType: string;
  stage: string;
  probability: number | null;
};

type KanbanColumn = {
  group: string;
  label: string;
  count: number;
  totalValue: number;
  projects: KanbanProject[];
};

const PER_COLUMN = 4;

function ProjectMiniCard({ p }: { p: KanbanProject }) {
  const sol = SOLUTION_BADGE[p.solutionType] ?? SOLUTION_BADGE.unknown;
  return (
    <Link
      href={`/projects/${p.id}`}
      className="flex flex-col gap-1.5 rounded-[9px] border border-line bg-surface p-[0.6rem_0.65rem] shadow-[0_1px_2px_oklch(0.5_0.02_60/0.05)] transition-colors hover:border-line-strong"
    >
      <div className="font-display text-[0.86rem] font-semibold leading-[1.08]">{p.name}</div>
      <div className="font-mono text-[0.9rem] font-medium tabular-nums">
        {formatUSDCompact(p.estimatedValue)}
        {p.estimatedValue != null ? (
          <span className="ml-1 text-[0.6rem] text-faint">{formatMXNCompact(p.estimatedValue)}</span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-1.5">
        <span className={`badge ${sol.className} text-[0.6rem]`}>{sol.label}</span>
        {p.probability != null ? (
          <span className="font-mono text-[0.66rem] text-muted">{p.probability}</span>
        ) : (
          <span className="font-mono text-[0.6rem] text-faint">
            {stageIndex(p.stage)}/{STAGE_COUNT}
          </span>
        )}
      </div>
    </Link>
  );
}

export function PipelineKanban({ columns }: { columns: KanbanColumn[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {columns.map((col) => {
        const shown = col.projects.slice(0, PER_COLUMN);
        const rest = col.count - shown.length;
        return (
          <div
            key={col.group}
            className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-line bg-surface-2 p-[0.7rem_0.6rem]"
          >
            <div className="flex items-center gap-1.5 px-0.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: GROUP_DOT[col.group] }}
              />
              <span className="col-label truncate text-[0.72rem] tracking-[0.05em] text-ink">
                {col.label}
              </span>
              <span className="ml-auto font-mono text-[0.68rem] text-muted">{col.count}</span>
            </div>
            <div
              className="-mt-1.5 px-0.5 font-mono text-[0.7rem] text-faint"
              title={formatUSD(col.totalValue)}
            >
              {formatUSDCompact(col.totalValue)}
            </div>
            {shown.length === 0 ? (
              <p className="px-0.5 py-2 font-mono text-[0.7rem] text-faint">—</p>
            ) : (
              shown.map((p) => <ProjectMiniCard key={p.id} p={p} />)
            )}
            {rest > 0 ? (
              <Link
                href={`/pipeline?group=${col.group}`}
                className="px-0.5 pt-0.5 font-mono text-[0.68rem] text-storage-ink hover:underline"
              >
                +{rest} más →
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
