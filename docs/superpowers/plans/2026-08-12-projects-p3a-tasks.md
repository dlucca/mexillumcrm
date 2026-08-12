# Projects P3a — Tasks + Next Action (espinazo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tabla `tasks` project-scoped con crear/completar, Next Action derivada (task abierta con `due_date` más próxima) y alerta "sin próxima acción", en `/projects/[id]`; al completar se registra una Activity `task` en la timeline.

**Architecture:** Nueva tabla `tasks` (columna `date` para la fecha límite, `completed_at` para el estado). Capa de datos pura (`db/tasks.ts`), helpers puros (`lib/tasks.ts`: `nextActionTask`, `formatDueDate`), `taskCreateSchema` (Zod) + extensión de `activityHeadline`, glue testeable (`lib/task-mutations.ts`: `runCreateTask` + `runCompleteTask` transaccional), server actions delgadas, y UI SSR (form de alta client, lista/Next Action server).

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle ORM, Postgres/Supabase (PGlite en tests), Zod, Vitest, Tailwind v4.

## Global Constraints

- **TDD siempre**: test primero, verlo fallar, implementar mínimo, verlo pasar, commit.
- **`due_date` es una columna `date` (`mode: "string"`, `YYYY-MM-DD`)** — nunca timestamptz, nunca hora. Se compara como string (ordena cronológicamente).
- **Sin reabrir**: completar es one-way. No hay `runReopenTask`/`reopenTaskAction`/botón "Reabrir".
- **Owner = creador**: `owner_user_id` se setea desde `supabase.auth.getUser()`; sin selector.
- **Activities append-only**: la Activity `task` de completado es inmutable (no se edita/borra).
- **Completar es idempotente**: si la task ya está completada, no-op `{ ok:true }` (sin Activity duplicada, sin re-setear).
- **Transacción**: el completado (task + Activity) va en `db.transaction`. `runCreateProject`/`runUpdateProject` no se tocan.
- **Postura de seguridad (sin cambios)**: `tasks` con `.enableRLS()` (deny-all REST), sin policies. Glue scopea por `id`/`projectId`.
- **UI copy en español.**
- **Migración**: `npm run db:generate` genera el SQL (0005) al repo; aplicar a prod es post-merge (`set -a; . ./.env.local; set +a; npm run db:migrate`), Claude autorizado.
- **Tests**: focalizados `npm test -- <patrón>` (fiables). Suite completa flaky por PGlite file-parallelism → `npm test -- --no-file-parallelism`.

---

### Task 1: Tabla `tasks` (schema + migración 0005)

**Files:**
- Modify: `db/schema.ts` (añadir tabla `tasks` + tipos; `date` ya está importado)
- Create: `db/migrations/0005_*.sql` (generada)
- Test: `test/tasks.test.ts`

**Interfaces:**
- Produces: tabla `tasks`; tipos `Task = typeof tasks.$inferSelect`, `NewTask = typeof tasks.$inferInsert`.

- [ ] **Step 1: Write the failing test**

Create `test/tasks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { tasks, projects } from "@/db/schema";

describe("tasks table", () => {
  it("inserta y recupera una task con due_date string y completed_at null", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [proj] = await db.insert(projects).values({ companyId: company.id, name: "P" }).returning();

    const [row] = await db
      .insert(tasks)
      .values({
        projectId: proj.id,
        companyId: company.id,
        ownerUserId: null,
        title: "Llamar al cliente",
        dueDate: "2026-09-01",
      })
      .returning();

    expect(row.id).toBeTruthy();
    expect(row.title).toBe("Llamar al cliente");
    expect(row.dueDate).toBe("2026-09-01");
    expect(row.completedAt).toBeNull();

    const found = await db.select().from(tasks).where(eq(tasks.id, row.id));
    expect(found).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tasks`
Expected: FAIL (no export `tasks` en `@/db/schema`).

- [ ] **Step 3: Add the table to `db/schema.ts`**

Al final del archivo (después de los tipos de `activities`), añadir:

