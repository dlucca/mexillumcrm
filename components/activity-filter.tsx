"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ACTIVITY_TYPES } from "@/lib/activity-log";

export function ActivityFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("activityType") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) params.set("activityType", e.target.value);
    else params.delete("activityType");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-neutral-500">Filtrar:</span>
      <select value={current} onChange={onChange} className="rounded-md border px-2 py-1">
        <option value="">Todos</option>
        {ACTIVITY_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
