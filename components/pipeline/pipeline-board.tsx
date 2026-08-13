import type { PipelineColumn } from "@/lib/pipeline";
import type { ProjectListRow } from "@/db/projects";
import type { OpenTaskRow } from "@/db/tasks";
import { formatUSDCompact, formatUSD } from "@/lib/currency";
import { GROUP_DOT, groupStageRange } from "@/lib/dashboard-display";
import { PipelineCard } from "@/components/pipeline/pipeline-card";

function rangeLabel(group: string): string {
  const [min, max] = groupStageRange(group);
  if (min === 0) return "";
  return min === max ? `Etapa ${min}` : `Etapas ${min}–${max}`;
}

export function PipelineBoard({
  columns,
  nextAction,
  today,
}: {
  columns: PipelineColumn<ProjectListRow>[];
  nextAction: Map<string, OpenTaskRow>;
  today: string;
}) {
  return (
    <div className="flex-1 overflow-x-auto px-5 py-4 md:min-h-0 md:px-8">
      <div className="grid h-full auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 md:grid-flow-row md:auto-cols-auto md:grid-cols-6">
        {columns.map((col) => (
          <div key={col.group} className="flex min-w-0 flex-col md:min-h-0">
            <div className="flex items-center gap-1.5 px-0.5 pb-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: GROUP_DOT[col.group] }}
              />
              <span className="col-label text-[0.9rem] tracking-[0.04em] text-ink">{col.label}</span>
              <span className="rounded-full bg-surface-2 px-1.5 font-mono text-[0.7rem] text-muted">
                {col.count}
              </span>
              <span className="ml-auto font-mono text-[0.78rem] font-medium text-ink" title={formatUSD(col.totalValue)}>
                {formatUSDCompact(col.totalValue)}
              </span>
            </div>
            <div className="-mt-1 px-0.5 pb-2 font-mono text-[0.62rem] text-faint">
              {rangeLabel(col.group)}
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-2 md:min-h-0 md:flex-1 md:overflow-y-auto">
              {col.projects.length === 0 ? (
                <p className="px-1 py-3 text-center font-mono text-[0.7rem] text-faint">—</p>
              ) : (
                col.projects.map((p) => (
                  <PipelineCard
                    key={p.id}
                    project={p}
                    nextAction={nextAction.get(p.id) ?? null}
                    today={today}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