```ts
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    ownerUserId: uuid("owner_user_id"),
    title: text("title").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("tasks_project_id_idx").on(t.projectId),
    index("tasks_project_id_completed_at_idx").on(t.projectId, t.completedAt),
    index("tasks_due_date_idx").on(t.dueDate),
    index("tasks_company_id_idx").on(t.companyId),
  ]
).enableRLS();

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

(`date` ya está en el import de la línea 1 de `db/schema.ts`.)

- [ ] **Step 4: Generate the migration**

Run: `npm run db:generate`
Expected: crea `db/migrations/0005_*.sql` con `CREATE TABLE "tasks"`, `ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY`, las FKs a projects/companies, y los 4 índices. Verificar que contiene `ENABLE ROW LEVEL SECURITY` y que NO toca otras tablas.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tasks`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts db/migrations test/tasks.test.ts
git commit -m "feat: tabla tasks (schema + migración 0005, RLS deny-all)"
```

---

### Task 2: Capa de datos de Tasks (`db/tasks.ts`)

**Files:**
- Create: `db/tasks.ts`
- Test: `test/tasks.test.ts` (añadir describe)

**Interfaces:**
- Consumes: `tasks`, `Task` de `@/db/schema`; `AnyDb`.
- Produces:
  - `type NewTaskInput = { projectId: string; companyId: string; ownerUserId: string | null; title: string; dueDate: string }`
  - `createTask(db: AnyDb, input: NewTaskInput): Promise<Task>`
  - `getTask(db: AnyDb, id: string): Promise<Task | undefined>`
  - `listTasksForProject(db: AnyDb, projectId: string): Promise<Task[]>` (orden `due_date asc`)

- [ ] **Step 1: Write the failing test**

Añadir a `test/tasks.test.ts`:

```ts
import { createTask, getTask, listTasksForProject } from "@/db/tasks";

