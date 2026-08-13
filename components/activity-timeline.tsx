import type { Activity } from "@/db/schema";
import { activityHeadline, activityTypeLabel, formatDateTime } from "@/lib/activity-log";

// Color del nodo por tipo de actividad (temperatura del evento).
const ACT_COLOR: Record<string, string> = {
  stage_change: "var(--group-solution)",
  email: "var(--storage)",
  call: "var(--solar)",
  meeting: "var(--sol-both)",
  whatsapp: "var(--success)",
  note: "var(--faint)",
  task: "var(--solar)",
  diagnostic: "var(--pot-alto)",
  document: "var(--storage-ink)",
  proposal: "var(--group-commercial)",
  contract: "var(--group-delivery)",
  system: "var(--faint)",
};

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="py-3 text-sm text-muted">Sin actividad todavía.</p>;
  }
  return (
    <div className="relative pl-6">
      <span className="absolute bottom-1 left-[6px] top-1 w-0.5 bg-line" />
      {activities.map((a) => {
        const headline = activityHeadline(a);
        const typeLabel = activityTypeLabel(a.type);
        return (
          <div key={a.id} className="relative pb-4 last:pb-0">
            <span
              className="absolute -left-6 top-0.5 size-3.5 rounded-full border-2 border-surface"
              style={{ background: ACT_COLOR[a.type] ?? "var(--faint)" }}
            />
            <div className="flex items-baseline gap-2">
              <span className="text-[0.86rem] font-semibold">{headline || typeLabel}</span>
              <span className="ml-auto whitespace-nowrap font-mono text-[0.66rem] text-faint">
                {formatDateTime(a.occurredAt)}
              </span>
            </div>
            <div className="mt-0.5 text-[0.74rem] text-muted">
              {typeLabel}
              {a.subject ? ` · ${a.subject}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
