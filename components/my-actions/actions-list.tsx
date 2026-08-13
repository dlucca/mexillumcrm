import Link from "next/link";
import type { OpenTaskRow } from "@/db/tasks";
import { completeTaskAction } from "@/app/projects/actions";
import { labelOf, STAGES } from "@/lib/project-pipeline";
import { GROUP_DOT, SOLUTION_BADGE, stageIndex } from "@/lib/dashboard-display";

const dueFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

function dueChip(due: string, today: string): { label: string; cls: string } {
  const d = dueFmt.format(new Date(`${due}T00:00:00`));
  if (due < today) return { label: `Venció ${d}`, cls: "bg-danger-wash text-danger-ink" };
  if (due === today) return { label: "Hoy", cls: "bg-solar-wash text-solar-ink" };
  return { label: d, cls: "bg-surface-2 text-muted" };
}

function ActionRow({ t, today }: { t: OpenTaskRow; today: string }) {
  const over = t.dueDate < today;
  const sol = SOLUTION_BADGE[t.solutionType] ?? SOLUTION_BADGE.unknown;
  const idx = stageIndex(t.stage);
  const chip = dueChip(t.dueDate, today);
  const groupColor = GROUP_DOT[t.stageGroup] ?? "var(--group-lead)";
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border bg-surface p-[0.75rem_0.85rem] ${
        over ? "border-[color-mix(in_oklch,var(--danger)_32%,var(--line))]" : "border-line"
      }`}
    >
      <form action={completeTaskAction} className="mt-0.5">
        <input type="hidden" name="taskId" value={t.id} />
        <input type="hidden" name="projectId" value={t.projectId} />
        <button
          type="submit"
          title="Marcar hecho"
          className="grid size-[19px] place-items-center rounded-md border-[1.5px] border-line-strong bg-surface text-transparent transition-colors hover:border-success hover:bg-success-wash hover:text-success-ink"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 8.5l3 3 7-8" />
          </svg>
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <Link href={`/projects/${t.projectId}`} className="text-[0.95rem] font-semibold leading-tight hover:underline">
          {t.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.76rem] text-muted">
          <span className="font-medium text-ink">
            {t.projectName} <span className="font-normal text-muted">· {t.companyName}</span>
          </span>
          <span
            className="whitespace-nowrap rounded-[5px] px-1.5 py-0.5 font-mono text-[0.6rem]"
            style={{ background: `color-mix(in oklch, ${groupColor} 13%, var(--surface))`, color: groupColor }}
          >
            {String(idx).padStart(2, "0")} · {labelOf(STAGES, t.stage)}
          </span>
          {t.solutionType !== "unknown" ? (
            <span className={`badge ${sol.className} text-[0.58rem]`}>{sol.label}</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[0.68rem] font-medium ${chip.cls}`}>
          {chip.label}
        </span>
        <Link href={`/projects/${t.projectId}`} className="text-[0.68rem] font-semibold text-storage-ink hover:underline">
          Ir al proyecto →
        </Link>
      </div>
    </div>
  );
}

function Group({
  label,
  tasks,
  today,
  tone,
}: {
  label: string;
  tasks: OpenTaskRow[];
  today: string;
  tone?: "over" | "today" | "muted";
}) {
  if (tasks.length === 0) return null;
  const glColor =
    tone === "over" ? "text-danger-ink" : tone === "today" ? "text-solar-ink" : tone === "muted" ? "text-muted" : "text-ink";
  return (
    <div className="mb-7 max-w-[820px]">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className={`col-label text-[0.8rem] ${glColor}`}>{label}</span>
        <span className="rounded-full bg-surface-2 px-1.5 font-mono text-[0.72rem] text-muted">{tasks.length}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <ActionRow key={t.id} t={t} today={today} />
        ))}
      </div>
    </div>
  );
}

export function ActionsList({
  overdue,
  dueToday,
  thisWeek,
  later,
  today,
}: {
  overdue: OpenTaskRow[];
  dueToday: OpenTaskRow[];
  thisWeek: OpenTaskRow[];
  later: OpenTaskRow[];
  today: string;
}) {
  const total = overdue.length + dueToday.length + thisWeek.length + later.length;
  if (total === 0) {
    return <p className="max-w-[820px] rounded-xl border border-line bg-surface p-6 text-sm text-muted">Nada pendiente. Todo al día. ✦</p>;
  }
  const todayLabel = `Hoy · ${dueFmt.format(new Date(`${today}T00:00:00`))}`;
  return (
    <div>
      <Group label="Vencidas" tasks={overdue} today={today} tone="over" />
      <Group label={todayLabel} tasks={dueToday} today={today} tone="today" />
      <Group label="Esta semana" tasks={thisWeek} today={today} />
      <Group label="Más adelante" tasks={later} today={today} tone="muted" />
    </div>
  );
}
