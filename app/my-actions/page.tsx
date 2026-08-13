import Link from "next/link";
import { db } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { listAllProjects } from "@/db/projects";
import { listOpenTasksWithContext } from "@/db/tasks";
import { bucketTasksByDueDate, projectsMissingNextAction, todayInMexicoCity, addDays } from "@/lib/my-actions";
import { labelOf, STAGE_GROUPS } from "@/lib/project-pipeline";
import { GROUP_DOT } from "@/lib/dashboard-display";
import { ActionsList } from "@/components/my-actions/actions-list";

export const dynamic = "force-dynamic";

export default async function MyActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const mine = scope === "mine";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projects = await listAllProjects(db, { archived: false });
  const allTasks = await listOpenTasksWithContext(db);
  const today = todayInMexicoCity();

  const tasks = mine && user ? allTasks.filter((t) => t.ownerUserId === user.id) : allTasks;

  const { overdue, dueToday, upcoming } = bucketTasksByDueDate(tasks, today, 7);
  const weekEnd = addDays(today, 7);
  const later = tasks.filter((t) => t.dueDate > weekEnd);

  const missing = projectsMissingNextAction(projects, allTasks);

  // Conteo de acciones mostradas por grupo de pipeline (para el rail).
  const byGroup = new Map<string, number>();
  for (const t of tasks) byGroup.set(t.stageGroup, (byGroup.get(t.stageGroup) ?? 0) + 1);
  const groupRows = STAGE_GROUPS.map((g) => ({ group: g.value, label: g.label, n: byGroup.get(g.value) ?? 0 })).filter(
    (r) => r.n > 0
  );

  return (
    <main className="flex min-w-0 flex-col">
      {/* Topbar */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 md:px-8">
        <div>
          <div className="eyebrow text-solar-ink">Recordatorios · derivados de cada proyecto</div>
          <h1 className="mt-0.5 font-display text-[2.05rem] font-bold leading-none tracking-display">
            Siguientes acciones
          </h1>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-line-strong text-[0.82rem] font-semibold">
          <Link href="/my-actions?scope=mine" className={`px-3.5 py-2 transition-colors ${mine ? "bg-ink text-background" : "text-muted hover:text-ink"}`}>
            Mías
          </Link>
          <Link href="/my-actions" className={`px-3.5 py-2 transition-colors ${!mine ? "bg-ink text-background" : "text-muted hover:text-ink"}`}>
            Todo el equipo
          </Link>
        </div>
      </div>

      <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_300px]">
        {/* LIST */}
        <div className="px-5 py-6 md:px-8">
          <ActionsList overdue={overdue} dueToday={dueToday} thisWeek={upcoming} later={later} today={today} />
        </div>

        {/* RAIL */}
        <aside className="flex flex-col gap-5 border-t border-line bg-surface px-5 py-6 md:px-6 lg:border-l lg:border-t-0">
          {/* Proyectos sin acción */}
          <div
            className={`rounded-xl border p-4 ${
              missing.length > 0
                ? "border-[color-mix(in_oklch,var(--danger)_35%,var(--line))] bg-[color-mix(in_oklch,var(--danger-wash)_45%,var(--surface))]"
                : "border-line"
            }`}
          >
            <div className={`col-label mb-1.5 text-[0.72rem] ${missing.length > 0 ? "text-danger-ink" : "text-muted"}`}>
              Proyectos sin acción
            </div>
            <div className={`font-display text-[2.2rem] font-bold leading-none ${missing.length > 0 ? "text-danger-ink" : "text-ink"}`}>
              {missing.length}
            </div>
            <p className={`mt-1 text-[0.78rem] ${missing.length > 0 ? "text-danger-ink" : "text-muted"}`}>
              proyectos abiertos sin siguiente acción definida
            </p>
            {missing.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center justify-between gap-2 border-t border-dashed border-[color-mix(in_oklch,var(--danger)_25%,var(--line))] py-1.5 text-[0.8rem] hover:underline"
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 font-mono text-[0.66rem] text-danger-ink">{labelOf(STAGE_GROUPS, p.stageGroup)}</span>
              </Link>
            ))}
          </div>

          {/* Resumen por vencimiento */}
          <div className="rounded-xl border border-line p-4">
            <div className="col-label mb-2.5 text-[0.72rem] text-muted">Resumen</div>
            {[
              { k: "Vencidas", n: overdue.length, c: "var(--danger)" },
              { k: "Hoy", n: dueToday.length, c: "var(--solar)" },
              { k: "Esta semana", n: upcoming.length, c: "var(--storage)" },
              { k: "Más adelante", n: later.length, c: "var(--faint)" },
            ].map((r) => (
              <div key={r.k} className="flex items-center gap-2 py-1 text-[0.82rem]">
                <span className="size-2.5 rounded-[3px]" style={{ background: r.c }} />
                {r.k}
                <span className="ml-auto font-mono text-[0.8rem] text-muted">{r.n}</span>
              </div>
            ))}
          </div>

          {/* Por grupo de pipeline */}
          {groupRows.length > 0 ? (
            <div className="rounded-xl border border-line p-4">
              <div className="col-label mb-2.5 text-[0.72rem] text-muted">Por grupo</div>
              {groupRows.map((r) => (
                <div key={r.group} className="flex items-center gap-2 py-1 text-[0.82rem]">
                  <span className="size-2.5 rounded-full" style={{ background: GROUP_DOT[r.group] }} />
                  {r.label}
                  <span className="ml-auto font-mono text-[0.8rem] text-muted">{r.n}</span>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
