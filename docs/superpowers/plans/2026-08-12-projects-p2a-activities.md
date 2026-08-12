# Projects P2a — Activities (espinazo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar una timeline de Activities por Project: nota manual, evento `stage_change` inmutable al cambiar la etapa, y evento `system` al crear el Project; mostrarla en `/projects/[id]` con filtro por tipo.

**Architecture:** Nueva tabla `activities` (text-enums + Zod, patrón P1). Capa de datos pura sobre `AnyDb` (`db/activities.ts`), helpers puros de enums/labels (`lib/activity-log.ts`), glue testeable (`runCreateNote`, y modificaciones a `runCreateProject`/`runUpdateProject` que escriben la Activity dentro de `db.transaction` para atomicidad), server actions delgadas, y UI SSR con filtro por query param.

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle ORM, Postgres/Supabase (PGlite in-process en tests), Zod, Vitest, Tailwind v4.

## Global Constraints

- **TDD siempre**: test primero, verlo fallar, implementar mínimo, verlo pasar, commit.
- **Enums = columnas `text` + Zod union** (NO `pgEnum`).
- **Inmutabilidad**: `db/activities.ts` NO exporta `updateActivity`/`deleteActivity`; no hay UI de edición/borrado de activities.
- **UI copy en español.**
- **Firma opcional**: `runUpdateProject(db, formData, actorUserId: string | null = null)` — el tercer parámetro es opcional para no romper llamadas existentes.
- **Postura de seguridad (sin cambios)**: `activities` con `.enableRLS()` (deny-all REST), sin policies. Writes scopean por `id`/`projectId`.
- **Migraciones**: `npm run db:generate` genera SQL al repo; aplicar a prod es paso post-merge (`set -a; . ./.env.local; set +a; npm run db:migrate`).
- **Todos los tests corren con** `npm test` (vitest run). Typecheck/lint/bundle con `npm run build` y `npm run lint`.

---

### Task 1: Tabla `activities` (schema + migración 0004)

**Files:**
- Modify: `db/schema.ts` (añadir import `jsonb`; añadir tabla `activities` + tipos)
- Create: `db/migrations/0004_*.sql` (generada por drizzle-kit)
- Test: `test/activities.test.ts`

**Interfaces:**
- Produces: tabla `activities`; tipos `Activity = typeof activities.$inferSelect`, `NewActivity = typeof activities.$inferInsert`.

- [ ] **Step 1: Write the failing test**

Create `test/activities.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { activities } from "@/db/schema";

describe("activities table", () => {
  it("inserta y recupera una activity con metadata jsonb", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [proj] = await db
      .insert((await import("@/db/schema")).projects)
      .values({ companyId: company.id, name: "P" })
      .returning();

    const [row] = await db
      .insert(activities)
      .values({
        companyId: company.id,
        projectId: proj.id,
        userId: null,
        type: "note",
        direction: "internal",
        subject: null,
        body: "hola",
        source: "manual",
        metadata: { k: "v" },
      })
      .returning();

    expect(row.id).toBeTruthy();
    expect(row.type).toBe("note");
    expect(row.body).toBe("hola");
    expect(row.metadata).toEqual({ k: "v" });
    expect(row.occurredAt).toBeInstanceOf(Date);

    const found = await db.select().from(activities).where(eq(activities.id, row.id));
    expect(found).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- activities`
Expected: FAIL (no export `activities` en `@/db/schema`).

- [ ] **Step 3: Add the table to `db/schema.ts`**

Cambiar la primera línea de import para incluir `jsonb`:

```ts
import { pgTable, uuid, text, timestamp, integer, date, index, jsonb } from "drizzle-orm/pg-core";
```

Al final del archivo, después de los tipos de `projects`, añadir:

```ts
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    userId: uuid("user_id"),
    type: text("type").notNull(),
    direction: text("direction"),
    subject: text("subject"),
    body: text("body"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("activities_project_id_idx").on(t.projectId),
    index("activities_project_id_occurred_at_idx").on(t.projectId, t.occurredAt),
    index("activities_company_id_idx").on(t.companyId),
  ]
).enableRLS();

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
```

- [ ] **Step 4: Generate the migration**

Run: `npm run db:generate`
Expected: crea `db/migrations/0004_*.sql` con `CREATE TABLE "activities"`, `ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY`, las FKs a companies/projects, y los 3 índices. Verificar que el SQL contiene `ENABLE ROW LEVEL SECURITY`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- activities`
Expected: PASS (PGlite corre la migración 0004 y el insert funciona).

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts db/migrations test/activities.test.ts
git commit -m "feat: tabla activities (schema + migración 0004, RLS deny-all)"
```

