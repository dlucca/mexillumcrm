# Projects P3a — Tasks + Next Action (espinazo): Design

**Fecha:** 2026-08-12
**Slice:** Projects P3a (primer sub-slice de P3 — Tasks + Next Action)
**PRD ancla:** §10.5 (Tasks y Next Action), §8.3 (regla "Project open debe tener Next Action"), §11.6 (My Actions — diferido a P3b), §15 (modelo de datos)

## Contexto

P2a/P2b dejaron Activities + timeline + momentos comerciales + automatización de status.
P3 introduce **Tasks** (tabla separada de Activities [Decidido §10.5]) y la **Next Action
derivada**. P3 completo es grande (My Actions §11.6 es una vista diaria cross-project
entera), así que se descompone; **este spec cubre el espinazo P3a**.

### Decisiones de alcance (brainstorming)

- **Slice:** P3a project-scoped: tabla `tasks`, crear/completar/reabrir, Next Action
  derivada, alerta "sin próxima acción", todo en `/projects/[id]`. **Incluye** registrar
  una Activity `task` al completar (§10.5).
- **`due_at` obligatorio:** toda Task lleva fecha límite → la Next Action queda siempre
  bien definida y la alerta es inequívoca.
- **Lifecycle:** crear + completar + reabrir. Sin editar título/fecha ni borrar en P3a.
  Owner = creador (desde `auth.getUser()`), sin selector.
- **Fecha:** input `<input type="date">` (fecha sin hora), guardada como timestamptz a
  medianoche. Suficiente para ordenar la Next Action; hora precisa y "vencidas/hoy" reales
  van con My Actions (P3b).

## 1. Tabla `tasks` (migración 0005)

Subconjunto forward-compatible (mismo criterio que P1/P2a).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK defaultRandom | |
| `project_id` | uuid NOT NULL → projects | P3a es project-scoped |
| `company_id` | uuid NOT NULL → companies | denormalizado desde el project (como activities) |
| `owner_user_id` | uuid (nullable) | = creador, desde `auth.getUser()`; sin selector |
| `title` | text NOT NULL | |
| `due_at` | timestamptz NOT NULL | obligatorio |
| `completed_at` | timestamptz (nullable) | null = abierta; seteado = completada. NO hay enum de status |
| `created_at` | timestamptz NOT NULL defaultNow | |
| `updated_at` | timestamptz NOT NULL defaultNow `$onUpdate` | |

**Índices:** `tasks_project_id_idx` `(project_id)`, `tasks_project_id_completed_at_idx`
`(project_id, completed_at)`, `tasks_due_at_idx` `(due_at)` (§15.2), `tasks_company_id_idx`
`(company_id)`.

**RLS:** `.enableRLS()` → deny-all, consistente con las otras tablas.

**Diferidos** (dependen de otras entidades/fuera del espinazo): `contact_id`, tasks sobre
Company/Contact sin project (project_id sería nullable), `notes`/descripción, `archived_at`,
prioridad. Schema exporta `Task` / `NewTask`.

## 2. Derivación Next Action + validación (puro)

### 2.1 `lib/tasks.ts` — `nextActionTask`

```ts
import type { Task } from "@/db/schema";

// La "próxima acción" de un Project = la Task abierta (completed_at == null) con due_at
// más próximo. null si no hay ninguna abierta.
export function nextActionTask(tasks: Task[]): Task | null {
  const open = tasks.filter((t) => t.completedAt == null);
  if (open.length === 0) return null;
  return open.reduce((soonest, t) =>
    t.dueAt.getTime() < soonest.dueAt.getTime() ? t : soonest
  );
}
```

La alerta "sin próxima acción" la calcula la página:
`project.status === "open" && nextActionTask(tasks) == null` (§8.3).

### 2.2 `lib/validation.ts` — `taskCreateSchema`

`due_at` llega como `YYYY-MM-DD` desde `<input type="date">`. Se agrega un helper
`requiredDate` (espejo del `optionalDate` existente, pero no-nullable):

```ts
const requiredDate = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : ""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
);

export const taskCreateSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  title: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "El título es obligatorio")
  ),
  dueAt: requiredDate, // string YYYY-MM-DD; el glue lo convierte a Date
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
```

### 2.3 `lib/activity-log.ts` — `activityHeadline` para `task`

Extender `activityHeadline`: para `type === "task"` devolver `activity.body ?? activityTypeLabel("task")`
(el título de la task). `ACTIVITY_TYPES` ya tiene `task → "Tarea"`.

## 3. Capa de datos — `db/tasks.ts` (puro sobre `AnyDb`)

```ts
export type NewTaskInput = {
  projectId: string;
  companyId: string;
  ownerUserId: string | null;
  title: string;
  dueAt: Date;
};

createTask(db, input): Promise<Task>
getTask(db, id): Promise<Task | undefined>
listTasksForProject(db, projectId): Promise<Task[]>   // orden: due_at asc
```

Sin `completeTask`/`reopenTask` en la capa pura: la reapertura es un update simple que
hace el glue; el completado es compuesto (task + Activity) y va en transacción en el glue.

## 4. Glue — `lib/task-mutations.ts`

Patrón de `lib/activity-mutations.ts` / `lib/project-mutations.ts`.

