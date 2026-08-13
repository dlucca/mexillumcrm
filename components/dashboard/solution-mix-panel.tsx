import type { SolutionMixRow } from "@/lib/dashboard";
import { SOLUTION_COLOR } from "@/lib/dashboard-display";
import { formatUSDCompact } from "@/lib/currency";

// Mezcla de solución por valor: barra apilada + leyenda. Solo tipos con valor.
export function SolutionMixPanel({ rows }: { rows: SolutionMixRow[] }) {
  const visible = rows.filter((r) => r.value > 0);
  if (visible.length === 0) {
    return <p className="mt-2 text-sm text-muted">Aún sin valor estimado en el pipeline.</p>;
  }
  return (
    <div>
      <div className="mt-1 mb-3.5 flex h-3 overflow-hidden rounded-full">
        {visible.map((r) => (
          <span
            key={r.type}
            style={{ width: `${r.share * 100}%`, background: SOLUTION_COLOR[r.type] }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {visible.map((r) => (
          <div key={r.type} className="flex items-center gap-2 text-[0.82rem]">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: SOLUTION_COLOR[r.type] }}
            />
            {r.label}
            <span className="ml-auto font-mono text-[0.8rem] text-ink">
              {formatUSDCompact(r.value)}
            </span>
            <span className="w-9 text-right font-mono text-[0.72rem] text-faint">
              {Math.round(r.share * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