---

### Task 2: Helpers puros de Activities (`lib/activity-log.ts`)

**Files:**
- Create: `lib/activity-log.ts`
- Test: `test/activity-log.test.ts`

**Interfaces:**
- Consumes: `STAGES`, `labelOf`, `stageGroupFor`, `Option` de `@/lib/project-pipeline`.
- Produces:
  - `ACTIVITY_TYPES: Option[]`, `ACTIVITY_TYPE_VALUES: string[]`
  - `ACTIVITY_DIRECTIONS`, `ACTIVITY_DIRECTION_VALUES`
  - `ACTIVITY_SOURCES`, `ACTIVITY_SOURCE_VALUES`
  - `type StageChangeMetadata = { fromStage: string; toStage: string; fromGroup: string; toGroup: string }`
  - `stageChangeMetadata(fromStage: string, toStage: string): StageChangeMetadata`
  - `describeStageChange(metadata: StageChangeMetadata): string`
  - `activityTypeLabel(type: string): string`
  - `activityHeadline(activity: { type: string; body: string | null; metadata: unknown }): string`
  - `formatDateTime(date: Date | string): string`

- [ ] **Step 1: Write the failing test**

Create `test/activity-log.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ACTIVITY_TYPE_VALUES,
  stageChangeMetadata,
  describeStageChange,
  activityTypeLabel,
  activityHeadline,
} from "@/lib/activity-log";

describe("activity-log helpers", () => {
  it("ACTIVITY_TYPE_VALUES tiene los 12 tipos del PRD", () => {
    expect(ACTIVITY_TYPE_VALUES).toContain("stage_change");
    expect(ACTIVITY_TYPE_VALUES).toContain("note");
    expect(ACTIVITY_TYPE_VALUES).toContain("system");
    expect(ACTIVITY_TYPE_VALUES).toHaveLength(12);
  });

  it("stageChangeMetadata deriva los grupos", () => {
    expect(stageChangeMetadata("lead_sin_contactar", "outreach_enviado")).toEqual({
      fromStage: "lead_sin_contactar",
      toStage: "outreach_enviado",
      fromGroup: "lead",
      toGroup: "qualification",
    });
  });

  it("describeStageChange usa labels legibles", () => {
    const md = stageChangeMetadata("lead_sin_contactar", "outreach_enviado");
    expect(describeStageChange(md)).toBe("Lead / sin contactar → Outreach enviado");
  });

  it("activityTypeLabel devuelve label español", () => {
    expect(activityTypeLabel("note")).toBe("Nota");
    expect(activityTypeLabel("stage_change")).toBe("Cambio de etapa");
  });

  it("activityHeadline por tipo", () => {
    expect(
      activityHeadline({
        type: "stage_change",
        body: null,
        metadata: stageChangeMetadata("lead_sin_contactar", "outreach_enviado"),
      })
    ).toBe("Lead / sin contactar → Outreach enviado");
    expect(activityHeadline({ type: "system", body: null, metadata: null })).toBe("Proyecto creado");
    expect(activityHeadline({ type: "note", body: "una nota", metadata: null })).toBe("una nota");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- activity-log`
Expected: FAIL (módulo `@/lib/activity-log` no existe).

- [ ] **Step 3: Implement `lib/activity-log.ts`**

