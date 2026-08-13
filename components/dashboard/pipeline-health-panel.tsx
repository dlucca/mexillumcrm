import type { PipelineHealth } from "@/lib/dashboard";

// Salud del pipeline: reparto de proyectos open por momentum / inactividad / riesgo.
export function PipelineHealthPanel({ health }: { health: PipelineHealth }) {
  const { total } = health;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const rows = [
    { label: "Con momentum", value: health.momentum, color: "var(--success)" },
    { label: "Sin actividad 7d+", value: health.stale, color: "var(--solar)" },
    { label: "Con tarea vencida", value: health.atRisk, color: "var(--danger)" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[0.82rem]">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
          {r.label}
          <span className="ml-auto font-mono text-[0.8rem] text-ink">{r.value}</span>
          <span className="w-9 text-right font-mono text-[0.72rem] text-faint">{pct(r.value)}%</span>
        </div>
      ))}
    </div>
  );
}
