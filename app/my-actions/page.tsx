import Link from "next/link";
import { db } from "@/db/client";
import { listOpenTasksWithContext, type OpenTaskRow } from "@/db/tasks";
import { listAllProjects } from "@/db/projects";
import { formatDueDate } from "@/lib/tasks";
import {
  todayInMexicoCity,
  bucketTasksByDueDate,
  projectsMissingNextAction,
} from "@/lib/my-actions";

export const dynamic = "force-dynamic";

function TaskRow({ t }: { t: OpenTaskRow }) {
  return (
    <li>
      <Link
        href={`/projects/${t.projectId}`}
        className="flex items-center justify-between gap-3 rounded-md border px-4 py-2 hover:bg-neutral-50"
      >
        <span className="text-sm">
          <span className="font-medium">{t.title}</span> · {t.companyName} — {t.projectName}
        </span>
        <span className="text-xs text-neutral-500">vence {formatDueDate(t.dueDate)}</span>
      </Link>
    </li>
  );
}

function TaskSection({
  title,
  tasks,
  empty,
  tone,
}: {
  title: string;
  tasks: OpenTaskRow[];
  empty: string;
  tone?: "alert";
}) {
  return (
    <section className="mt-8">
      <h2
        className={`font-display font-bold text-2xl tracking-display ${
          tone === "alert" ? "text-amber-700" : ""
        }`}
      >
        {title}
      </h2>
      {tasks.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {tasks.map((t) => (
            <TaskRow key={t.id} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function MyActionsPage() {
  const openTasks = await listOpenTasksWithContext(db);
  const activeProjects = await listAllProjects(db, { archived: false });
  const today = todayInMexicoCity();
  const { overdue, dueToday, upcoming } = bucketTasksByDueDate(openTasks, today, 7);
  const missing = projectsMissingNextAction(activeProjects, openTasks);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">My Actions</h1>

      <TaskSection title="⚠ Vencidas" tasks={overdue} empty="Nada vencido." tone="alert" />
      <TaskSection title="Hoy" tasks={dueToday} empty="Nada para hoy." />
      <TaskSection title="Próximas (7 días)" tasks={upcoming} empty="Nada próximo." />

      <section className="mt-8">
        <h2 className="font-display font-bold text-2xl tracking-display">Sin próxima acción</h2>
        {missing.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Todos los proyectos abiertos tienen próxima acción.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {missing.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border px-4 py-2 hover:bg-neutral-50"
                >
                  <span className="text-sm">
                    <span className="font-medium">{p.name}</span> · {p.companyName}
                  </span>
                  <span className="text-xs text-amber-700">sin próxima acción</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