```ts
import { STAGES, labelOf, stageGroupFor, type Option } from "@/lib/project-pipeline";

export const ACTIVITY_TYPES = [
  { value: "email", label: "Email" },
  { value: "call", label: "Llamada" },
  { value: "meeting", label: "Reunión" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "note", label: "Nota" },
  { value: "task", label: "Tarea" },
  { value: "diagnostic", label: "Diagnóstico" },
  { value: "document", label: "Documento" },
  { value: "stage_change", label: "Cambio de etapa" },
  { value: "proposal", label: "Propuesta" },
  { value: "contract", label: "Contrato" },
  { value: "system", label: "Sistema" },
] satisfies Option[];
export const ACTIVITY_TYPE_VALUES = ACTIVITY_TYPES.map((t) => t.value);

export const ACTIVITY_DIRECTIONS = [
  { value: "inbound", label: "Entrante" },
  { value: "outbound", label: "Saliente" },
  { value: "internal", label: "Interno" },
  { value: "none", label: "N/A" },
] satisfies Option[];
export const ACTIVITY_DIRECTION_VALUES = ACTIVITY_DIRECTIONS.map((d) => d.value);

export const ACTIVITY_SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "diagnostic_engine", label: "Diagnóstico web" },
  { value: "gmail", label: "Gmail" },
  { value: "calendar", label: "Calendario" },
  { value: "system", label: "Sistema" },
] satisfies Option[];
export const ACTIVITY_SOURCE_VALUES = ACTIVITY_SOURCES.map((s) => s.value);

export type StageChangeMetadata = {
  fromStage: string;
  toStage: string;
  fromGroup: string;
  toGroup: string;
};

export function stageChangeMetadata(fromStage: string, toStage: string): StageChangeMetadata {
  return {
    fromStage,
    toStage,
    fromGroup: stageGroupFor(fromStage),
    toGroup: stageGroupFor(toStage),
  };
}

export function describeStageChange(metadata: StageChangeMetadata): string {
  return `${labelOf(STAGES, metadata.fromStage)} → ${labelOf(STAGES, metadata.toStage)}`;
}

export function activityTypeLabel(type: string): string {
  return labelOf(ACTIVITY_TYPES, type);
}

export function activityHeadline(activity: {
  type: string;
  body: string | null;
  metadata: unknown;
}): string {
  if (activity.type === "stage_change" && activity.metadata) {
    return describeStageChange(activity.metadata as StageChangeMetadata);
  }
  if (activity.type === "system") return "Proyecto creado";
  if (activity.type === "note") return activity.body ?? "";
  return activityTypeLabel(activity.type);
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(date: Date | string): string {
  return dateTimeFormatter.format(typeof date === "string" ? new Date(date) : date);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- activity-log`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/activity-log.ts test/activity-log.test.ts
git commit -m "feat: helpers puros de activity-log (enums, labels, stage_change metadata)"
```

---

### Task 3: Capa de datos de Activities (`db/activities.ts`)

**Files:**
- Create: `db/activities.ts`
- Test: `test/activities.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `activities`, `Activity` de `@/db/schema`; `AnyDb`.
- Produces:
  - `type NewActivityInput = { companyId: string; projectId: string; userId: string | null; type: string; direction: string | null; subject: string | null; body: string | null; occurredAt?: Date; source: string; metadata: unknown }`
  - `createActivity(db: AnyDb, input: NewActivityInput): Promise<Activity>`
  - `listActivitiesForProject(db: AnyDb, projectId: string, opts?: { type?: string }): Promise<Activity[]>`

- [ ] **Step 1: Write the failing test**

Añadir a `test/activities.test.ts` (nuevo `describe` al final):

```ts
import { createActivity, listActivitiesForProject } from "@/db/activities";
import { projects } from "@/db/schema";

describe("db/activities", () => {
  async function seed() {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [proj] = await db
      .insert(projects)
      .values({ companyId: company.id, name: "P" })
      .returning();
    return { db, companyId: company.id, projectId: proj.id };
  }

  it("createActivity inserta y devuelve la fila", async () => {
    const { db, companyId, projectId } = await seed();
    const row = await createActivity(db, {
      companyId,
      projectId,
      userId: null,
      type: "note",
      direction: "internal",
      subject: null,
      body: "hola",
      source: "manual",
      metadata: null,
    });
    expect(row.id).toBeTruthy();
    expect(row.body).toBe("hola");
  });

  it("listActivitiesForProject ordena desc por occurred_at y filtra por type", async () => {
    const { db, companyId, projectId } = await seed();
    await createActivity(db, {
      companyId, projectId, userId: null, type: "system",
      direction: "none", subject: null, body: null, source: "system",
      metadata: null, occurredAt: new Date("2026-01-01T10:00:00Z"),
    });
    await createActivity(db, {
      companyId, projectId, userId: null, type: "note",
      direction: "internal", subject: null, body: "reciente", source: "manual",
      metadata: null, occurredAt: new Date("2026-02-01T10:00:00Z"),
    });

    const all = await listActivitiesForProject(db, projectId);
    expect(all).toHaveLength(2);
    expect(all[0].body).toBe("reciente"); // más reciente primero

    const notes = await listActivitiesForProject(db, projectId, { type: "note" });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe("note");
  });

  it("listActivitiesForProject scopea por projectId", async () => {
    const { db, companyId, projectId } = await seed();
    const [other] = await db
      .insert(projects)
      .values({ companyId, name: "Otro" })
      .returning();
    await createActivity(db, {
      companyId, projectId: other.id, userId: null, type: "note",
      direction: "internal", subject: null, body: "de otro", source: "manual", metadata: null,
    });
    const rows = await listActivitiesForProject(db, projectId);
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- activities`
Expected: FAIL (no existe `@/db/activities`).

