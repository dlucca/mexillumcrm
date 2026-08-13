import type { ReactNode } from "react";

// Tarjeta KPI del hero del dashboard. Cifra grande en Barlow Condensed;
// `alert` la tiñe de peligro cuando el número exige atención.
export function KpiCard({
  label,
  value,
  unit,
  sub,
  alert,
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-[1.05rem_1.15rem_1.15rem] ${
        alert
          ? "border-[color-mix(in_oklch,var(--danger)_35%,var(--line))] bg-[color-mix(in_oklch,var(--danger-wash)_55%,var(--surface))]"
          : "border-line bg-surface"
      }`}
    >
      <div className="col-label text-[0.625rem] text-muted">{label}</div>
      <div
        className={`mt-1.5 font-display text-[2.9rem] font-bold leading-none tracking-display tabular-nums ${
          alert ? "text-danger-ink" : "text-ink"
        }`}
      >
        {value}
        {unit ? <span className="ml-0.5 text-lg font-semibold text-muted">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-2 font-mono text-xs">{sub}</div> : null}
    </div>
  );
}
