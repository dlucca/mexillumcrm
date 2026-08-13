# Projects P4a — Pipeline Kanban (board + selector): Design

**Fecha:** 2026-08-12
**Slice:** Projects P4a (primer sub-slice de P4 — Pipeline, Opción C)
**PRD ancla:** §8.1 (13 etapas), §8.2 (6 grupos, Opción C), §8.3 (reglas de etapa), §11.3 (Pipeline UI), §11.2 (navegación)

## Contexto

El pipeline se organiza en 6 grupos (`stage_group`) como columnas de un Kanban; cada card
muestra su etapa precisa (de 13) y la cambia con un selector; el cambio dispara la misma
transición que P2a/P2b (stage_change + momentos comerciales + auto-status). §11.3 completo
incluye drag, filtros, búsqueda, totales por-etapa, "días desde última interacción",
owner y diagnóstico. Se descompone; **este spec cubre el espinazo P4a**: el board con
selector, sin drag.

### Decisiones de alcance (brainstorming)

- **Board + selector, sin drag** (drag → P4b). El selector de etapa de la card ya mueve la
  card entre columnas cuando la etapa elegida cambia de grupo.
- **Card completa construible:** Empresa · plant_name · solution_type · estimated_value
  (MXN) · selector de etapa (13, agrupadas por los 6 grupos vía `optgroup`) · next action ·
  badge de status si ≠ `open` · link al detalle. Totales por grupo (conteo + suma MXN) en
  el header de columna.
- **Todos los proyectos no archivados** en el board (lost/paused/won/active_customer se
  muestran en su columna con badge; no solo `open`).
- **Diferido:** drag, filtros, búsqueda, totales por-etapa, días desde última interacción
  (necesita `last_interaction_at`), owner (perfiles), diagnóstico (Fase 2).

Sin tabla, sin migración.

## 1. Mutación de etapa + refactor compartido (`lib/project-mutations.ts`)

La lógica de "registrar la transición" (insertar `stage_change` + el momento comercial si
aplica) vive hoy embebida en `runUpdateProject` (líneas ~118-142). Se **extrae** a un helper
local reutilizable, para que el Kanban dispare idéntica lógica de P2b sin duplicarla.

```ts
// Tipo de la transacción (el arg del callback de db.transaction).
type Tx = Parameters<Parameters<AnyDb["transaction"]>[0]>[0];

// Inserta el stage_change (inmutable) y, si la etapa destino es un gatillo comercial,
// el momento (proposal/contract). Se llama SOLO en una transición real (from !== to).
async function recordStageTransition(
  tx: Tx,
  args: { companyId: string; projectId: string; fromStage: string; toStage: string; actorUserId: string | null }
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

- **`runUpdateProject`**: sin cambio de comportamiento. El bloque `if (isEntry) { ...dos
  inserts... }` se reemplaza por `if (isEntry) { await recordStageTransition(tx, {
  companyId: current.companyId, projectId: id, fromStage: current.stage, toStage:
  fields.stage, actorUserId }); }`. Sus 12 tests existentes lo blindan.
- **`runMoveProjectStage(db, formData, actorUserId = null)`** (nuevo): mueve SOLO la etapa.

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
      if (current.stage === stage) return { ok: true }; // no-op

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

`stageMoveSchema` (en `lib/validation.ts`): `{ projectId: uuid("Proyecto inválido"),
stage: requiredEnum(STAGE_VALUES, "Etapa inválida") }`. (Reutiliza el helper `requiredEnum`
ya presente en `validation.ts`; `STAGE_VALUES` de `project-pipeline`.)

> Nota: `runMoveProjectStage` es consistente con `runUpdateProject` en la transición (mismo
> auto-status, mismo limpiado de lostReason, misma `recordStageTransition`), pero NO toca
> otros campos del proyecto.

## 2. Lógica pura — `lib/pipeline.ts`

```ts
import { STAGE_GROUPS, labelOf } from "@/lib/project-pipeline";
import type { Project } from "@/db/schema";

export type PipelineColumn<P> = {
  group: string;      // value de STAGE_GROUPS
  label: string;      // label español
  projects: P[];
  count: number;
  totalValue: number; // suma de estimated_value (nulls = 0)
};