- **`runCreateTask(db, formData, ownerUserId)`**: valida `taskCreateSchema` → `getProject`
  (resuelve `company_id`; si no existe → `{ ok:false, error:"No se encontró el proyecto" }`)
  → `createTask` con `dueAt: new Date(parsed.dueAt)`, `ownerUserId`. Devuelve `ActionResult`.
- **`runCompleteTask(db, formData, actorUserId)`**: valida `taskId` (uuid) →
  `db.transaction`:
  - `getTask`/select; si no existe → `{ ok:false, error:"No se encontró la tarea" }`.
  - si `completedAt != null` → no-op `{ ok:true }` (sin Activity duplicada).
  - si abierta → `tx.update(tasks).set({ completedAt: new Date() })` **e**
    `tx.insert(activities).values({ companyId, projectId, userId: actorUserId,
    type:"task", direction:"internal", subject:null, body: task.title, source:"system",
    metadata: { taskId: task.id, event: "completed" } })`.
  - outer try/catch → `{ ok:false, error:"No se pudo completar la tarea" }`.
- **`runReopenTask(db, formData)`**: valida `taskId` → `update(tasks).set({ completedAt: null })`
  where id; si 0 filas → `{ ok:false, error:"No se encontró la tarea" }`. Sin Activity (las
  Activities de completado son inmutables y permanecen).

`taskId` se lee de `formData.get("taskId")` y se valida con `z.string().uuid()`.

## 5. Server actions (`app/projects/actions.ts`)

- **`createTaskAction(prev, formData)`**: `auth.getUser()` → `runCreateTask(db, formData, user?.id ?? null)`
  → en éxito `revalidatePath('/projects/${projectId}')` (projectId validado uuid).
- **`completeTaskAction(formData)`** y **`reopenTaskAction(formData)`**: form actions simples
  (patrón `archiveContactAction`): `auth.getUser()` (complete pasa el actor) →
  `runCompleteTask`/`runReopenTask` → `revalidatePath('/projects/${projectId}')`. `reopen`
  no necesita actor.

## 6. UI en `/projects/[id]` — sección "Tareas" (encima de "Actividad")

`page.tsx` carga `listTasksForProject(db, id)` y computa `nextActionTask`.

- **Banner Next Action**: si hay task abierta → "Próxima acción: {título} — vence {fecha}"
  (formato es-MX de la fecha). Si `project.status === "open"` y no hay task abierta →
  alerta "⚠ Sin próxima acción".
- **`NewTaskForm`** (client, add-form como `NewNoteForm`: `useActionState` + reset +
  `router.refresh()`): `title` + `<input type="date" name="dueAt">` + hidden `projectId`.
  Solo visible si el proyecto no está archivado.
- **`TaskList`** (server component): tareas abiertas (por `due_at asc`) con un
  `<form action={completeTaskAction}>` (hidden taskId + projectId, botón "Completar");
  tareas completadas (atenuadas/tachadas) con `<form action={reopenTaskAction}>` botón
  "Reabrir". Cada fila muestra título + fecha límite.

El completado también aparece en la timeline de "Actividad" (Activity `task`, renderizada
por el `activityHeadline` extendido).

## 7. Tests (Vitest + PGlite, TDD — test primero)

**Puros:**
- `nextActionTask`: elige la abierta con `dueAt` más próximo; ignora completadas; null si no
  hay abiertas; con una sola abierta la devuelve.
- `taskCreateSchema`: rechaza title vacío, dueAt ausente/mal formado, projectId no-uuid;
  acepta y trima válidos.
- `activityHeadline` para `type="task"` → devuelve el body; sin body → label "Tarea".

**Datos/glue (PGlite):**
- `createTask` inserta; `listTasksForProject` ordena `due_at asc` y scopea por `projectId`.
- `runCreateTask`: resuelve `company_id` desde el project, setea owner y `dueAt` como Date;
  rechaza project inexistente; rechaza title vacío.
- `runCompleteTask`: setea `completed_at` + inserta exactamente 1 Activity `task` con
  `body=title` y `metadata.taskId`; idempotente si ya completada (no crea Activity dup, y no
  re-setea); not-found → error; atómico (rollback si falla el insert de Activity).
- `runReopenTask`: setea `completed_at=null`; no crea Activity; not-found → error.

## 8. Migración + deploy

- `npm run db:generate` → migración `0005` (`CREATE TABLE tasks` + RLS + FKs + índices) al repo.
- Aplicar a prod post-merge: `set -a; . ./.env.local; set +a; npm run db:migrate` (Claude
  autorizado a aplicarla).

## 9. Postura de seguridad (sin cambios)

`tasks` con `.enableRLS()` sin policies (deny-all REST), igual que las otras tablas. Glue
scopea por `id`/`projectId` sin ownership. Se cierra con el slice de RLS.

## Fuera de alcance (P3b+)

- **My Actions** global §11.6 (vencidas/hoy/próximas cross-project, projects sin next action,
  projects sin interacción reciente, botones rápidos).
- Tasks sobre Company/Contact sin project (project_id nullable).
- Crear Task directamente desde una Activity (§10.5).
- Editar título/fecha, borrar/archivar task, prioridad, notes.
- Sincronización cal.com.
