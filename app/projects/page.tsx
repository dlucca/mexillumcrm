import Link from "next/link";
import { db } from "@/db/client";
import { listAllProjectsWithCounts } from "@/db/projects";
import { listOpenTasksWithContext } from "@/db/tasks";
import { nextActionByProject } from "@/lib/pipeline";
import { parsePipelineFilters, filterProjects } from "@/lib/pipeline-filters";
import { projectsMissingNextAction, todayInMexicoCity } from "@/lib/my-actions";
import { sortProjects } from "@/lib/project-sort";
import { formatUSDCompact, formatUSD } from "@/lib/currency";
import { ProjectsToolbar } from "@/components/projects/projects-toolbar";
import { ProjectsTable } from "@/components/projects/projects-table";

export const dynamic = "force-dynamic";

function Total({ k, v, title, alert }: { k: string; v: string; title?: string; alert?: boolean }) {
  return (
    <div>
      <div className="col-label text-[0.58rem] text-muted">{k}</div>
      <div
        className={`mt-px font-mono text-[1.15rem] font-medium tabular-nums ${alert ? "text-danger-ink" : ""}`}
        title={title}
      >
        {v}
      </div>
    </div>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const archived = first(sp.archived) === "1";
  const na = first(sp.na) === "1";
  const sort = first(sp.sort) ?? "value";
  const filters = parsePipelineFilters(sp);

  const base = await listAllProjectsWithCounts(db, { archived });
  const openTasks = await listOpenTasksWithContext(db);
  const today = todayInMexicoCity();

  const missing = projectsMissingNextAction(base, openTasks);
  const missingSet = new Set(missing.map((p) => p.id));

  const filtered0 = filterProjects(base, filters);
  const filtered = na ? filtered0.filter((p) => missingSet.has(p.id)) : filtered0;
  const rows = sortProjects(filtered, sort);
  const nextAction = nextActionByProject(openTasks);

  const pipelineValue = base
    .filter((p) => p.status === "open")
    .reduce((s, p) => s + (p.estimatedValue ?? 0), 0);

  return (
    <main className="flex min-w-0 flex-col">
      {/* Topbar */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 md:px-8">
        <div>
          <div className="eyebrow text-solar-ink">Plantas · una planta = un proyecto</div>
          <h1 className="mt-0.5 font-display text-[2.05rem] font-bold leading-none tracking-display">
            Proyectos
          </h1>
        </div>
        <div className="flex items-end gap-6">
          <Total k="Proyectos" v={String(base.length)} />
          <Total k="Valor pipeline" v={formatUSDCompact(pipelineValue)} title={formatUSD(pipelineValue)} />
          <Total k="Sin siguiente acción" v={String(missing.length)} alert={missing.length > 0} />
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

      <ProjectsToolbar filters={filters} sort={sort} na={na} archived={archived} />

      <div className="flex flex-col gap-3 px-5 py-4 md:px-8">
        <div className="flex gap-4 text-sm">
          <Link href="/projects" className={archived ? "text-muted hover:text-ink" : "font-semibold"}>
            Activos
          </Link>
          <Link
            href="/projects?archived=1"
            className={archived ? "font-semibold" : "text-muted hover:text-ink"}
          >
            Archivados
          </Link>
        </div>
        <ProjectsTable rows={rows} nextAction={nextAction} today={today} archived={archived} />
      </div>
    </main>
  );
}
