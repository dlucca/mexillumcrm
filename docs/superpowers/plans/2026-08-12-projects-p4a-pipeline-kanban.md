# Projects P4a — Pipeline Kanban (board + selector) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un board Kanban en `/pipeline` con 6 columnas (stage_groups), cards con selector de etapa que dispara la transición completa (stage_change + momentos + auto-status), totales por grupo, y next action por card; más el link "Pipeline" en la nav.

**Architecture:** Se extrae la lógica de transición de etapa de `runUpdateProject` a un helper compartido (`recordStageTransition`) y se agrega `runMoveProjectStage` (mueve solo la etapa). Lógica pura de agrupación (`lib/pipeline.ts`). El board reutiliza `listAllProjects` + `listOpenTasksWithContext`. UI: página server + card server + un `<select>` client que llama una server action.

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle ORM (Postgres/Supabase, PGlite en tests), Zod, Vitest, Tailwind v4.

## Global Constraints

- **TDD siempre**: test primero, verlo fallar, implementar mínimo, verlo pasar, commit.
- **Sin migración, sin schema change, sin tabla nueva.**
- **El refactor NO cambia el comportamiento de `runUpdateProject`**: sus 12 tests existentes deben seguir verdes tras extraer `recordStageTransition`.
- **`runMoveProjectStage` dispara idéntica transición de P2b**: auto-status (won/active_customer, limpiando lostReason/lostReasonNote), `stage_change` inmutable, momento comercial si aplica. Todo en `db.transaction`.
- **Enums = constantes + `text`** (STAGE_VALUES ya existe). `stageGroup` siempre derivado con `stageGroupFor` (nunca a mano).
- **UI copy en español.** Board muestra TODOS los proyectos no archivados (lost/paused/won/active_customer con badge).
- **Postura de seguridad (sin cambios)**: board sin filtro de ownership; `runMoveProjectStage` scopea por `id`. RLS deny-all. Se cierra con el slice de RLS.
- **Tests**: focalizados `npm test -- <patrón>` (fiables). Suite completa flaky por PGlite file-parallelism → `npm test -- --no-file-parallelism`.

---

### Task 1: `stageMoveSchema` (`lib/validation.ts`)

**Files:**
- Modify: `lib/validation.ts` (añadir schema + tipo al final)
- Test: `test/validation.test.ts` (añadir describe)

**Interfaces:**
- Produces: `stageMoveSchema` (`{ projectId: uuid; stage: STAGE_VALUES }`), `type StageMoveInput`.

- [ ] **Step 1: Write the failing test**

Añadir a `test/validation.test.ts`:

```ts
import { stageMoveSchema } from "@/lib/validation";

describe("stageMoveSchema", () => {
  const pid = "11111111-1111-1111-8111-111111111111";
  it("acepta projectId uuid + stage válida", () => {
    const r = stageMoveSchema.safeParse({ projectId: pid, stage: "propuesta_enviada" });
    expect(r.success).toBe(true);
  });
  it("rechaza stage inválida", () => {
    expect(stageMoveSchema.safeParse({ projectId: pid, stage: "nope" }).success).toBe(false);
  });
  it("rechaza projectId no-uuid", () => {
    expect(stageMoveSchema.safeParse({ projectId: "x", stage: "propuesta_enviada" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- validation`
Expected: FAIL (no export `stageMoveSchema`).

- [ ] **Step 3: Implement en `lib/validation.ts`**

Añadir al final del archivo (usa el `requiredEnum` interno ya presente y `STAGE_VALUES` ya importado arriba):

```ts
export const stageMoveSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  stage: requiredEnum(STAGE_VALUES, "Etapa inválida"),
});

export type StageMoveInput = z.infer<typeof stageMoveSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- validation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts test/validation.test.ts
git commit -m "feat: stageMoveSchema (projectId uuid + stage válida)"
```

---

### Task 2: Lógica pura del pipeline (`lib/pipeline.ts`)

