import type { Task } from "@/db/schema";

// La "próxima acción" de un Project = la Task abierta (completed_at == null) con due_date
// más próximo. null si no hay ninguna abierta. due_date es YYYY-MM-DD (ordena como string).
export function nextActionTask(tasks: Task[]): Task | null {
  const open = tasks.filter((t) => t.completedAt == null);
  if (open.length === 0) return null;
  return open.reduce((soonest, t) => (t.dueDate < soonest.dueDate ? t : soonest));
}

const dueDateFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

export function formatDueDate(dueDate: string): string {
  // T00:00:00 (hora local) evita el corrimiento de zona de `new Date("YYYY-MM-DD")` (UTC).
  return dueDateFormatter.format(new Date(`${dueDate}T00:00:00`));
}
