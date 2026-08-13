import Link from "next/link";
import type { Task, Contact, Project } from "@/db/schema";
import { completeTaskAction } from "@/app/projects/actions";
import { labelOf, SOLUTION_TYPES, formatMXN } from "@/lib/project-pipeline";
import { formatUSD, MXN_PER_USD } from "@/lib/currency";
import { formatDueDate } from "@/lib/tasks";
import { formatDateTime } from "@/lib/activity-log";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const two = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return two.toUpperCase() || "—";
}

export function NextActionCard({
  task,
  projectId,
  today,
  archived,
}: {
  task: Task | null;
  projectId: string;
  today: string;
  archived: boolean;
}) {
  if (!task) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="col-label mb-2 text-[0.72rem] text-solar-ink">Siguiente acción</div>
        <p className="text-sm text-muted">Sin próxima acción. Agrega una tarea abajo para no perder el hilo.</p>
      </div>
    );
  }
  const over = task.dueDate < today;
  return (
    <div className="rounded-2xl border border-[color-mix(in_oklch,var(--solar)_30%,var(--line))] bg-[color-mix(in_oklch,var(--solar-wash)_55%,var(--surface))] p-4">
      <div className="col-label mb-2 text-[0.72rem] text-solar-ink">Siguiente acción</div>
      <div className="text-[0.98rem] font-semibold">{task.title}</div>
      <div className="mt-1 flex items-center gap-2 text-[0.78rem]">
        <span
          className={`rounded-[5px] px-1.5 py-0.5 font-mono text-[0.68rem] font-medium ${
            over ? "bg-danger text-white" : "bg-solar text-on-solar"
          }`}
        >
          {over ? "Vencía " : "Vence "}
          {formatDueDate(task.dueDate)}
        </span>
      </div>
      {!archived ? (
        <form action={completeTaskAction} className="mt-3">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="projectId" value={projectId} />
          <button className="w-full rounded-lg bg-solar px-3 py-2 text-[0.8rem] font-semibold text-on-solar transition-colors hover:bg-solar-strong">
            Marcar hecho
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function ContactsCard({ contacts, companyId }: { contacts: Contact[]; companyId: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="col-label mb-2.5 flex items-center gap-1.5 text-[0.72rem] text-muted">
        Contactos · {contacts.length}
        <Link href={`/companies/${companyId}`} className="ml-auto text-[0.72rem] font-semibold normal-case tracking-normal text-storage-ink hover:underline">
          Ver empresa →
        </Link>
      </div>
      {contacts.length === 0 ? (
        <p className="text-[0.8rem] text-muted">Sin contactos en la empresa.</p>
      ) : (
        contacts.slice(0, 5).map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 py-1.5">
            <span className="grid size-[30px] shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 font-display text-[0.7rem] font-bold text-muted">
              {initials(c.name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[0.84rem] font-medium">{c.name}</div>
              {c.role ? <div className="truncate text-[0.7rem] text-muted">{c.role}</div> : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-line py-1.5 text-[0.82rem] last:border-b-0">
      <span className="text-muted">{k}</span>
      <span className={`font-medium ${mono ? "font-mono tabular-nums" : ""}`}>{v}</span>
    </div>
  );
}

export function DetailsCard({
  project,
  companyName,
  lastActivityAt,
}: {
  project: Project;
  companyName: string;
  lastActivityAt: Date | null;
}) {
  const loc = [project.city, project.state].filter(Boolean).join(", ") || "—";
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="col-label mb-2 text-[0.72rem] text-muted">Detalles</div>
      <Row k="Empresa" v={companyName} />
      <Row k="Planta / ubicación" v={project.plantName ? `${project.plantName} · ${loc}` : loc} />
      <Row k="Solución" v={labelOf(SOLUTION_TYPES, project.solutionType)} />
      <Row k="Valor" v={`${formatUSD(project.estimatedValue)} USD`} mono />
      <Row k="Valor MXN" v={formatMXN(project.estimatedValue)} mono />
      <Row k="TC" v={`${MXN_PER_USD.toFixed(2)} MXN/USD`} mono />
      <Row k="Creado" v={formatDateTime(project.createdAt)} mono />
      <Row k="Últ. actividad" v={lastActivityAt ? formatDateTime(lastActivityAt) : "—"} mono />
    </div>
  );
}
