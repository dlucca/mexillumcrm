// app/pipeline/page.tsx
import { db } from "@/db/client";
import { listAllProjects } from "@/db/projects";
import { listOpenTasksWithContext } from "@/db/tasks";
import { groupProjectsByStageGroup, nextActionByProject } from "@/lib/pipeline";
import { parsePipelineFilters, filterProjects, hasActiveFilters } from "@/lib/pipeline-filters";
import { formatMXN } from "@/lib/project-pipeline";
import { formatUSD } from "@/lib/currency";
import { ProjectCard } from "@/components/project-card";
import { PipelineFilterBar } from "@/components/pipeline-filter-bar";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parsePipelineFilters(await searchParams);
  const projects = await listAllProjects(db, { archived: false });
  const openTasks = await listOpenTasksWithContext(db);
  const filtered = filterProjects(projects, filters);
  const columns = groupProjectsByStageGroup(filtered);
  const nextAction = nextActionByProject(openTasks);
  const empty = hasActiveFilters(filters) && filtered.length === 0;

  return (
    <main className="p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">Pipeline</h1>
      <div className="mt-6">
        <PipelineFilterBar filters={filters} />
      </div>
      {empty ? (
        <p className="mt-6 text-sm text-muted">Sin proyectos que coincidan con los filtros.</p>
      ) : (
        <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div key={col.group} className="w-72 shrink-0">
              <div className="flex items-baseline justify-between border-b border-line pb-2">
                <h2 className="font-display font-bold text-lg tracking-display">{col.label}</h2>
                <span className="text-xs text-muted">
                  {col.count} · {formatMXN(col.totalValue)} · {formatUSD(col.totalValue)}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {col.projects.length === 0 ? (
                  <p className="text-xs text-faint">—</p>
                ) : (
                  col.projects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      nextActionTitle={nextAction.get(p.id)?.title ?? null}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
