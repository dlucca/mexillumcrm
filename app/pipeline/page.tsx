import { db } from "@/db/client";
import { listAllProjects } from "@/db/projects";
import { listOpenTasksWithContext } from "@/db/tasks";
import { groupProjectsByStageGroup, nextActionByProject } from "@/lib/pipeline";
import { formatMXN } from "@/lib/project-pipeline";
import { ProjectCard } from "@/components/project-card";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const projects = await listAllProjects(db, { archived: false });
  const openTasks = await listOpenTasksWithContext(db);
  const columns = groupProjectsByStageGroup(projects);
  const nextAction = nextActionByProject(openTasks);

  return (
    <main className="p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">Pipeline</h1>
      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.group} className="w-72 shrink-0">
            <div className="flex items-baseline justify-between border-b pb-2">
              <h2 className="font-display font-bold text-lg tracking-display">{col.label}</h2>
              <span className="text-xs text-neutral-500">
                {col.count} · {formatMXN(col.totalValue)}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {col.projects.length === 0 ? (
                <p className="text-xs text-neutral-400">—</p>
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
    </main>
  );
}
