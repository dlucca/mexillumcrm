import { db } from "@/db/client";
import { listAllProjects } from "@/db/projects";
import { listOpenTasksWithContext } from "@/db/tasks";
import { groupProjectsByStageGroup } from "@/lib/pipeline";
import { pipelineByStage, dashboardTotals } from "@/lib/dashboard";
import {
  todayInMexicoCity,
  bucketTasksByDueDate,
  projectsMissingNextAction,
} from "@/lib/my-actions";
import { formatMXN } from "@/lib/project-pipeline";
import { formatUSD } from "@/lib/currency";
import { MyActionsPanel } from "@/components/my-actions-panel";
import { PipelineGroupChart } from "@/components/pipeline-group-chart";
import { PipelineStageChart } from "@/components/pipeline-stage-chart";

export const dynamic = "force-dynamic";

function Kpi({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className={`font-mono text-3xl tabular-nums ${alert ? "text-danger" : "text-ink"}`}>
        {value}
      </span>
      {sub ? <span className="text-xs text-muted">{sub}</span> : null}
    </div>
  );
}

export default async function DashboardPage() {
  const projects = await listAllProjects(db, { archived: false });
  const openTasks = await listOpenTasksWithContext(db);
  const today = todayInMexicoCity();
  const totals = dashboardTotals(projects, openTasks, today);
  const groups = groupProjectsByStageGroup(projects);
  const stages = pipelineByStage(projects);
  const { overdue, dueToday, upcoming } = bucketTasksByDueDate(openTasks, today, 7);
  const missing = projectsMissingNextAction(projects, openTasks);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">Dashboard</h1>

      <div className="mt-6 flex flex-wrap gap-x-12 gap-y-4 border-b border-line pb-6">
        <Kpi
          label="Pipeline abierto"
          value={formatMXN(totals.openValue)}
          sub={`${totals.openCount} proyectos · ${formatUSD(totals.openValue)}`}
        />
        <Kpi
          label="Sin próxima acción"
          value={String(totals.missingNextAction)}
          alert={totals.missingNextAction > 0}
        />
        <Kpi
          label="Tareas vencidas"
          value={String(totals.overdueTasks)}
          alert={totals.overdueTasks > 0}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="font-display font-bold text-xl tracking-display">Pipeline por grupo</h2>
            <div className="mt-3">
              <PipelineGroupChart columns={groups.map((g) => ({ group: g.group, label: g.label, count: g.count, totalValue: g.totalValue }))} />
            </div>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl tracking-display">Pipeline por etapa</h2>
            <div className="mt-3">
              <PipelineStageChart stages={stages} />
            </div>
          </section>
        </div>
        <div>
          <h2 className="font-display font-bold text-xl tracking-display">My Actions</h2>
          <MyActionsPanel overdue={overdue} dueToday={dueToday} upcoming={upcoming} missing={missing} />
        </div>
      </div>
    </main>
  );
}