describe("db/tasks", () => {
  async function seed() {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [proj] = await db.insert(projects).values({ companyId: company.id, name: "P" }).returning();
    return { db, companyId: company.id, projectId: proj.id };
  }

  it("createTask inserta y getTask lo recupera", async () => {
    const { db, companyId, projectId } = await seed();
    const row = await createTask(db, {
      projectId, companyId, ownerUserId: null, title: "T1", dueDate: "2026-09-01",
    });
    expect(row.id).toBeTruthy();
    const found = await getTask(db, row.id);
    expect(found?.title).toBe("T1");
  });

  it("listTasksForProject ordena due_date asc y scopea por projectId", async () => {
    const { db, companyId, projectId } = await seed();
    await createTask(db, { projectId, companyId, ownerUserId: null, title: "tarde", dueDate: "2026-12-01" });
    await createTask(db, { projectId, companyId, ownerUserId: null, title: "pronto", dueDate: "2026-09-01" });
    const [other] = await db.insert(projects).values({ companyId, name: "Otro" }).returning();
    await createTask(db, { projectId: other.id, companyId, ownerUserId: null, title: "de otro", dueDate: "2026-08-01" });

    const rows = await listTasksForProject(db, projectId);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe("pronto"); // due_date más temprano primero
    expect(rows.every((t) => t.projectId === projectId)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tasks`
Expected: FAIL (no existe `@/db/tasks`).

- [ ] **Step 3: Implement `db/tasks.ts`**

```ts
import { asc, eq } from "drizzle-orm";
import { tasks } from "./schema";
import type { Task } from "./schema";
import type { AnyDb } from "@/db/types";

export type NewTaskInput = {
  projectId: string;
  companyId: string;
  ownerUserId: string | null;
  title: string;
  dueDate: string;
};

export async function createTask(db: AnyDb, input: NewTaskInput): Promise<Task> {
  const [row] = await db.insert(tasks).values(input).returning();
  return row;
}

export async function getTask(db: AnyDb, id: string): Promise<Task | undefined> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row;
}

export async function listTasksForProject(db: AnyDb, projectId: string): Promise<Task[]> {
  return db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(asc(tasks.dueDate));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tasks`
Expected: PASS (tabla + db/tasks).

- [ ] **Step 5: Commit**

```bash
git add db/tasks.ts test/tasks.test.ts
git commit -m "feat: db/tasks (createTask, getTask, listTasksForProject)"
```

---

### Task 3: Helpers puros de Tasks (`lib/tasks.ts`)

**Files:**
- Create: `lib/tasks.ts`
- Test: `test/tasks-lib.test.ts`

**Interfaces:**
- Consumes: `Task` de `@/db/schema`.
- Produces:
  - `nextActionTask(tasks: Task[]): Task | null` (abierta con `due_date` más próxima)
  - `formatDueDate(dueDate: string): string` (es-MX, solo fecha)

- [ ] **Step 1: Write the failing test**

Create `test/tasks-lib.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Task } from "@/db/schema";
import { nextActionTask, formatDueDate } from "@/lib/tasks";

function mk(dueDate: string, completedAt: Date | null): Task {
  return { dueDate, completedAt } as unknown as Task;
}

describe("nextActionTask", () => {
  it("elige la task abierta con due_date más próxima", () => {
    const t = nextActionTask([mk("2026-12-01", null), mk("2026-09-01", null), mk("2026-10-01", null)]);
    expect(t?.dueDate).toBe("2026-09-01");
  });
  it("ignora las completadas", () => {
    const t = nextActionTask([mk("2026-08-01", new Date()), mk("2026-11-01", null)]);
    expect(t?.dueDate).toBe("2026-11-01");
  });
  it("null si no hay abiertas", () => {
    expect(nextActionTask([mk("2026-08-01", new Date())])).toBeNull();
    expect(nextActionTask([])).toBeNull();
  });
});

describe("formatDueDate", () => {
  it("formatea YYYY-MM-DD sin corrimiento de zona", () => {
    const s = formatDueDate("2026-09-01");
    expect(s).toContain("2026");
    expect(typeof s).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tasks-lib`
Expected: FAIL (módulo `@/lib/tasks` no existe).

- [ ] **Step 3: Implement `lib/tasks.ts`**

```ts
import type { Task } from "@/db/schema";

// La "próxima acción" de un Project = la Task abierta (completed_at == null) con due_date
// más próximo. null si no hay ninguna abierta. due_date es YYYY-MM-DD (ordena como string).
export function nextActionTask(tasks: Task[]): Task | null {
  const open = tasks.filter((t) => t.completedAt == null);
  if (open.length === 0) return null;
  return open.reduce((soonest, t) => (t.dueDate < soonest.dueDate ? t : soonest));
}

const dueDateFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

export function formatDueDate(dueDate: string): string {
  // T00:00:00 (hora local) evita el corrimiento de zona de `new Date("YYYY-MM-DD")` (UTC).
  return dueDateFormatter.format(new Date(`${dueDate}T00:00:00`));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tasks-lib`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tasks.ts test/tasks-lib.test.ts
git commit -m "feat: lib/tasks (nextActionTask, formatDueDate)"
```

---

### Task 4: `taskCreateSchema` + `activityHeadline` para `task`

**Files:**
- Modify: `lib/validation.ts` (añadir `requiredDate` + `taskCreateSchema` + tipo)
- Modify: `lib/activity-log.ts` (rama `task` en `activityHeadline`)
- Test: `test/validation.test.ts` (añadir describe), `test/activity-log.test.ts` (añadir casos)

**Interfaces:**
- Produces: `taskCreateSchema` (`{ projectId: uuid; title: min1 trim; dueDate: YYYY-MM-DD }`), `type TaskCreateInput`; `activityHeadline` resuelve `type="task"` → `body`.

- [ ] **Step 1: Write the failing tests**

Añadir a `test/validation.test.ts`:

```ts
import { taskCreateSchema } from "@/lib/validation";

describe("taskCreateSchema", () => {
  const pid = "11111111-1111-1111-8111-111111111111";
  it("acepta y trima válidos", () => {
    const r = taskCreateSchema.safeParse({ projectId: pid, title: "  Llamar  ", dueDate: "2026-09-01" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.title).toBe("Llamar"); expect(r.data.dueDate).toBe("2026-09-01"); }
  });
  it("rechaza title vacío", () => {
    expect(taskCreateSchema.safeParse({ projectId: pid, title: "  ", dueDate: "2026-09-01" }).success).toBe(false);
  });
  it("rechaza dueDate ausente o mal formado", () => {
    expect(taskCreateSchema.safeParse({ projectId: pid, title: "T", dueDate: "" }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ projectId: pid, title: "T", dueDate: "01/09/2026" }).success).toBe(false);
  });
  it("rechaza projectId no-uuid", () => {
    expect(taskCreateSchema.safeParse({ projectId: "nope", title: "T", dueDate: "2026-09-01" }).success).toBe(false);
  });
});
```

Añadir a `test/activity-log.test.ts` (dentro del describe existente o un nuevo `it`; `activityHeadline` ya está importado):

```ts
  it("activityHeadline para type task devuelve el body", () => {
    expect(activityHeadline({ type: "task", body: "Llamar al cliente", metadata: null })).toBe("Llamar al cliente");
    expect(activityHeadline({ type: "task", body: null, metadata: null })).toBe("Tarea");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- validation activity-log`
Expected: FAIL (no export `taskCreateSchema`; `activityHeadline` de `task` cae al label pero el primer assert espera el body).

- [ ] **Step 3: Implement**

En `lib/validation.ts`, añadir al final:

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
  dueDate: requiredDate,
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
```

En `lib/activity-log.ts`, en `activityHeadline`, añadir esta rama después del `if (activity.type === "note") ...`:

```ts
  if (activity.type === "task") return activity.body ?? activityTypeLabel("task");
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- validation activity-log`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts lib/activity-log.ts test/validation.test.ts test/activity-log.test.ts
git commit -m "feat: taskCreateSchema + activityHeadline para type task"
```

---

### Task 5: Glue `runCreateTask` + `runCompleteTask` (`lib/task-mutations.ts`)

**Files:**
- Create: `lib/task-mutations.ts`
- Test: `test/task-mutations.test.ts`

**Interfaces:**
- Consumes: `taskCreateSchema` de `@/lib/validation`; `createTask` de `@/db/tasks`; `getProject` de `@/db/projects`; `tasks`/`activities` de `@/db/schema`; `ActionResult` de `@/lib/company-mutations`; `AnyDb`; `eq` de `drizzle-orm`; `z`.
- Produces:
  - `runCreateTask(db, formData, ownerUserId): Promise<ActionResult>`
  - `runCompleteTask(db, formData, actorUserId): Promise<ActionResult>`

- [ ] **Step 1: Write the failing tests**

Create `test/task-mutations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { projects } from "@/db/schema";
import { createTask, listTasksForProject } from "@/db/tasks";
import { listActivitiesForProject } from "@/db/activities";
import { runCreateTask, runCompleteTask } from "@/lib/task-mutations";

function formOf(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

async function seed() {
  const db = await createTestDb();
  const company = await createCompany(db, { name: "Acme" });
  const [proj] = await db.insert(projects).values({ companyId: company.id, name: "P" }).returning();
  return { db, companyId: company.id, projectId: proj.id };
}

describe("runCreateTask", () => {
  it("crea la task con company_id del project, owner y due_date", async () => {
    const { db, companyId, projectId } = await seed();
    const res = await runCreateTask(
      db,
      formOf({ projectId, title: "  Llamar  ", dueDate: "2026-09-01" }),
      "22222222-2222-2222-2222-222222222222"
    );
    expect(res).toEqual({ ok: true });
    const [t] = await listTasksForProject(db, projectId);
    expect(t.title).toBe("Llamar");
    expect(t.dueDate).toBe("2026-09-01");
    expect(t.companyId).toBe(companyId);
    expect(t.ownerUserId).toBe("22222222-2222-2222-2222-222222222222");
    expect(t.completedAt).toBeNull();
  });

  it("rechaza title vacío", async () => {
    const { db, projectId } = await seed();
    const res = await runCreateTask(db, formOf({ projectId, title: "  ", dueDate: "2026-09-01" }), null);
    expect(res.ok).toBe(false);
  });

  it("rechaza project inexistente", async () => {
    const { db } = await seed();
    const res = await runCreateTask(
      db,
      formOf({ projectId: "00000000-0000-0000-0000-000000000000", title: "T", dueDate: "2026-09-01" }),
      null
    );
    expect(res).toEqual({ ok: false, error: "No se encontró el proyecto" });
  });
});

describe("runCompleteTask", () => {
  it("setea completed_at y registra 1 Activity task con body=title y metadata.taskId", async () => {
    const { db, companyId, projectId } = await seed();
    const task = await createTask(db, { projectId, companyId, ownerUserId: null, title: "Llamar", dueDate: "2026-09-01" });
    const res = await runCompleteTask(db, formOf({ taskId: task.id }), "33333333-3333-3333-3333-333333333333");
    expect(res).toEqual({ ok: true });

    const [t] = await listTasksForProject(db, projectId);
    expect(t.completedAt).not.toBeNull();

    const acts = (await listActivitiesForProject(db, projectId)).filter((a) => a.type === "task");
    expect(acts).toHaveLength(1);
    expect(acts[0].body).toBe("Llamar");
    expect(acts[0].source).toBe("system");
    expect(acts[0].userId).toBe("33333333-3333-3333-3333-333333333333");
    expect(acts[0].metadata).toMatchObject({ taskId: task.id, event: "completed" });
  });

  it("es idempotente: completar una ya completada no duplica la Activity", async () => {
    const { db, companyId, projectId } = await seed();
    const task = await createTask(db, { projectId, companyId, ownerUserId: null, title: "Llamar", dueDate: "2026-09-01" });
    await runCompleteTask(db, formOf({ taskId: task.id }), null);
    const res2 = await runCompleteTask(db, formOf({ taskId: task.id }), null);
    expect(res2).toEqual({ ok: true });
    const acts = (await listActivitiesForProject(db, projectId)).filter((a) => a.type === "task");
    expect(acts).toHaveLength(1);
  });

  it("task inexistente → error", async () => {
    const { db } = await seed();
    const res = await runCompleteTask(db, formOf({ taskId: "00000000-0000-0000-0000-000000000000" }), null);
    expect(res).toEqual({ ok: false, error: "No se encontró la tarea" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- task-mutations`
Expected: FAIL (no existe `@/lib/task-mutations`).

- [ ] **Step 3: Implement `lib/task-mutations.ts`**

```ts
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { AnyDb } from "@/db/types";
import { taskCreateSchema } from "@/lib/validation";
import { createTask } from "@/db/tasks";
import { getProject } from "@/db/projects";
import { tasks, activities } from "@/db/schema";
import type { ActionResult } from "@/lib/company-mutations";

const taskIdSchema = z.string().uuid();

export async function runCreateTask(
  db: AnyDb,
  formData: FormData,
  ownerUserId: string | null
): Promise<ActionResult> {
  const parsed = taskCreateSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const project = await getProject(db, parsed.data.projectId);
  if (!project) {
    return { ok: false, error: "No se encontró el proyecto" };
  }
  try {
    await createTask(db, {
      projectId: project.id,
      companyId: project.companyId,
      ownerUserId,
      title: parsed.data.title,
      dueDate: parsed.data.dueDate,
    });
  } catch {
    return { ok: false, error: "No se pudo crear la tarea" };
  }
  return { ok: true };
}

export async function runCompleteTask(
  db: AnyDb,
  formData: FormData,
  actorUserId: string | null
): Promise<ActionResult> {
  const parsedId = taskIdSchema.safeParse(formData.get("taskId"));
  if (!parsedId.success) {
    return { ok: false, error: "Tarea inválida" };
  }
  const taskId = parsedId.data;
  try {
    return await db.transaction(async (tx): Promise<ActionResult> => {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (!task) {
        return { ok: false, error: "No se encontró la tarea" };
      }
      if (task.completedAt != null) {
        return { ok: true };
      }
      await tx.update(tasks).set({ completedAt: new Date() }).where(eq(tasks.id, taskId));
      await tx.insert(activities).values({
        companyId: task.companyId,
        projectId: task.projectId,
        userId: actorUserId,
        type: "task",
        direction: "internal",
        subject: null,
        body: task.title,
        source: "system",
        metadata: { taskId: task.id, event: "completed" },
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "No se pudo completar la tarea" };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- task-mutations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/task-mutations.ts test/task-mutations.test.ts
git commit -m "feat: runCreateTask + runCompleteTask (glue; completado registra Activity task en transacción)"
```

---

### Task 6: Server actions (`app/projects/actions.ts`)

**Files:**
- Modify: `app/projects/actions.ts`
- Test: (sin unit test; dependen de Supabase/db, como el resto de actions.ts. Verificación por lint en este task + build en Task 7.)

**Interfaces:**
- Consumes: `runCreateTask`, `runCompleteTask` de `@/lib/task-mutations`; `createClient`, `db`, `idSchema`, `revalidatePath`, `ActionResult` (ya en el archivo).
- Produces: `createTaskAction(_prev, formData): Promise<ActionResult>`; `completeTaskAction(formData): Promise<void>`.

- [ ] **Step 1: Modify `app/projects/actions.ts`**

Añadir al import de mutations:

```ts
import { runCreateTask, runCompleteTask } from "@/lib/task-mutations";
```

Añadir al final del archivo:

```ts
export async function createTaskAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const result = await runCreateTask(db, formData, user?.id ?? null);
  if (result.ok) {
    const projectId = idSchema.safeParse(formData.get("projectId"));
    if (projectId.success) revalidatePath(`/projects/${projectId.data}`);
  }
  return result;
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await runCompleteTask(db, formData, user?.id ?? null);
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
git commit -m "feat: createTaskAction + completeTaskAction"
```

---

### Task 7: UI — sección "Tareas" en `/projects/[id]`

**Files:**
- Create: `components/new-task-form.tsx`
- Create: `components/task-list.tsx`
- Modify: `app/projects/[id]/page.tsx`
- Test: (verificación por `npm run build` + `npm run lint`; el proyecto no tiene tests de componentes)

**Interfaces:**
- Consumes: `createTaskAction`/`completeTaskAction` de `@/app/projects/actions`; `listTasksForProject` de `@/db/tasks`; `nextActionTask`, `formatDueDate` de `@/lib/tasks`; `Task` de `@/db/schema`; `ActionResult`.

- [ ] **Step 1: Create `components/new-task-form.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction } from "@/app/projects/actions";
import type { ActionResult } from "@/lib/company-mutations";

export function NewTaskForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createTaskAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <input type="hidden" name="projectId" value={projectId} />
      <input
        name="title"
        required
        placeholder="Nueva tarea…"
        className="rounded-md border px-3 py-2"
      />
      <input name="dueDate" type="date" required className="rounded-md border px-3 py-2" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Agregar tarea"}
      </button>
      {state && !state.ok && <p className="text-sm text-red-600 sm:col-span-3">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Create `components/task-list.tsx`**

```tsx
import type { Task } from "@/db/schema";
import { completeTaskAction } from "@/app/projects/actions";
import { formatDueDate } from "@/lib/tasks";

export function TaskList({
  tasks,
  projectId,
  archived,
}: {
  tasks: Task[];
  projectId: string;
  archived: boolean;
}) {
  if (tasks.length === 0) {
    return <p className="mt-4 text-sm text-neutral-500">Sin tareas todavía.</p>;
  }
  const open = tasks.filter((t) => t.completedAt == null);
  const done = tasks.filter((t) => t.completedAt != null);
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {open.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 rounded-md border px-4 py-2">
          <span className="text-sm">
            <span className="font-medium">{t.title}</span> — vence {formatDueDate(t.dueDate)}
          </span>
          {!archived && (
            <form action={completeTaskAction}>
              <input type="hidden" name="taskId" value={t.id} />
              <input type="hidden" name="projectId" value={projectId} />
              <button className="text-sm underline">Completar</button>
            </form>
          )}
        </li>
      ))}
      {done.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 rounded-md border px-4 py-2 text-neutral-400">
          <span className="text-sm line-through">
            {t.title} — venció {formatDueDate(t.dueDate)}
          </span>
          <span className="text-xs">Completada</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Modify `app/projects/[id]/page.tsx`**

Añadir imports (después de los existentes):

```ts
import { listTasksForProject } from "@/db/tasks";
import { nextActionTask, formatDueDate } from "@/lib/tasks";
import { NewTaskForm } from "@/components/new-task-form";
import { TaskList } from "@/components/task-list";
```

Cargar las tasks + next action (después de `const activities = ...`):

```ts
  const tasks = await listTasksForProject(db, id);
  const nextAction = nextActionTask(tasks);
```

Insertar la sección "Tareas" ANTES de la sección "Actividad" (entre `</ProjectDetailForm>` y `<section ...>Actividad`):

```tsx
      <section className="mt-10">
        <h2 className="font-display font-bold text-2xl tracking-display">Tareas</h2>
        {nextAction ? (
          <p className="mt-2 text-sm">
            Próxima acción: <span className="font-medium">{nextAction.title}</span> — vence{" "}
            {formatDueDate(nextAction.dueDate)}
          </p>
        ) : project.status === "open" ? (
          <p className="mt-2 text-sm text-amber-700">⚠ Sin próxima acción</p>
        ) : null}
        {!archived && <NewTaskForm projectId={project.id} />}
        <TaskList tasks={tasks} projectId={project.id} archived={archived} />
      </section>
```

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run lint`
Expected: build OK (ruta `/projects/[id]` dinámica), lint limpio.

- [ ] **Step 5: Manual verification (opcional)**

`npm run dev`, entrar a un `/projects/[id]`: agregar una tarea con fecha aparece en la lista y como "Próxima acción"; un proyecto `open` sin tareas muestra "⚠ Sin próxima acción"; "Completar" la tacha y agrega un item "Tarea" en la timeline de Actividad.

- [ ] **Step 6: Commit**

```bash
git add components/new-task-form.tsx components/task-list.tsx "app/projects/[id]/page.tsx"
git commit -m "feat: sección Tareas en /projects/[id] (Next Action + alta + completar)"
```

---

### Task 8: Verificación final + deploy de migración

**Files:** ninguno (verificación).

- [ ] **Step 1: Suite completa + build + lint**

Run: `npm test -- --no-file-parallelism && npm run build && npm run lint`
Expected: todo verde.

- [ ] **Step 2: Confirmar migración generada**

Run: `git status` y verificar `db/migrations/0005_*.sql` commiteada con `CREATE TABLE "tasks"` + `ENABLE ROW LEVEL SECURITY`; `db/migrations/meta/_journal.json` con entrada 0005.

- [ ] **Step 3: Aplicar a Supabase prod (Claude autorizado)**

Post-merge:

```bash
set -a; . ./.env.local; set +a; npm run db:migrate
```

Expected: `0005` aplicada. Verificar que la tabla `tasks` existe en prod con RLS habilitada.

---

## Self-Review

**Spec coverage (spec §→task):**
- §1 tabla `tasks` (columnas, `date`, índices, RLS, diferidos) → Task 1. ✓
- §2.1 `nextActionTask` + `formatDueDate` → Task 3. ✓
- §2.2 `taskCreateSchema` → Task 4. ✓
- §2.3 `activityHeadline` para `task` → Task 4. ✓
- §3 capa de datos → Task 2. ✓
- §4 glue (`runCreateTask` + `runCompleteTask` transaccional, idempotente) → Task 5. ✓ (Sin `runReopenTask`, como decidido.)
- §5 server actions → Task 6. ✓
- §6 UI (NewTaskForm, TaskList, banner Next Action, sin botón reabrir) → Task 7. ✓
- §7 tests → distribuidos (puros T3/T4, datos T1/T2, glue T5). ✓
- §8 migración + deploy → Task 1 (generate) + Task 8 (apply). ✓
- §9 postura de seguridad → `.enableRLS()` en Task 1. ✓

**Placeholder scan:** sin TBD/TODO; todos los pasos con código o comando exacto. ✓

**Type consistency:** `NewTaskInput.dueDate: string` (T2) usado por `runCreateTask` (T5) con `parsed.data.dueDate` (string, T4 schema); `Task.dueDate` string comparado en `nextActionTask` (T3) y formateado por `formatDueDate` (T3, T7); `completeTaskAction`/`createTaskAction` (T6) consumidos por los componentes (T7); `activityHeadline` rama `task` (T4) rendereada por la timeline existente (P2a). ✓

**Nota de alcance:** `runCompleteTask` es transaccional (atomicidad probada en P2a/P2b); el plan NO incluye un test de rollback forzado (no hay un seam limpio para forzar el fallo del insert de Activity de forma determinística sin acoplar el test). La atomicidad queda garantizada por `db.transaction`; los demás caminos (idempotente, not-found, Activity creada) sí están cubiertos.