- [ ] **Step 3: Implement `db/activities.ts`**

```ts
import { and, desc, eq } from "drizzle-orm";
import { activities } from "./schema";
import type { Activity } from "./schema";
import type { AnyDb } from "@/db/types";

export type NewActivityInput = {
  companyId: string;
  projectId: string;
  userId: string | null;
  type: string;
  direction: string | null;
  subject: string | null;
  body: string | null;
  occurredAt?: Date;
  source: string;
  metadata: unknown;
};

export async function createActivity(db: AnyDb, input: NewActivityInput): Promise<Activity> {
  const [row] = await db.insert(activities).values(input).returning();
  return row;
}

export async function listActivitiesForProject(
  db: AnyDb,
  projectId: string,
  opts: { type?: string } = {}
): Promise<Activity[]> {
  return db
    .select()
    .from(activities)
    .where(
      opts.type
        ? and(eq(activities.projectId, projectId), eq(activities.type, opts.type))
        : eq(activities.projectId, projectId)
    )
    .orderBy(desc(activities.occurredAt), desc(activities.createdAt));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- activities`
Expected: PASS (todos los casos de `test/activities.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add db/activities.ts test/activities.test.ts
git commit -m "feat: db/activities (createActivity, listActivitiesForProject; append-only)"
```

---

### Task 4: `noteCreateSchema` (`lib/validation.ts`)

**Files:**
- Modify: `lib/validation.ts` (añadir schema + tipo al final)
- Test: `test/validation.test.ts` (añadir describe)

**Interfaces:**
- Produces: `noteCreateSchema` (`{ projectId: string (uuid); body: string (min 1, trim) }`), `type NoteCreateInput`.

- [ ] **Step 1: Write the failing test**

Añadir a `test/validation.test.ts`:

```ts
import { noteCreateSchema } from "@/lib/validation";

describe("noteCreateSchema", () => {
  const pid = "11111111-1111-1111-1111-111111111111";

  it("acepta body válido y trimea", () => {
    const r = noteCreateSchema.safeParse({ projectId: pid, body: "  hola  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.body).toBe("hola");
  });

  it("rechaza body vacío/whitespace", () => {
    const r = noteCreateSchema.safeParse({ projectId: pid, body: "   " });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("La nota no puede estar vacía");
  });

  it("rechaza projectId no-uuid", () => {
    const r = noteCreateSchema.safeParse({ projectId: "nope", body: "hola" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- validation`
Expected: FAIL (no export `noteCreateSchema`).

- [ ] **Step 3: Implement en `lib/validation.ts`**

Añadir al final del archivo:

```ts
export const noteCreateSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  body: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "La nota no puede estar vacía")
  ),
});

export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- validation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts test/validation.test.ts
git commit -m "feat: noteCreateSchema (projectId uuid + body requerido)"
```

---

### Task 5: Glue `runCreateNote` (`lib/activity-mutations.ts`)

**Files:**
- Create: `lib/activity-mutations.ts`
- Test: `test/activity-mutations.test.ts`

**Interfaces:**
- Consumes: `noteCreateSchema` de `@/lib/validation`; `createActivity` de `@/db/activities`; `getProject` de `@/db/projects`; `ActionResult` de `@/lib/company-mutations`; `AnyDb`.
- Produces: `runCreateNote(db: AnyDb, formData: FormData, actorUserId: string | null): Promise<ActionResult>`.

- [ ] **Step 1: Write the failing test**

Create `test/activity-mutations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { projects } from "@/db/schema";
import { listActivitiesForProject } from "@/db/activities";
import { runCreateNote } from "@/lib/activity-mutations";

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

describe("runCreateNote", () => {
  it("crea una nota manual con companyId resuelto desde el project", async () => {
    const { db, companyId, projectId } = await seed();
    const res = await runCreateNote(
      db,
      formOf({ projectId, body: "  llamé al cliente  " }),
      "22222222-2222-2222-2222-222222222222"
    );
    expect(res).toEqual({ ok: true });

    const [row] = await listActivitiesForProject(db, projectId);
    expect(row.type).toBe("note");
    expect(row.direction).toBe("internal");
    expect(row.source).toBe("manual");
    expect(row.body).toBe("llamé al cliente");
    expect(row.companyId).toBe(companyId);
    expect(row.userId).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("rechaza body vacío", async () => {
    const { db, projectId } = await seed();
    const res = await runCreateNote(db, formOf({ projectId, body: "   " }), null);
    expect(res.ok).toBe(false);
  });

  it("rechaza project inexistente", async () => {
    const { db } = await seed();
    const res = await runCreateNote(
      db,
      formOf({ projectId: "00000000-0000-0000-0000-000000000000", body: "hola" }),
      null
    );
    expect(res).toEqual({ ok: false, error: "No se encontró el proyecto" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- activity-mutations`
Expected: FAIL (no existe `@/lib/activity-mutations`).

- [ ] **Step 3: Implement `lib/activity-mutations.ts`**

```ts
import type { AnyDb } from "@/db/types";
import { noteCreateSchema } from "@/lib/validation";
import { createActivity } from "@/db/activities";
import { getProject } from "@/db/projects";
import type { ActionResult } from "@/lib/company-mutations";

export async function runCreateNote(
  db: AnyDb,
  formData: FormData,
  actorUserId: string | null
): Promise<ActionResult> {
  const parsed = noteCreateSchema.safeParse({
    projectId: formData.get("projectId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const project = await getProject(db, parsed.data.projectId);
  if (!project) {
    return { ok: false, error: "No se encontró el proyecto" };
  }
  try {
    await createActivity(db, {
      companyId: project.companyId,
      projectId: project.id,
      userId: actorUserId,
      type: "note",
      direction: "internal",
      subject: null,
      body: parsed.data.body,
      source: "manual",
      metadata: null,
    });
  } catch {
    return { ok: false, error: "No se pudo guardar la nota" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- activity-mutations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/activity-mutations.ts test/activity-mutations.test.ts
git commit -m "feat: runCreateNote (glue de nota manual, companyId desde el project)"
```

---

### Task 6: `runCreateProject` registra Activity `system` (transacción)

**Files:**
- Modify: `lib/project-mutations.ts` (`runCreateProject`)
- Test: `test/project-mutations.test.ts` (añadir caso)

**Interfaces:**
- Consumes: `activities`, `projects` de `@/db/schema`; namespace `* as activityLog` de `@/lib/activity-log` (para Task 7; en esta task solo se usa `projects`/`activities`).
- Produces: `runCreateProject` sigue con firma `(db, formData, ownerUserId)` y ahora inserta 1 Activity `system` en la misma transacción que crea el project.

- [ ] **Step 1: Write the failing test**

Añadir a `test/project-mutations.test.ts` (dentro del `describe("runCreateProject")`):

```ts
  it("registra una Activity 'system' al crear el proyecto", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    await runCreateProject(
      db,
      formOf({ companyId: company.id, name: "Planta", stage: "lead_sin_contactar" }),
      "33333333-3333-3333-3333-333333333333"
    );
    const [proj] = await listProjects(db, company.id);
    const acts = await listActivitiesForProject(db, proj.id);
    expect(acts).toHaveLength(1);
    expect(acts[0].type).toBe("system");
    expect(acts[0].source).toBe("system");
    expect(acts[0].companyId).toBe(company.id);
    expect(acts[0].userId).toBe("33333333-3333-3333-3333-333333333333");
  });
```

Y añadir el import al tope del archivo de test:

```ts
import { listActivitiesForProject } from "@/db/activities";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- project-mutations`
Expected: FAIL (la activity `system` no se crea; `acts` tiene length 0).

- [ ] **Step 3: Modify `runCreateProject`**

En `lib/project-mutations.ts`, reemplazar imports superiores y el cuerpo del `try` de creación:

Cambiar imports:

```ts
import type { AnyDb } from "@/db/types";
import { type NewProjectInput, type ProjectUpdateFields } from "@/db/projects";
import { projects, activities } from "@/db/schema";
import { projectCreateSchema, projectUpdateSchema } from "@/lib/validation";
import { stageGroupFor } from "@/lib/project-pipeline";
import * as activityLog from "@/lib/activity-log";
import { eq } from "drizzle-orm";
import type { ActionResult } from "@/lib/company-mutations";
```

(Se elimina el import de `createProject`/`updateProject`; ahora se escribe con `tx` inline.)

Reemplazar el bloque `try { await createProject(db, input); } ...` por:

```ts
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(projects).values(input).returning();
      await tx.insert(activities).values({
        companyId: created.companyId,
        projectId: created.id,
        userId: ownerUserId,
        type: "system",
        direction: "none",
        subject: null,
        body: null,
        source: "system",
        metadata: null,
      });
    });
  } catch {
    return { ok: false, error: "No se pudo crear el proyecto" };
  }
  return { ok: true };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- project-mutations`
Expected: PASS (nuevo caso + los existentes de `runCreateProject`).

- [ ] **Step 5: Commit**

```bash
git add lib/project-mutations.ts test/project-mutations.test.ts
git commit -m "feat: runCreateProject registra Activity system en transacción"
```

---

### Task 7: `runUpdateProject` registra `stage_change` (transacción + firma actorUserId)

**Files:**
- Modify: `lib/project-mutations.ts` (`runUpdateProject`)
- Test: `test/project-mutations.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `projects`, `activities` de `@/db/schema`; `* as activityLog` de `@/lib/activity-log`; `eq` de `drizzle-orm` (ya importados en Task 6).
- Produces: `runUpdateProject(db, formData, actorUserId: string | null = null)` — inserta exactamente 1 Activity `stage_change` cuando cambia la etapa, 0 si no cambia o si cambia otro campo.

- [ ] **Step 1: Write the failing tests**

Añadir a `test/project-mutations.test.ts` (dentro del `describe("runUpdateProject")`), y agregar `vi` al import de vitest del tope: `import { describe, it, expect, vi } from "vitest";`

```ts
  it("cambiar la etapa registra exactamente 1 stage_change con metadata y actor", async () => {
    const { db, company, id } = await seed();
    const res = await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P", stage: "outreach_enviado", status: "open", solutionType: "unknown" }),
      "44444444-4444-4444-4444-444444444444"
    );
    expect(res).toEqual({ ok: true });
    const acts = (await listActivitiesForProject(db, id)).filter((a) => a.type === "stage_change");
    expect(acts).toHaveLength(1);
    expect(acts[0].userId).toBe("44444444-4444-4444-4444-444444444444");
    expect(acts[0].metadata).toEqual({
      fromStage: "lead_sin_contactar",
      toStage: "outreach_enviado",
      fromGroup: "lead",
      toGroup: "qualification",
    });
  });

  it("no registra stage_change si la etapa no cambia", async () => {
    const { db, company, id } = await seed();
    await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "Nuevo nombre", stage: "lead_sin_contactar", status: "open", solutionType: "unknown" })
    );
    const acts = (await listActivitiesForProject(db, id)).filter((a) => a.type === "stage_change");
    expect(acts).toHaveLength(0);
  });

  it("rollback: si falla el registro de stage_change, el update se revierte", async () => {
    const { db, company, id } = await seed();
    const spy = vi.spyOn(activityLog, "stageChangeMetadata").mockImplementation(() => {
      throw new Error("boom");
    });
    const res = await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P", stage: "contrato_firmado", status: "open", solutionType: "unknown" })
    );
    expect(res.ok).toBe(false);
    const [row] = await listAllProjects(db);
    expect(row.stage).toBe("lead_sin_contactar"); // revertido
    spy.mockRestore();
  });
