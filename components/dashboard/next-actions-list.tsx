import Link from "next/link";
import type { OpenTaskRow } from "@/db/tasks";
import { addDays } from "@/lib/my-actions";

const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

function whenLabel(due: string, today: string): string {
  if (due < today) return due === addDays(today, -1) ? "Ayer" : shortDate.format(new Date(`${due}T00:00:00`));
  if (due === today) return "Hoy";
  return shortDate.format(new Date(`${due}T00:00:00`));
}

function Row({ t, today }: { t: OpenTaskRow; today: string }) {
  const over = t.dueDate < today;
  const isToday = t.dueDate === today;
  const bar = over ? "bg-danger" : isToday ? "bg-solar" : "bg-line-strong";
  return (
    <Link
      href={`/projects/${t.projectId}`}
      className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0 hover:bg-surface-2"
    >
      <span
        className={`w-[62px] shrink-0 text-right font-mono text-[0.72rem] ${
          over ? "font-medium text-danger-ink" : "text-muted"
        }`}
      >
        {whenLabel(t.dueDate, today)}
      </span>
      <span className={`w-[3px] self-stretch shrink-0 rounded ${bar}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.86rem] font-semibold">{t.title}</span>
        <span className="block truncate text-[0.74rem] text-muted">
          {t.projectName} · {t.companyName}
        </span>
      </span>
    </Link>
  );
}

export function NextActionsList({
  overdue,
  dueToday,
  upcoming,
  today,
  limit = 6,
}: {
  overdue: OpenTaskRow[];
  dueToday: OpenTaskRow[];
  upcoming: OpenTaskRow[];
  today: string;
  limit?: number;
}) {
  const rows = [...overdue, ...dueToday, ...upcoming].slice(0, limit);
  if (rows.length === 0) {
    return <p className="mt-2 text-sm text-muted">Sin acciones próximas. Todo al día. ✦</p>;
  }
  return (
    <div className="mt-1 flex flex-col">
      {rows.map((t) => (
        <Row key={t.id} t={t} today={today} />
      ))}
    </div>
  );
}
