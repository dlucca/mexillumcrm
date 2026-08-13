// app/pipeline/page.tsx
import Link from "next/link";
import { db } from "@/db/client";
import { listAllProjects } from "@/db/projects";
import { listOpenTasksWithContext } from "@/db/tasks";
import { groupProjectsByStageGroup, nextActionByProject } from "@/lib/pipeline";
import { parsePipelineFilters, filterProjects, hasActiveFilters } from "@/lib/pipeline-filters";
import { weightedPipelineValue } from "@/lib/dashboard";
import { todayInMexicoCity } from "@/lib/my-actions";
import { formatUSDCompact, formatUSD } from "@/lib/currency";
import { PipelineToolbar } from "@/components/pipeline/pipeline-toolbar";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PipelineList } from "@/components/pipeline/pipeline-list";

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

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parsePipelineFilters(sp);
  const view = (Array.isArray(sp.view) ? sp.view[0] : sp.view) === "list" ? "list" : "kanban";

  const projects = await listAllProjects(db, { archived: false });
  const openTasks = await listOpenTasksWithContext(db);
  const today = todayInMexicoCity();

  const filtered = filterProjects(projects, filters);
  const columns = groupProjectsByStageGroup(filtered);
  const nextAction = nextActionByProject(openTasks);

  const totalValue = filtered.reduce((s, p) => s + (p.estimatedValue ?? 0), 0);
  const weighted = weightedPipelineValue(filtered);
  const empty = hasActiveFilters(filters) && filtered.length === 0;

  return (
    <main className="flex min-w-0 flex-col md:h-screen md:overflow-hidden">
      {/* Topbar */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 md:px-8">
        <div>
          <div className="eyebrow text-solar-ink">Embudo comercial</div>
          <h1 className="mt-0.5 font-display text-[2.05rem] font-bold leading-none tracking-display">
            Pipeline
          </h1>
        </div>
        <div className="flex items-end gap-6">
          <Total k="Valor total" v={formatUSDCompact(totalValue)} title={formatUSD(totalValue)} />
          <Total k="Proyectos" v={String(filtered.length)} />
          <Total k="Ponderado" v={formatUSDCompact(weighted)} title={formatUSD(weighted)} />
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-solar px-3.5 py-2.5 text-sm font-semibold text-on-solar transition-colors hover:bg-solar-strong"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Nuevo proyecto
          </Link>
        </div>
      </div>

      <PipelineToolbar filters={filters} view={view} />

      {empty ? (
        <p className="px-5 py-10 text-sm text-muted md:px-8">
          Sin proyectos que coincidan con los filtros.{" "}
          <Link href="/pipeline" className="font-semibold text-storage-ink hover:underline">
            Limpiar filtros
          </Link>
        </p>
      ) : view === "list" ? (
        <PipelineList projects={filtered} nextAction={nextAction} today={today} />
      ) : (
        <PipelineBoard columns={columns} nextAction={nextAction} today={today} />
      )}
    </main>
  );
}