```

Añadir al tope del archivo de test:

```ts
import * as activityLog from "@/lib/activity-log";
```

(El import de `listActivitiesForProject` y `listAllProjects` ya está presente por tasks previas.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- project-mutations`
Expected: FAIL (no se crea stage_change; el rollback no revierte).

- [ ] **Step 3: Modify `runUpdateProject`**

Cambiar la firma y el cuerpo del `try` de update en `lib/project-mutations.ts`:

```ts
export async function runUpdateProject(
  db: AnyDb,
  formData: FormData,
  actorUserId: string | null = null
): Promise<ActionResult> {
```

Reemplazar el bloque `try { const row = await updateProject(db, id, fields); ... }` por:

```ts
  try {
    const result = await db.transaction(async (tx): Promise<ActionResult> => {
      const [current] = await tx
        .select({ stage: projects.stage, companyId: projects.companyId })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      if (!current) {
        return { ok: false, error: "No se encontró el proyecto" };
      }
      await tx.update(projects).set(fields).where(eq(projects.id, id));
      if (current.stage !== fields.stage) {
        await tx.insert(activities).values({
          companyId: current.companyId,
          projectId: id,
          userId: actorUserId,
          type: "stage_change",
          direction: "none",
          subject: null,
          body: null,
          source: "system",
          metadata: activityLog.stageChangeMetadata(current.stage, fields.stage),
        });
      }
      return { ok: true };
    });
    return result;
  } catch {
    return { ok: false, error: "No se pudo actualizar el proyecto" };
  }
```