**Files:**
- Create: `lib/pipeline.ts`
- Test: `test/pipeline.test.ts`

**Interfaces:**
- Consumes: `STAGE_GROUPS` de `@/lib/project-pipeline`.
- Produces:
  - `type PipelineColumn<P> = { group: string; label: string; projects: P[]; count: number; totalValue: number }`
  - `groupProjectsByStageGroup<P extends { stageGroup: string; estimatedValue: number | null }>(projects: P[]): PipelineColumn<P>[]`
  - `nextActionByProject<T extends { projectId: string }>(openTasks: T[]): Map<string, T>`

- [ ] **Step 1: Write the failing test**

Create `test/pipeline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupProjectsByStageGroup, nextActionByProject } from "@/lib/pipeline";

describe("groupProjectsByStageGroup", () => {
  it("devuelve 6 columnas en orden, con counts y totals; incluye vacías", () => {
    const projects = [
      { stageGroup: "lead", estimatedValue: 100 },
      { stageGroup: "lead", estimatedValue: null },
      { stageGroup: "commercial", estimatedValue: 500 },
    ];
    const cols = groupProjectsByStageGroup(projects);
    expect(cols.map((c) => c.group)).toEqual(["lead", "qualification", "solution", "commercial", "delivery", "active"]);
    const lead = cols.find((c) => c.group === "lead")!;
    expect(lead.count).toBe(2);
    expect(lead.totalValue).toBe(100); // null cuenta como 0
    const commercial = cols.find((c) => c.group === "commercial")!;
    expect(commercial.count).toBe(1);
    expect(commercial.totalValue).toBe(500);
    const qualification = cols.find((c) => c.group === "qualification")!;
    expect(qualification.count).toBe(0); // vacía presente
  });
});

describe("nextActionByProject", () => {
  it("toma la primera task abierta por projectId (orden de entrada)", () => {
    const map = nextActionByProject([
      { projectId: "p1", title: "a" },
      { projectId: "p1", title: "b" },
      { projectId: "p2", title: "c" },
    ]);
    expect(map.get("p1")?.title).toBe("a");
    expect(map.get("p2")?.title).toBe("c");
    expect(map.has("p3")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pipeline`
Expected: FAIL (módulo `@/lib/pipeline` no existe).

- [ ] **Step 3: Implement `lib/pipeline.ts`**