// Los 6 grupos en el orden de STAGE_GROUPS, cada uno con sus projects (por stage_group),
// conteo y suma de valor. Incluye grupos vacíos.
export function groupProjectsByStageGroup<P extends { stageGroup: string; estimatedValue: number | null }>(
  projects: P[]
): PipelineColumn<P>[] {
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

// La task abierta más próxima por proyecto. openTasks ya vienen ordenados due_date asc,
// así que el primero visto por projectId es el next action.
export function nextActionByProject<T extends { projectId: string }>(openTasks: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const t of openTasks) if (!map.has(t.projectId)) map.set(t.projectId, t);
  return map;
}
```

## 3. Datos (reutilización, sin query nueva)

- `listAllProjects(db, { archived: false })` (existente) → `ProjectListRow[]` (Project +
  companyName; trae stage/stageGroup/status/plantName/solutionType/estimatedValue).
- `listOpenTasksWithContext(db)` (P3b) → para `nextActionByProject`.

## 4. UI — `app/pipeline/page.tsx` (server component, `dynamic = "force-dynamic"`)

```ts
const projects = await listAllProjects(db, { archived: false });
const openTasks = await listOpenTasksWithContext(db);
const columns = groupProjectsByStageGroup(projects);
const nextAction = nextActionByProject(openTasks);
```

- Board: contenedor `overflow-x-auto` con **6 columnas** (una por `PipelineColumn`).
  Header de columna: `label` + `count` + `formatMXN(totalValue)`.
- **`ProjectCard`** (server component, recibe `project: ProjectListRow` y `nextActionTitle: string | null`):
  Empresa (companyName) · plant_name · `labelOf(SOLUTION_TYPES, solutionType)` ·
  `formatMXN(estimatedValue)` · badge de status si `status !== "open"`
  (`labelOf(STATUSES, status)`) · next action (`nextActionTitle` o "sin próxima acción") ·
  el nombre linkea a `/projects/${id}` · y un **`CardStageSelect`** (client).
- **`CardStageSelect`** (client component): `<select>` con las 13 `STAGES` agrupadas por los
  6 grupos vía `<optgroup>` (usando `STAGE_TO_GROUP`/`STAGE_GROUPS`), `defaultValue = stage`;
  `onChange` → construye FormData (projectId + stage), llama `moveStageAction`, y
  `router.refresh()`. Hidden nada — usa el valor del select.

## 5. Server action + navegación

- **`moveStageAction(formData): Promise<void>`** en `app/projects/actions.ts` (patrón simple
  como `completeTaskAction`): `auth.getUser()` → `runMoveProjectStage(db, formData, user?.id ?? null)`
  → `revalidatePath('/pipeline')` y, si hay projectId válido, `revalidatePath('/projects/${projectId}')`.
- **`components/nav.tsx`**: agregar **Pipeline** (`/pipeline`) → orden
  `My Actions · Pipeline · Proyectos · Empresas`.

## 6. Tests (Vitest + PGlite, TDD — test primero)

**Puros (`lib/pipeline`):**
- `groupProjectsByStageGroup`: devuelve 6 columnas en el orden de STAGE_GROUPS (incluye
  vacías); asigna cada project a su grupo; count y totalValue correctos (nulls = 0).
- `nextActionByProject`: toma la primera task abierta por projectId (asumiendo orden
  due_date asc de entrada); proyectos sin task no están en el map.

**Glue (`lib/project-mutations`):**
- `runMoveProjectStage`: cambia `stage` + `stageGroup`; inserta 1 `stage_change` con metadata
  `{from,to,...}`; entrar a `propuesta_enviada` inserta también el momento `proposal/sent`;
  entrar a `contrato_firmado` fuerza `status=won` + momento `contract/signed`; misma etapa →
  no-op (0 activities, status intacto); project inexistente → error; stage inválida → error.
- **Regresión**: los 12 tests de `runUpdateProject` siguen verdes tras extraer
  `recordStageTransition` (mismo comportamiento).

**UI/nav:** `npm run build` + `npm run lint`.

## 7. Postura de seguridad (sin cambios)

Board muestra TODOS los projects no archivados sin filtro de ownership; `runMoveProjectStage`
scopea por `id`. Consistente con la postura RLS deny-all. Se cierra con el slice de RLS.

## Fuera de alcance (P4b+)

- **Drag** entre columnas (Opción C completa).
- **Filtros** (owner, solution_type, etapa, grupo, valor, fecha esperada, estado) y
  **búsqueda global** (§11.3).
- **Totales por-etapa** (además de por-grupo).
- **Días desde última interacción** (necesita `last_interaction_at`).
- **Owner** en la card (perfiles), **diagnóstico** (`potencial_general` + palanca, Fase 2).