Nota: `id` sigue siendo el string validado arriba en la función (sin cambios en esa parte). El caso "id inexistente" retorna `{ ok: false, error: "No se encontró el proyecto" }` desde dentro de la transacción (sin escrituras).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- project-mutations`
Expected: PASS (nuevos casos + los 4 existentes de `runUpdateProject`, incluido "id inexistente" y "status=lost").

- [ ] **Step 5: Full suite green**

Run: `npm test`
Expected: PASS (todos; los tests P1 que llaman `runUpdateProject(db, fd)` con 2 args siguen válidos porque `actorUserId` es opcional).

- [ ] **Step 6: Commit**

```bash
git add lib/project-mutations.ts test/project-mutations.test.ts
git commit -m "feat: runUpdateProject registra stage_change inmutable en transacción (actorUserId)"
```

---

### Task 8: Server actions (`updateProjectAction` pasa actor; `createNoteAction`)

**Files:**
- Modify: `app/projects/actions.ts`
- Test: (sin unit test; las actions dependen de Supabase/db client. Verificación por typecheck/build en Task 9. La lógica testeable vive en el glue.)

**Interfaces:**
- Consumes: `runCreateNote` de `@/lib/activity-mutations`; `createClient` de `@/lib/supabase/server`; `runUpdateProject` (nueva firma).
- Produces: `createNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult>`; `updateProjectAction` ahora pasa `user?.id ?? null`.

- [ ] **Step 1: Modify `app/projects/actions.ts`**

Añadir `runCreateNote` al import de mutations:

```ts
import { runCreateProject, runUpdateProject } from "@/lib/project-mutations";
import { runCreateNote } from "@/lib/activity-mutations";
```

Reemplazar `updateProjectAction` para obtener el usuario y pasarlo:

```ts
export async function updateProjectAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const result = await runUpdateProject(db, formData, user?.id ?? null);
  if (result.ok) {
    revalidatePath("/projects");
    const id = formData.get("id");
    if (typeof id === "string" && id.length > 0) revalidatePath(`/projects/${id}`);
    const companyId = idSchema.safeParse(formData.get("companyId"));
    if (companyId.success) revalidatePath(`/companies/${companyId.data}`);
  }
  return result;
}
```

Añadir `createNoteAction` al final del archivo:

```ts
export async function createNoteAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const result = await runCreateNote(db, formData, user?.id ?? null);
  if (result.ok) {
    const projectId = idSchema.safeParse(formData.get("projectId"));
    if (projectId.success) revalidatePath(`/projects/${projectId.data}`);
  }
  return result;
}
```

- [ ] **Step 2: Typecheck/lint**

Run: `npm run lint`
Expected: sin errores en `app/projects/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/projects/actions.ts
git commit -m "feat: createNoteAction + updateProjectAction pasa actor userId"
```

---

### Task 9: UI de timeline en `/projects/[id]`

**Files:**
- Create: `components/new-note-form.tsx`
- Create: `components/activity-filter.tsx`
- Create: `components/activity-timeline.tsx`
- Modify: `app/projects/[id]/page.tsx`
- Test: (verificación por `npm run build` + revisión manual; el proyecto no tiene tests de componentes React.)

**Interfaces:**
- Consumes: `createNoteAction` de `@/app/projects/actions`; `listActivitiesForProject` de `@/db/activities`; `Activity` de `@/db/schema`; `activityHeadline`, `activityTypeLabel`, `formatDateTime`, `ACTIVITY_TYPES` de `@/lib/activity-log`; `ActionResult`.

- [ ] **Step 1: Create `components/new-note-form.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createNoteAction } from "@/app/projects/actions";
import type { ActionResult } from "@/lib/company-mutations";