```ts
import { STAGE_GROUPS } from "@/lib/project-pipeline";

export type PipelineColumn<P> = {
  group: string;
  label: string;
  projects: P[];
  count: number;
  totalValue: number;
};

export function groupProjectsByStageGroup<
  P extends { stageGroup: string; estimatedValue: number | null }
>(projects: P[]): PipelineColumn<P>[] {
  return STAGE_GROUPS.map((g) => {
    const inGroup = projects.filter((p) => p.stageGroup === g.value);
    return {
      group: g.value,
      label: g.label,
      projects: inGroup,
      count: inGroup.length,
      totalValue: inGroup.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0),
    };
  });
}

export function nextActionByProject<T extends { projectId: string }>(
  openTasks: T[]
): Map<string, T> {
  const map = new Map<string, T>();
  for (const t of openTasks) if (!map.has(t.projectId)) map.set(t.projectId, t);
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pipeline`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline.ts test/pipeline.test.ts
git commit -m "feat: lib/pipeline (groupProjectsByStageGroup, nextActionByProject)"
```

---

### Task 3: `recordStageTransition` (extracción) + `runMoveProjectStage` (`lib/project-mutations.ts`)

**Files:**
- Modify: `lib/project-mutations.ts`
- Test: `test/project-mutations.test.ts` (añadir describe; añadir import)

**Interfaces:**
- Consumes: `stageMoveSchema` de `@/lib/validation` (Task 1); `autoStatusForStage`/`stageGroupFor` (ya importados); `activityLog`/`projects`/`activities`/`eq` (ya importados).
- Produces: `runMoveProjectStage(db, formData, actorUserId = null): Promise<ActionResult>`; helper interno `recordStageTransition`.

- [ ] **Step 1: Write the failing tests**

Añadir a `test/project-mutations.test.ts`. Al tope, añadir `runMoveProjectStage` al import existente de `@/lib/project-mutations`:

```ts
import { runCreateProject, runUpdateProject, runMoveProjectStage } from "@/lib/project-mutations";
```

Añadir un nuevo `describe` (usa `formOf`, `createCompany`, `createTestDb`, `listProjects`, `listAllProjects`, `listActivitiesForProject` ya importados):

```ts
describe("runMoveProjectStage", () => {
  async function seed() {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    await runCreateProject(db, formOf({ companyId: company.id, name: "P" }), null);
    const [row] = await listProjects(db, company.id);
    return { db, company, id: row.id }; // arranca en lead_sin_contactar
  }

  it("cambia stage + stageGroup y registra 1 stage_change", async () => {
    const { db, id } = await seed();
    const res = await runMoveProjectStage(db, formOf({ projectId: id, stage: "outreach_enviado" }), "22222222-2222-2222-2222-222222222222");
    expect(res).toEqual({ ok: true });
    const [p] = await listAllProjects(db);
    expect(p.stage).toBe("outreach_enviado");
    expect(p.stageGroup).toBe("qualification");
    const acts = (await listActivitiesForProject(db, id)).filter((a) => a.type === "stage_change");
    expect(acts).toHaveLength(1);
    expect(acts[0].userId).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("entrar a propuesta_enviada registra el momento proposal/sent", async () => {
    const { db, id } = await seed();
    await runMoveProjectStage(db, formOf({ projectId: id, stage: "propuesta_enviada" }), null);
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "proposal");
    expect(moments).toHaveLength(1);
    expect(moments[0].metadata).toEqual({ moment: "sent" });
  });

  it("entrar a contrato_firmado fuerza won + momento contract/signed", async () => {
    const { db, id } = await seed();
    await runMoveProjectStage(db, formOf({ projectId: id, stage: "contrato_firmado" }), null);
    const [p] = await listAllProjects(db);
    expect(p.status).toBe("won");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "contract");
    expect(moments[0].metadata).toEqual({ moment: "signed" });
  });

  it("misma etapa → no-op sin activities de transición", async () => {
    const { db, id } = await seed();
    await runMoveProjectStage(db, formOf({ projectId: id, stage: "lead_sin_contactar" }), null);
    const acts = (await listActivitiesForProject(db, id)).filter((a) => a.type === "stage_change");
    expect(acts).toHaveLength(0);
  });

  it("project inexistente → error", async () => {
    const { db } = await seed();
    const res = await runMoveProjectStage(db, formOf({ projectId: "00000000-0000-0000-0000-000000000000", stage: "outreach_enviado" }), null);
    expect(res).toEqual({ ok: false, error: "No se encontró el proyecto" });
  });

  it("stage inválida → error", async () => {
    const { db, id } = await seed();
    const res = await runMoveProjectStage(db, formOf({ projectId: id, stage: "nope" }), null);
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- project-mutations`
Expected: FAIL (no export `runMoveProjectStage`).

- [ ] **Step 3: Refactor + implement en `lib/project-mutations.ts`**

Añadir el import de `stageMoveSchema`:

```ts
import { projectCreateSchema, projectUpdateSchema, stageMoveSchema } from "@/lib/validation";
```

Añadir, después de los imports (antes de `runCreateProject`), el tipo `Tx` y el helper:

```ts
type Tx = Parameters<Parameters<AnyDb["transaction"]>[0]>[0];

// Registra la transición de etapa: stage_change (inmutable) + momento comercial si la etapa
// destino es gatillo (§8.3). Se llama SOLO en una transición real (from !== to).
async function recordStageTransition(
  tx: Tx,
  args: {
    companyId: string;
    projectId: string;
    fromStage: string;
    toStage: string;
    actorUserId: string | null;
  }
): Promise<void> {
  await tx.insert(activities).values({
    companyId: args.companyId,
    projectId: args.projectId,
    userId: args.actorUserId,
    type: "stage_change",
    direction: "none",
    subject: null,
    body: null,
    source: "system",
    metadata: activityLog.stageChangeMetadata(args.fromStage, args.toStage),
  });
  const moment = activityLog.commercialMomentForStage(args.toStage);
  if (moment) {
    await tx.insert(activities).values({
      companyId: args.companyId,
      projectId: args.projectId,
      userId: args.actorUserId,
      type: moment.type,
      direction: "none",
      subject: null,
      body: null,
      source: "system",
      metadata: { moment: moment.moment },
    });
  }
}
```

En `runUpdateProject`, reemplazar el bloque `if (isEntry) { ...los dos tx.insert... }` (actualmente líneas ~117-143) por:

```ts
      if (isEntry) {
        await recordStageTransition(tx, {
          companyId: current.companyId,
          projectId: id,
          fromStage: current.stage,
          toStage: fields.stage,
          actorUserId,
        });
      }
```

Añadir al final del archivo `runMoveProjectStage`:

```ts
export async function runMoveProjectStage(
  db: AnyDb,
  formData: FormData,
  actorUserId: string | null = null
): Promise<ActionResult> {
  const parsed = stageMoveSchema.safeParse({
    projectId: formData.get("projectId"),
    stage: formData.get("stage"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { projectId, stage } = parsed.data;
  try {
    return await db.transaction(async (tx): Promise<ActionResult> => {
      const [current] = await tx
        .select({ stage: projects.stage, companyId: projects.companyId })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      if (!current) return { ok: false, error: "No se encontró el proyecto" };
      if (current.stage === stage) return { ok: true };

      const autoStatus = autoStatusForStage(stage);
      const updateSet = autoStatus
        ? { stage, stageGroup: stageGroupFor(stage), status: autoStatus, lostReason: null, lostReasonNote: null }
        : { stage, stageGroup: stageGroupFor(stage) };
      await tx.update(projects).set(updateSet).where(eq(projects.id, projectId));
      await recordStageTransition(tx, {
        companyId: current.companyId,
        projectId,
        fromStage: current.stage,
        toStage: stage,
        actorUserId,
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "No se pudo mover la etapa" };
  }
}
```

Nota: si el tipo `Tx` (extracción con `Parameters<...>`) no compilara en este entorno de Drizzle, definir `recordStageTransition` con el mismo cuerpo pero tipando `tx` de forma equivalente (p.ej. reusando el tipo del callback de `db.transaction`). No debilitar la lógica.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- project-mutations`
Expected: PASS — los 6 casos nuevos de `runMoveProjectStage` **y** los 12 existentes de `runCreateProject`/`runUpdateProject` (el refactor no cambia comportamiento).

- [ ] **Step 5: Commit**

```bash
git add lib/project-mutations.ts test/project-mutations.test.ts
git commit -m "feat: runMoveProjectStage + recordStageTransition compartido (mismo P2b que runUpdateProject)"
```

---

### Task 4: `moveStageAction` (`app/projects/actions.ts`)

**Files:**
- Modify: `app/projects/actions.ts`
- Test: (sin unit test; verificación por lint aquí + build en Task 5)

**Interfaces:**
- Consumes: `runMoveProjectStage` de `@/lib/project-mutations`; `createClient`, `db`, `idSchema`, `revalidatePath` (ya en el archivo).
- Produces: `moveStageAction(formData): Promise<void>`.

- [ ] **Step 1: Modify `app/projects/actions.ts`**

Añadir `runMoveProjectStage` al import de mutations:

```ts
import { runCreateProject, runUpdateProject, runMoveProjectStage } from "@/lib/project-mutations";
```

Añadir al final del archivo:

```ts
export async function moveStageAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await runMoveProjectStage(db, formData, user?.id ?? null);
  revalidatePath("/pipeline");
  const projectId = idSchema.safeParse(formData.get("projectId"));
  if (projectId.success) revalidatePath(`/projects/${projectId.data}`);
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores en `app/projects/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/projects/actions.ts
git commit -m "feat: moveStageAction (mueve la etapa desde el pipeline)"
```

---

### Task 5: UI del board + nav (`/pipeline`)

**Files:**
- Create: `components/card-stage-select.tsx`
- Create: `components/project-card.tsx`
- Create: `app/pipeline/page.tsx`
- Modify: `components/nav.tsx` (añadir Pipeline)
- Test: (verificación por `npm run build` + `lint`)

**Interfaces:**
- Consumes: `moveStageAction` (`@/app/projects/actions`); `listAllProjects`/`ProjectListRow` (`@/db/projects`); `listOpenTasksWithContext` (`@/db/tasks`); `groupProjectsByStageGroup`/`nextActionByProject` (`@/lib/pipeline`); `STAGES`/`STAGE_GROUPS`/`stageGroupFor`/`labelOf`/`formatMXN`/`SOLUTION_TYPES`/`STATUSES` (`@/lib/project-pipeline`).

- [ ] **Step 1: Create `components/card-stage-select.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { STAGES, STAGE_GROUPS, stageGroupFor } from "@/lib/project-pipeline";
import { moveStageAction } from "@/app/projects/actions";

export function CardStageSelect({ projectId, stage }: { projectId: string; stage: string }) {
  const router = useRouter();

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStage = e.target.value;
    if (newStage === stage) return;
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("stage", newStage);
    await moveStageAction(fd);
    router.refresh();
  }

  return (
    <select
      defaultValue={stage}
      onChange={onChange}
      className="w-full rounded-md border px-2 py-1 text-xs"
    >
      {STAGE_GROUPS.map((g) => (
        <optgroup key={g.value} label={g.label}>
          {STAGES.filter((s) => stageGroupFor(s.value) === g.value).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Create `components/project-card.tsx`**

```tsx
import Link from "next/link";
import type { ProjectListRow } from "@/db/projects";
import { labelOf, formatMXN, SOLUTION_TYPES, STATUSES } from "@/lib/project-pipeline";
import { CardStageSelect } from "@/components/card-stage-select";

export function ProjectCard({
  project,
  nextActionTitle,
}: {
  project: ProjectListRow;
  nextActionTitle: string | null;
}) {
  return (
    <div className="rounded-md border bg-white p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/projects/${project.id}`} className="font-medium underline">
          {project.name}
        </Link>
        {project.status !== "open" && (
          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
            {labelOf(STATUSES, project.status)}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {project.companyName}
        {project.plantName ? ` · ${project.plantName}` : ""}
      </p>
      <p className="text-xs text-neutral-500">
        {labelOf(SOLUTION_TYPES, project.solutionType)} · {formatMXN(project.estimatedValue)}
      </p>
      <p className="mt-1 text-xs">
        {nextActionTitle ? `▸ ${nextActionTitle}` : "sin próxima acción"}
      </p>
      <div className="mt-2">
        <CardStageSelect projectId={project.id} stage={project.stage} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/pipeline/page.tsx`**

```tsx
import { db } from "@/db/client";
import { listAllProjects } from "@/db/projects";
import { listOpenTasksWithContext } from "@/db/tasks";
import { groupProjectsByStageGroup, nextActionByProject } from "@/lib/pipeline";
import { formatMXN } from "@/lib/project-pipeline";
import { ProjectCard } from "@/components/project-card";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const projects = await listAllProjects(db, { archived: false });
  const openTasks = await listOpenTasksWithContext(db);
  const columns = groupProjectsByStageGroup(projects);
  const nextAction = nextActionByProject(openTasks);

  return (
    <main className="p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">Pipeline</h1>
      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.group} className="w-72 shrink-0">
            <div className="flex items-baseline justify-between border-b pb-2">
              <h2 className="font-display font-bold text-lg tracking-display">{col.label}</h2>
              <span className="text-xs text-neutral-500">
                {col.count} · {formatMXN(col.totalValue)}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {col.projects.length === 0 ? (
                <p className="text-xs text-neutral-400">—</p>
              ) : (
                col.projects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    nextActionTitle={nextAction.get(p.id)?.title ?? null}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add Pipeline to `components/nav.tsx`**

Reemplazar el array `links`:

```ts
const links = [
  { href: "/my-actions", label: "My Actions" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/projects", label: "Proyectos" },
  { href: "/companies", label: "Empresas" },
];
```

- [ ] **Step 5: Build + lint**

Run: `npm run build && npm run lint`
Expected: build OK (ruta `/pipeline` dinámica), lint limpio.

- [ ] **Step 6: Manual verification (opcional)**

`npm run dev`, entrar a `/pipeline`: 6 columnas con conteo + total MXN; las cards muestran empresa/planta/solución/valor/next action/badge; cambiar la etapa en el selector de una card la mueve de columna y (si aplica) dispara el momento/won — visible al abrir el detalle (timeline + status).

- [ ] **Step 7: Commit**

```bash
git add components/card-stage-select.tsx components/project-card.tsx app/pipeline/page.tsx components/nav.tsx
git commit -m "feat: board /pipeline (6 columnas, cards con selector) + link en nav"
```

---

### Task 6: Verificación final de rama

**Files:** ninguno (verificación).

- [ ] **Step 1: Suite completa + build + lint**

Run: `npm test -- --no-file-parallelism && npm run build && npm run lint`
Expected: todo verde (incluye los 12 tests de `runUpdateProject` intactos tras el refactor).

- [ ] **Step 2: Confirmar sin drift de schema**

Run: `npm run db:generate`
Expected: "No schema changes, nothing to migrate" (P4a no toca el schema; NO debe generar 0006).

---

## Self-Review

**Spec coverage (spec §→task):**
- §1 refactor `recordStageTransition` + `runMoveProjectStage` + `stageMoveSchema` → Task 1 (schema) + Task 3 (glue). ✓
- §2 lógica pura (`groupProjectsByStageGroup`, `nextActionByProject`) → Task 2. ✓
- §3 datos (reutilización) → Task 5 (uso). ✓
- §4 UI (page, ProjectCard, CardStageSelect) → Task 5. ✓
- §5 server action + nav → Task 4 (action) + Task 5 (nav). ✓
- §6 tests → puros (T2), glue+regresión (T3), schema (T1), UI/build (T5). ✓
- §7 postura de seguridad (sin cambios) → ninguna task la toca; Task 6 confirma sin drift. ✓

**Placeholder scan:** sin TBD/TODO; todos los pasos con código o comando exacto. ✓

**Type consistency:** `stageMoveSchema` (T1) consumido por `runMoveProjectStage` (T3); `PipelineColumn`/`groupProjectsByStageGroup` (T2) recibe `ProjectListRow` (tiene stageGroup/estimatedValue) y consumido por la página (T5); `nextActionByProject` (T2) recibe `OpenTaskRow` (tiene projectId/title); `moveStageAction` (T4) consumido por `CardStageSelect` (T5); `recordStageTransition` (T3) usado por `runUpdateProject` y `runMoveProjectStage`. ✓

**Nota de riesgo:** el refactor de `runUpdateProject` (extraer `recordStageTransition`) es el punto sensible — se valida con los 12 tests existentes (deben seguir verdes). El tipo `Tx` por extracción `Parameters<...>` es lo único que podría requerir un ajuste de tipado local; documentado en Task 3.
