import Link from "next/link";
import type { OpenTaskRow } from "@/db/tasks";
import { formatDueDate } from "@/lib/tasks";

function TaskRow({ t }: { t: OpenTaskRow }) {
  return (
    <li>
      <Link
        href={`/projects/${t.projectId}`}
        className="flex items-center justify-between gap-3 rounded-md border border-line px-4 py-2 hover:bg-surface-2"
      >
        <span className="text-sm">
          <span className="font-medium">{t.title}</span> · {t.companyName} — {t.projectName}
        </span>
        <span className="text-xs text-muted">vence {formatDueDate(t.dueDate)}</span>
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
          tone === "alert" ? "text-solar-ink" : ""
        }`}
      >
        {title}
      </h2>
      {tasks.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
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

export function MyActionsPanel({
  overdue,
  dueToday,
  upcoming,
  missing,
}: {
  overdue: OpenTaskRow[];
  dueToday: OpenTaskRow[];
  upcoming: OpenTaskRow[];
  missing: { id: string; name: string; companyName: string }[];
}) {
  return (
    <div>
      <TaskSection title="⚠ Vencidas" tasks={overdue} empty="Nada vencido." tone="alert" />
      <TaskSection title="Hoy" tasks={dueToday} empty="Nada para hoy." />
      <TaskSection title="Próximas (7 días)" tasks={upcoming} empty="Nada próximo." />
      <section className="mt-8">
        <h2 className="font-display font-bold text-2xl tracking-display">Sin próxima acción</h2>
        {missing.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Todos los proyectos abiertos tienen próxima acción.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {missing.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-line px-4 py-2 hover:bg-surface-2"
                >
                  <span className="text-sm">
                    <span className="font-medium">{p.name}</span> · {p.companyName}
                  </span>
                  <span className="text-xs text-solar-ink">sin próxima acción</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