export function NewNoteForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createNoteAction,
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
    <form ref={formRef} action={formAction} className="mt-4 grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Nueva nota</span>
        <textarea
          name="body"
          rows={3}
          required
          className="rounded-md border px-3 py-2"
          placeholder="Registrá una nota…"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Agregar nota"}
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create `components/activity-filter.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `components/activity-timeline.tsx`**

```tsx
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
```

- [ ] **Step 4: Modify `app/projects/[id]/page.tsx`**

Reemplazar el archivo completo por:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getProject } from "@/db/projects";
import { getCompany } from "@/db/companies";
import { listActivitiesForProject } from "@/db/activities";
import { ProjectDetailForm } from "@/components/project-detail-form";
import { ProjectArchiveButton } from "@/components/project-archive-button";
import { NewNoteForm } from "@/components/new-note-form";
import { ActivityFilter } from "@/components/activity-filter";
import { ActivityTimeline } from "@/components/activity-timeline";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activityType?: string }>;
}) {
  const { id } = await params;
  const { activityType } = await searchParams;
  const project = await getProject(db, id);
  if (!project) notFound();

  const company = await getCompany(db, project.companyId);
  const archived = project.archivedAt !== null;
  const activities = await listActivitiesForProject(db, id, { type: activityType });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link href={`/companies/${project.companyId}`} className="text-sm underline">
        ← {company?.name ?? "Empresa"}
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">{project.name}</h1>
        <ProjectArchiveButton id={project.id} archived={archived} />
      </div>
      {archived && (
        <p className="mt-2 text-sm text-neutral-500">Este proyecto está archivado.</p>
      )}
      <ProjectDetailForm project={project} />

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-2xl tracking-display">Actividad</h2>
          <ActivityFilter />
        </div>
        {!archived && <NewNoteForm projectId={project.id} />}
        <ActivityTimeline activities={activities} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Build to verify UI compiles**

Run: `npm run build`
Expected: build OK, sin errores de tipos en las páginas/componentes nuevos.

- [ ] **Step 6: Manual verification (opcional pero recomendado)**

Correr `npm run dev`, entrar a un `/projects/[id]`, y verificar:
- La timeline muestra "Proyecto creado" (evento system del seed, si el project se creó tras P2a) o queda "Sin actividad todavía." para projects pre-existentes.
- Agregar una nota la muestra al tope.
- Cambiar la etapa en `ProjectDetailForm` y guardar agrega un item "Cambio de etapa" con "X → Y".
- El filtro por tipo recarga y acota.

- [ ] **Step 7: Commit**

```bash
git add components/new-note-form.tsx components/activity-filter.tsx components/activity-timeline.tsx "app/projects/[id]/page.tsx"
git commit -m "feat: sección Actividad en /projects/[id] (timeline + nota + filtro)"
```

---

### Task 10: Verificación final de rama + deploy de migración

**Files:** ninguno (verificación).

- [ ] **Step 1: Suite completa + build + lint**

Run: `npm test && npm run build && npm run lint`
Expected: todo verde.

- [ ] **Step 2: Confirmar migración generada**

Run: `git status` y verificar que `db/migrations/0004_*.sql` está commiteada y contiene `CREATE TABLE "activities"` + `ENABLE ROW LEVEL SECURITY`.

- [ ] **Step 3: Aplicar a Supabase prod (paso del usuario o con OK explícito)**

Post-merge, aplicar la migración 0004 a prod:

```bash
set -a; . ./.env.local; set +a; npm run db:migrate
```

Expected: `0004` aplicada. NO ejecutar sin OK explícito del usuario.

---

## Self-Review

**Spec coverage (spec §→task):**
- §1 tabla `activities` (columnas, índices, RLS, diferidos) → Task 1. ✓
- §2 enums + helpers puros → Task 2. ✓
- §3 capa de datos (createActivity, listActivitiesForProject, append-only) → Task 3. ✓
- §4 glue: `noteCreateSchema` → Task 4; `runCreateNote` → Task 5; `runCreateProject` +system (tx) → Task 6; `runUpdateProject` +stage_change (tx, nueva firma) → Task 7. ✓
- §5 server actions → Task 8. ✓
- §6 UI (NewNoteForm, filtro query param, timeline; autor diferido) → Task 9. ✓
- §7 tests → distribuidos por task (puros T2/T4, datos T1/T3, glue T5/T6/T7). ✓ (Inmutabilidad = estructural: `db/activities.ts` sin mutadores; rollback cubierto en T7 vía spy.)
- §8 migración + deploy → Task 1 (generate) + Task 10 (apply). ✓
- §9 postura de seguridad → `.enableRLS()` en Task 1. ✓

**Placeholder scan:** sin TBD/TODO; todos los pasos con código completo o comando exacto. ✓

**Type consistency:** `NewActivityInput` (T3) usado igual en T5/T6/T7; `stageChangeMetadata`/`StageChangeMetadata` (T2) consumidos en T7 y UI; `runUpdateProject(db, formData, actorUserId=null)` firma única usada en T7/T8; `activityHeadline`/`activityTypeLabel`/`formatDateTime` (T2) usados en T9. ✓

**Nota de riesgo (transacciones):** `db.transaction(...)` sobre PGlite y postgres-js. Si en ejecución PGlite diera problemas con la transacción, el fallback es escribir la Activity de forma secuencial (update → insert) sin `tx`, aceptando atomicidad best-effort; documentar el cambio si se toma.
