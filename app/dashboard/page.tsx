import Link from "next/link";
import { db } from "@/db/client";
import { listAllProjects } from "@/db/projects";
import { listOpenTasksWithContext } from "@/db/tasks";
import { lastActivityByProject } from "@/db/activities";
import { groupProjectsByStageGroup } from "@/lib/pipeline";
import { dashboardTotals, solutionMix, conversionRate, pipelineHealth } from "@/lib/dashboard";
import { todayInMexicoCity, bucketTasksByDueDate } from "@/lib/my-actions";
import { formatUSDCompact, formatMXNCompact, MXN_PER_USD } from "@/lib/currency";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PipelineKanban } from "@/components/dashboard/pipeline-kanban";
import { NextActionsList } from "@/components/dashboard/next-actions-list";
import { SolutionMixPanel } from "@/components/dashboard/solution-mix-panel";
import { PipelineHealthPanel } from "@/components/dashboard/pipeline-health-panel";

export const dynamic = "force-dynamic";

const mxDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" });
const longDateFmt = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function SectionHead({
  title,
  meta,
  link,
}: {
  title: string;
  meta?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-3.5 flex items-baseline gap-3">
      <h2 className="font-display text-[1.35rem] font-bold leading-none tracking-display">{title}</h2>
      {meta ? <span className="font-mono text-xs text-faint">{meta}</span> : null}
      {link ? (
        <Link href={link.href} className="ml-auto text-sm font-semibold text-storage-ink hover:underline">
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-surface p-[1.1rem_1.2rem_1.2rem]">{children}</div>;
}

export default async function DashboardPage() {
  const projects = await listAllProjects(db, { archived: false });
  const openTasks = await listOpenTasksWithContext(db);
  const lastActivityRaw = await lastActivityByProject(db);
  const today = todayInMexicoCity();

  const totals = dashboardTotals(projects, openTasks, today);
  const columns = groupProjectsByStageGroup(projects);
  const { overdue, dueToday, upcoming } = bucketTasksByDueDate(openTasks, today, 7);
  const mix = solutionMix(projects);
  const conv = conversionRate(projects);

  const lastActivityDates = new Map<string, string>(
    [...lastActivityRaw].map(([id, d]) => [id, mxDateFmt.format(d)])
  );
  const health = pipelineHealth(projects, lastActivityDates, openTasks, today);

  const prettyDate = longDateFmt.format(new Date(`${today}T12:00:00`));

  return (
    <main className="flex min-w-0 flex-col">
      {/* Topbar */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line px-5 py-5 md:px-8">
        <div>
          <div className="eyebrow text-solar-ink">
            Vista ejecutiva · {prettyDate.charAt(0).toUpperCase() + prettyDate.slice(1)}
          </div>
          <h1 className="mt-0.5 font-display text-[2.2rem] font-bold leading-none tracking-display">
            Pipeline comercial
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg border border-line bg-surface px-2.5 py-2 font-mono text-[0.72rem] text-muted">
            TC <b className="font-medium text-ink">{MXN_PER_USD.toFixed(2)}</b> MXN/USD
          </span>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 rounded-lg bg-solar px-3.5 py-2.5 text-sm font-semibold text-on-solar transition-colors hover:bg-solar-strong"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Nuevo proyecto
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-5 py-6 md:px-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard
            label="Pipeline abierto"
            value={formatUSDCompact(totals.openValue)}
            unit="USD"
            sub={
              <span className="text-faint">
                {formatMXNCompact(totals.openValue)} · {totals.openCount} proyectos
              </span>
            }
          />
          <KpiCard
            label="Proyectos activos"
            value={totals.openCount}
            sub={<span className="text-faint">abiertos en pipeline</span>}
          />
          <KpiCard
            label="Sin siguiente acción"
            value={totals.missingNextAction}
            alert={totals.missingNextAction > 0}
            sub={
              <span className={totals.missingNextAction > 0 ? "text-danger-ink" : "text-faint"}>
                {totals.overdueTasks} tarea(s) vencida(s)
              </span>
            }
          />
          <KpiCard
            label="Conversión"
            value={conv.rate == null ? "—" : Math.round(conv.rate * 100)}
            unit={conv.rate == null ? undefined : "%"}
            sub={
              <span className="text-faint">
                {conv.won} ganados · {conv.lost} perdidos
              </span>
            }
          />
        </div>

        {/* Kanban */}
        <section>
          <SectionHead
            title="Embudo por etapa"
            meta={`6 grupos · 13 etapas · ${totals.openCount} proyectos`}
            link={{ href: "/pipeline", label: "Ver pipeline completo →" }}
          />
          <PipelineKanban columns={columns} />
        </section>

        {/* Split: acciones + salud */}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Panel>
            <SectionHead
              title="Siguientes acciones"
              link={{ href: "/my-actions", label: "Todas →" }}
            />
            <NextActionsList overdue={overdue} dueToday={dueToday} upcoming={upcoming} today={today} />
          </Panel>

          <div className="flex flex-col gap-6">
            <Panel>
              <SectionHead title="Mezcla de solución" meta="por valor" />
              <SolutionMixPanel rows={mix} />
            </Panel>
            <Panel>
              <SectionHead title="Salud del pipeline" meta={`${health.total} abiertos`} />
              <PipelineHealthPanel health={health} />
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
