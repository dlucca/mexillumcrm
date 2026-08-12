import type { Task } from "@/db/schema";
import { completeTaskAction } from "@/app/projects/actions";
import { formatDueDate } from "@/lib/tasks";

export function TaskList({
  tasks,
  projectId,
  archived,
}: {
  tasks: Task[];
  projectId: string;
  archived: boolean;
}) {
  if (tasks.length === 0) {
    return <p className="mt-4 text-sm text-neutral-500">Sin tareas todavía.</p>;
  }
  const open = tasks.filter((t) => t.completedAt == null);
  const done = tasks.filter((t) => t.completedAt != null);
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {open.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 rounded-md border px-4 py-2">
          <span className="text-sm">
            <span className="font-medium">{t.title}</span> — vence {formatDueDate(t.dueDate)}
          </span>
          {!archived && (
            <form action={completeTaskAction}>
              <input type="hidden" name="taskId" value={t.id} />
              <input type="hidden" name="projectId" value={projectId} />
              <button className="text-sm underline">Completar</button>
            </form>
          )}
        </li>
      ))}
      {done.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 rounded-md border px-4 py-2 text-neutral-400">
          <span className="text-sm line-through">
            {t.title} — venció {formatDueDate(t.dueDate)}
          </span>
          <span className="text-xs">Completada</span>
        </li>
      ))}
    </ul>
  );
}
