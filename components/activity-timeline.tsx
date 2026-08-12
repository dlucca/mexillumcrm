import type { Activity } from "@/db/schema";
import { activityHeadline, activityTypeLabel, formatDateTime } from "@/lib/activity-log";

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="mt-4 text-sm text-neutral-500">Sin actividad todavía.</p>;
  }
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {activities.map((a) => (
        <li key={a.id} className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-sm">{activityTypeLabel(a.type)}</span>
            <span className="text-neutral-500 text-xs">{formatDateTime(a.occurredAt)}</span>
          </div>
          <p className="mt-1 text-sm">{activityHeadline(a)}</p>
        </li>
      ))}
    </ul>
  );
}
