// "Hoy" como YYYY-MM-DD en America/Mexico_City (§15.2). now inyectable para tests.
export function todayInMexicoCity(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(now);
}

// Aritmética de fechas en UTC (evita corrimiento de zona). dateStr = YYYY-MM-DD.
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type DueBuckets<T> = { overdue: T[]; dueToday: T[]; upcoming: T[] };

// Bucketea por due_date contra `today`. upcoming = (today .. today+upcomingDays].
// Las de due_date fuera de la ventana no entran en ningún bucket.
export function bucketTasksByDueDate<T extends { dueDate: string }>(
  tasks: T[],
  today: string,
  upcomingDays = 7
): DueBuckets<T> {
  const upper = addDays(today, upcomingDays);
  const overdue: T[] = [];
  const dueToday: T[] = [];
  const upcoming: T[] = [];
  for (const t of tasks) {
    if (t.dueDate < today) overdue.push(t);
    else if (t.dueDate === today) dueToday.push(t);
    else if (t.dueDate <= upper) upcoming.push(t);
  }
  return { overdue, dueToday, upcoming };
}

// Cuenta tareas accionables ya (due_date <= today): vencidas + de hoy. Se usa para
// el badge de "Siguientes acciones" en el sidebar.
export function countOverdueAndToday<T extends { dueDate: string }>(
  tasks: T[],
  today: string
): number {
  let n = 0;
  for (const t of tasks) if (t.dueDate <= today) n++;
  return n;
}

// Projects `open` (no archivados) sin ninguna task abierta.
export function projectsMissingNextAction<P extends { id: string; status: string }>(
  openProjects: P[],
  openTasks: { projectId: string }[]
): P[] {
  const withOpenTask = new Set(openTasks.map((t) => t.projectId));
  return openProjects.filter((p) => p.status === "open" && !withOpenTask.has(p.id));
}
