# Projects P1 (CRUD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entidad `Project` con CRUD (crear/listar/editar/archivar) asociado a Company, con etapa/grupo/status/solución, creación company-scoped y páginas `/projects` + `/projects/[id]`.

**Architecture:** Mirroring de companies/contacts: schema → función pura de pipeline → data layer → schemas Zod → glue puro → server actions delgadas → UI. `stage_group` derivado de `stage` por función pura. Enums como columnas `text` validadas por Zod union. Sin cambios de comportamiento de pipeline (stage_change/Activities/Tasks/Kanban son slices posteriores).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Drizzle ORM, Zod, @tanstack/react-table, Vitest + PGlite in-process, Supabase Auth (server client).

Spec: `docs/superpowers/specs/2026-08-12-projects-p1-crud-design.md`.

## Global Constraints

- TDD siempre: test primero → verlo fallar → implementación mínima → verlo pasar → commit.
- UI copy en español.
- `ActionResult` se importa de `@/lib/company-mutations` (no redefinir).
- Zod opcionales: reusar `optionalText` de `lib/validation.ts` (vacío/no-string → null).
- Tipos honestos: updates/archive/restore retornan `Promise<Project | undefined>`.
- Update por `id` únicamente (sin scoping companyId/ownership → slice RLS). `companyId` viaja como hidden field para revalidar.
- `stage_group` NUNCA se edita a mano: lo deriva `stageGroupFor(stage)` en el glue.
- Transiciones automáticas de `status` (won/active_customer) NO se implementan en P1.
- `owner_user_id` se setea al usuario actual (Supabase auth) al crear; no editable ni mostrado en P1.
- Enums = columnas `text` + Zod union (NO `pgEnum` nativo).
- Tests: `npm test` (Vitest). Un archivo: `npx vitest run test/<archivo>.test.ts`. Typecheck: `npx tsc --noEmit`.
- Commits terminan con línea `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Valores de enums (fuente de verdad — Task 2 los codifica)

- **stage (13)** slug→label: `lead_sin_contactar`→Lead / sin contactar · `outreach_enviado`→Outreach enviado · `respondio_interesado`→Respondió / interesado · `diagnostico_web`→Diagnóstico web · `webcall_discovery`→Webcall / discovery · `propuesta_preparacion`→Propuesta en preparación · `propuesta_enviada`→Propuesta enviada · `negociacion_objeciones`→Negociación / objeciones · `propuesta_aceptada`→Propuesta aceptada · `contrato_enviado`→Contrato enviado · `contrato_firmado`→Contrato firmado · `onboarding_kickoff`→Onboarding / kickoff · `cliente_activo`→Cliente activo
- **stage_group (6)**: lead, qualification, solution, commercial, delivery, active
- **stage→group**: lead_sin_contactar→lead · outreach_enviado,respondio_interesado→qualification · diagnostico_web,webcall_discovery,propuesta_preparacion→solution · propuesta_enviada,negociacion_objeciones,propuesta_aceptada→commercial · contrato_enviado,contrato_firmado,onboarding_kickoff→delivery · cliente_activo→active
- **status (5)**: open→Abierto · won→Ganado · lost→Perdido · paused→Pausado · active_customer→Cliente activo
- **solution_type (4)**: solar→Solar · bess→BESS · solar_bess→Solar + BESS · unknown→Sin definir
- **source (5)**: diagnostico_web→Diagnóstico web · referido→Referido · outbound→Outbound · intermepro→Intermepro · otro→Otro
- **lost_reason (7)**: precio→Precio · timing→Timing · competencia→Competencia · sin_presupuesto→Sin presupuesto · sin_respuesta→Sin respuesta · no_viable_tecnico→No viable técnico · otro→Otro

---

### Task 1: tabla `projects` + migración 0003 + schema test

**Files:**
- Modify: `db/schema.ts`
- Test: `test/schema.test.ts`
- Generated: `db/migrations/0003_*.sql` (+ meta) vía `npm run db:generate`

**Interfaces:**
- Consumes: `pgTable, uuid, text, timestamp, integer, date, index` de `drizzle-orm/pg-core`; `companies` (para la FK).
- Produces: `projects` table + `Project`/`NewProject` types.

- [ ] **Step 1: Escribir el test que falla**

En `test/schema.test.ts`, agregar `projects` al import desde `@/db/schema` y un test (mirar el helper `createTestDb`/patrón existente del archivo):

```ts
it("projects: inserta un proyecto ligado a una company con defaults", async () => {
  const db = await createTestDb();
  const [company] = await db.insert(companies).values({ name: "Acme" }).returning();
  const [project] = await db
    .insert(projects)
    .values({ companyId: company.id, name: "Planta Norte" })
    .returning();
  expect(project.id).toBeTruthy();
  expect(project.companyId).toBe(company.id);
  expect(project.stage).toBe("lead_sin_contactar");
  expect(project.stageGroup).toBe("lead");
  expect(project.status).toBe("open");
  expect(project.solutionType).toBe("unknown");
  expect(project.archivedAt).toBeNull();
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run test/schema.test.ts`
Expected: FAIL (`projects` undefined).

- [ ] **Step 3: Agregar la tabla al schema**

En `db/schema.ts`: (a) ampliar el import de `drizzle-orm/pg-core` a
`import { pgTable, uuid, text, timestamp, integer, date, index } from "drizzle-orm/pg-core";`
(b) agregar al final, después de `contacts`/`Contact`:

```ts
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    ownerUserId: uuid("owner_user_id"),
    plantName: text("plant_name"),
    locationAddress: text("location_address"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    industrySubsegment: text("industry_subsegment"),
    stage: text("stage").notNull().default("lead_sin_contactar"),
    stageGroup: text("stage_group").notNull().default("lead"),
    status: text("status").notNull().default("open"),
    solutionType: text("solution_type").notNull().default("unknown"),
    estimatedValue: integer("estimated_value"),
    probability: integer("probability"),
    expectedCloseDate: date("expected_close_date", { mode: "string" }),
    source: text("source"),
    lostReason: text("lost_reason"),
    lostReasonNote: text("lost_reason_note"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("projects_company_id_idx").on(t.companyId),
    index("projects_archived_at_idx").on(t.archivedAt),
    index("projects_stage_group_idx").on(t.stageGroup),
  ]
).enableRLS();

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
```

- [ ] **Step 4: Generar la migración**

Run: `npm run db:generate`
Expected: crea `db/migrations/0003_*.sql` con `CREATE TABLE "projects"`, la FK a `companies`, los 3 índices y `ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;`. No debe pedir prompts (es add puro). Inspeccioná el SQL generado para confirmar.

- [ ] **Step 5: Verificar que pasa**

Run: `npx vitest run test/schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts db/migrations test/schema.test.ts
git commit -m "feat: projects table + migration 0003 (TDD)"
```

---

### Task 2: `lib/project-pipeline.ts` (constantes + `stageGroupFor` puro)

**Files:**
- Create: `lib/project-pipeline.ts`
- Test: `test/project-pipeline.test.ts`

**Interfaces:**
- Produces: `STAGES, STAGE_GROUPS, STATUSES, SOLUTION_TYPES, SOURCES, LOST_REASONS` (arrays `{value,label}`); `STAGE_VALUES, STATUS_VALUES, SOLUTION_TYPE_VALUES, SOURCE_VALUES, LOST_REASON_VALUES` (arrays de slugs); `stageGroupFor(stage: string): string`; `labelOf(options, value): string`; `formatMXN(value: number | null): string`.

- [ ] **Step 1: Escribir el test que falla**

Crear `test/project-pipeline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { stageGroupFor, labelOf, formatMXN, STAGES } from "@/lib/project-pipeline";

describe("stageGroupFor", () => {
  const cases: Array<[string, string]> = [
    ["lead_sin_contactar", "lead"],
    ["outreach_enviado", "qualification"],
    ["respondio_interesado", "qualification"],
    ["diagnostico_web", "solution"],
    ["webcall_discovery", "solution"],
    ["propuesta_preparacion", "solution"],
    ["propuesta_enviada", "commercial"],
    ["negociacion_objeciones", "commercial"],
    ["propuesta_aceptada", "commercial"],
    ["contrato_enviado", "delivery"],
    ["contrato_firmado", "delivery"],
    ["onboarding_kickoff", "delivery"],
    ["cliente_activo", "active"],
  ];
  it.each(cases)("%s -> %s", (stage, group) => {
    expect(stageGroupFor(stage)).toBe(group);
  });
  it("cubre las 13 etapas", () => {
    expect(cases.map((c) => c[0]).sort()).toEqual(STAGES.map((s) => s.value).sort());
  });
  it("stage desconocido cae a lead", () => {
    expect(stageGroupFor("no_existe")).toBe("lead");
  });
});

describe("labelOf / formatMXN", () => {
  it("labelOf devuelve el label o — para null", () => {
    expect(labelOf(STAGES, "cliente_activo")).toBe("Cliente activo");
    expect(labelOf(STAGES, null)).toBe("—");
  });
  it("formatMXN formatea o devuelve —", () => {
    expect(formatMXN(null)).toBe("—");
    expect(formatMXN(1500000)).toContain("1,500,000");
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run test/project-pipeline.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar el módulo**

Crear `lib/project-pipeline.ts` (usar los valores de la sección "Valores de enums" de este plan, verbatim):

```ts
export type Option = { value: string; label: string };

export const STAGES = [
  { value: "lead_sin_contactar", label: "Lead / sin contactar" },
  { value: "outreach_enviado", label: "Outreach enviado" },
  { value: "respondio_interesado", label: "Respondió / interesado" },
  { value: "diagnostico_web", label: "Diagnóstico web" },
  { value: "webcall_discovery", label: "Webcall / discovery" },
  { value: "propuesta_preparacion", label: "Propuesta en preparación" },
  { value: "propuesta_enviada", label: "Propuesta enviada" },
  { value: "negociacion_objeciones", label: "Negociación / objeciones" },
  { value: "propuesta_aceptada", label: "Propuesta aceptada" },
  { value: "contrato_enviado", label: "Contrato enviado" },
  { value: "contrato_firmado", label: "Contrato firmado" },
  { value: "onboarding_kickoff", label: "Onboarding / kickoff" },
  { value: "cliente_activo", label: "Cliente activo" },
] satisfies Option[];

export const STAGE_GROUPS = [
  { value: "lead", label: "Lead" },
  { value: "qualification", label: "Qualification" },
  { value: "solution", label: "Solution" },
  { value: "commercial", label: "Commercial" },
  { value: "delivery", label: "Delivery" },
  { value: "active", label: "Active" },
] satisfies Option[];

export const STATUSES = [
  { value: "open", label: "Abierto" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
  { value: "paused", label: "Pausado" },
  { value: "active_customer", label: "Cliente activo" },
] satisfies Option[];

export const SOLUTION_TYPES = [
  { value: "solar", label: "Solar" },
  { value: "bess", label: "BESS" },
  { value: "solar_bess", label: "Solar + BESS" },
  { value: "unknown", label: "Sin definir" },
] satisfies Option[];

export const SOURCES = [
  { value: "diagnostico_web", label: "Diagnóstico web" },
  { value: "referido", label: "Referido" },
  { value: "outbound", label: "Outbound" },
  { value: "intermepro", label: "Intermepro" },
  { value: "otro", label: "Otro" },
] satisfies Option[];

export const LOST_REASONS = [
  { value: "precio", label: "Precio" },
  { value: "timing", label: "Timing" },
  { value: "competencia", label: "Competencia" },
  { value: "sin_presupuesto", label: "Sin presupuesto" },
  { value: "sin_respuesta", label: "Sin respuesta" },
  { value: "no_viable_tecnico", label: "No viable técnico" },
  { value: "otro", label: "Otro" },
] satisfies Option[];

export const STAGE_VALUES = STAGES.map((s) => s.value);
export const STATUS_VALUES = STATUSES.map((s) => s.value);
export const SOLUTION_TYPE_VALUES = SOLUTION_TYPES.map((s) => s.value);
export const SOURCE_VALUES = SOURCES.map((s) => s.value);
export const LOST_REASON_VALUES = LOST_REASONS.map((s) => s.value);

const STAGE_TO_GROUP: Record<string, string> = {
  lead_sin_contactar: "lead",
  outreach_enviado: "qualification",
  respondio_interesado: "qualification",
  diagnostico_web: "solution",
  webcall_discovery: "solution",
  propuesta_preparacion: "solution",
  propuesta_enviada: "commercial",
  negociacion_objeciones: "commercial",
  propuesta_aceptada: "commercial",
  contrato_enviado: "delivery",
  contrato_firmado: "delivery",
  onboarding_kickoff: "delivery",
  cliente_activo: "active",
};

export function stageGroupFor(stage: string): string {
  return STAGE_TO_GROUP[stage] ?? "lead";
}

export function labelOf(options: readonly Option[], value: string | null): string {
  if (value == null) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function formatMXN(value: number | null): string {
  return value == null ? "—" : mxnFormatter.format(value);
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run test/project-pipeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/project-pipeline.ts test/project-pipeline.test.ts
git commit -m "feat: project-pipeline constants + stageGroupFor (TDD)"
```

---

### Task 3: `db/projects.ts` data layer

**Files:**
- Create: `db/projects.ts`
- Test: `test/projects.test.ts`

**Interfaces:**
- Consumes: `projects`, `companies`, `Project` (schema); `and, desc, eq, isNull, isNotNull` (drizzle-orm); `AnyDb`.
- Produces:
  - `type NewProjectInput = { companyId; name; ownerUserId: string|null; stage; stageGroup; status; solutionType; estimatedValue: number|null; notes: string|null }`
  - `type ProjectUpdateFields = { name; plantName; locationAddress; city; state; country; industrySubsegment; stage; stageGroup; status; solutionType; estimatedValue: number|null; probability: number|null; expectedCloseDate: string|null; source; lostReason; lostReasonNote; notes }` (los `*Reason/*Name/...` string|null)
  - `type ProjectListRow = Project & { companyName: string }`
  - `createProject(db, input): Promise<Project>`
  - `listProjects(db, companyId, { archived? }): Promise<Project[]>`
  - `listAllProjects(db, { archived? }): Promise<ProjectListRow[]>`
  - `getProject(db, id): Promise<Project | undefined>`
  - `updateProject(db, id, fields): Promise<Project | undefined>`
  - `archiveProject(db, id) / restoreProject(db, id): Promise<Project | undefined>`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `test/projects.test.ts` (usar `createTestDb()`; helper local para armar input):

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import {
  createProject,
  listProjects,
  listAllProjects,
  getProject,
  updateProject,
  archiveProject,
  restoreProject,
  type NewProjectInput,
  type ProjectUpdateFields,
} from "@/db/projects";

function newInput(companyId: string, name = "Planta"): NewProjectInput {
  return {
    companyId,
    name,
    ownerUserId: null,
    stage: "lead_sin_contactar",
    stageGroup: "lead",
    status: "open",
    solutionType: "unknown",
    estimatedValue: null,
    notes: null,
  };
}

function updateFields(over: Partial<ProjectUpdateFields> = {}): ProjectUpdateFields {
  return {
    name: "Planta Norte",
    plantName: null,
    locationAddress: null,
    city: null,
    state: null,
    country: null,
    industrySubsegment: null,
    stage: "lead_sin_contactar",
    stageGroup: "lead",
    status: "open",
    solutionType: "unknown",
    estimatedValue: null,
    probability: null,
    expectedCloseDate: null,
    source: null,
    lostReason: null,
    lostReasonNote: null,
    notes: null,
    ...over,
  };
}

describe("createProject / listProjects", () => {
  it("crea un proyecto ligado a la company y lo lista", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const project = await createProject(db, newInput(company.id, "Planta Norte"));
    expect(project.companyId).toBe(company.id);
    expect(project.name).toBe("Planta Norte");
    const rows = await listProjects(db, company.id);
    expect(rows.map((r) => r.id)).toContain(project.id);
  });

  it("listProjects filtra por company y por archived", async () => {
    const db = await createTestDb();
    const a = await createCompany(db, { name: "A" });
    const b = await createCompany(db, { name: "B" });
    const pa = await createProject(db, newInput(a.id));
    await createProject(db, newInput(b.id));
    await archiveProject(db, pa.id);
    expect(await listProjects(db, a.id)).toHaveLength(0);
    expect(await listProjects(db, a.id, { archived: true })).toHaveLength(1);
    expect(await listProjects(db, b.id)).toHaveLength(1);
  });
});

describe("listAllProjects", () => {
  it("retorna todos con companyName y filtra archived", async () => {
    const db = await createTestDb();
    const a = await createCompany(db, { name: "Acme" });
    const p = await createProject(db, newInput(a.id, "Planta X"));
    const rows = await listAllProjects(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].companyName).toBe("Acme");
    await archiveProject(db, p.id);
    expect(await listAllProjects(db)).toHaveLength(0);
    expect(await listAllProjects(db, { archived: true })).toHaveLength(1);
  });
});

describe("getProject / updateProject / archive / restore", () => {
  it("getProject retorna la fila o undefined", async () => {
    const db = await createTestDb();
    const c = await createCompany(db, { name: "Acme" });
    const p = await createProject(db, newInput(c.id));
    expect((await getProject(db, p.id))?.id).toBe(p.id);
    expect(await getProject(db, "00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });

  it("updateProject actualiza campos y retorna la fila; undefined si no existe; updatedAt avanza", async () => {
    const db = await createTestDb();
    const c = await createCompany(db, { name: "Acme" });
    const p = await createProject(db, newInput(c.id));
    const updated = await updateProject(
      db,
      p.id,
      updateFields({ name: "Nueva", stage: "propuesta_enviada", stageGroup: "commercial", estimatedValue: 5000 })
    );
    expect(updated?.name).toBe("Nueva");
    expect(updated?.stage).toBe("propuesta_enviada");
    expect(updated?.stageGroup).toBe("commercial");
    expect(updated?.estimatedValue).toBe(5000);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(p.updatedAt.getTime());
    expect(await updateProject(db, "00000000-0000-0000-0000-000000000000", updateFields())).toBeUndefined();
  });

  it("archiveProject / restoreProject togglean archivedAt", async () => {
    const db = await createTestDb();
    const c = await createCompany(db, { name: "Acme" });
    const p = await createProject(db, newInput(c.id));
    expect((await archiveProject(db, p.id))?.archivedAt).not.toBeNull();
    expect((await restoreProject(db, p.id))?.archivedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run test/projects.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar el data layer**

Crear `db/projects.ts`:

```ts
import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { projects, companies } from "./schema";
import type { Project } from "./schema";
import type { AnyDb } from "@/db/types";

export type NewProjectInput = {
  companyId: string;
  name: string;
  ownerUserId: string | null;
  stage: string;
  stageGroup: string;
  status: string;
  solutionType: string;
  estimatedValue: number | null;
  notes: string | null;
};

export type ProjectUpdateFields = {
  name: string;
  plantName: string | null;
  locationAddress: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  industrySubsegment: string | null;
  stage: string;
  stageGroup: string;
  status: string;
  solutionType: string;
  estimatedValue: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  source: string | null;
  lostReason: string | null;
  lostReasonNote: string | null;
  notes: string | null;
};

export type ProjectListRow = Project & { companyName: string };

export async function createProject(db: AnyDb, input: NewProjectInput): Promise<Project> {
  const [row] = await db.insert(projects).values(input).returning();
  return row;
}

export async function listProjects(
  db: AnyDb,
  companyId: string,
  opts: { archived?: boolean } = {}
): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.companyId, companyId),
        opts.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt)
      )
    )
    .orderBy(desc(projects.createdAt));
}

export async function listAllProjects(
  db: AnyDb,
  opts: { archived?: boolean } = {}
): Promise<ProjectListRow[]> {
  const rows = await db
    .select({ project: projects, companyName: companies.name })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(opts.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt))
    .orderBy(desc(projects.createdAt));
  return rows.map((r) => ({ ...r.project, companyName: r.companyName }));
}

export async function getProject(db: AnyDb, id: string): Promise<Project | undefined> {
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row;
}

export async function updateProject(
  db: AnyDb,
  id: string,
  fields: ProjectUpdateFields
): Promise<Project | undefined> {
  const [row] = await db.update(projects).set(fields).where(eq(projects.id, id)).returning();
  return row;
}

export async function archiveProject(db: AnyDb, id: string): Promise<Project | undefined> {
  const [row] = await db
    .update(projects)
    .set({ archivedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return row;
}

export async function restoreProject(db: AnyDb, id: string): Promise<Project | undefined> {
  const [row] = await db
    .update(projects)
    .set({ archivedAt: null })
    .where(eq(projects.id, id))
    .returning();
  return row;
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run test/projects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/projects.ts test/projects.test.ts
git commit -m "feat: projects data layer con tests (TDD)"
```

---

### Task 4: schemas Zod (`projectCreateSchema` + `projectUpdateSchema`)

**Files:**
- Modify: `lib/validation.ts`

**Interfaces:**
- Consumes: `z`, `optionalText` (existentes); `STAGE_VALUES, STATUS_VALUES, SOLUTION_TYPE_VALUES, SOURCE_VALUES, LOST_REASON_VALUES` de `@/lib/project-pipeline`.
- Produces: `projectCreateSchema`, `projectUpdateSchema` (+ tipos inferidos).

Sin test dedicado (se cubren vía los tests del glue en Task 5). Verificación: `npx tsc --noEmit`.

- [ ] **Step 1: Agregar los schemas**

En `lib/validation.ts`, agregar el import arriba
`import { STAGE_VALUES, STATUS_VALUES, SOLUTION_TYPE_VALUES, SOURCE_VALUES, LOST_REASON_VALUES } from "@/lib/project-pipeline";`
y al final del archivo:

```ts
function requiredEnum(values: string[], message: string, fallback?: string) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : fallback ?? v),
    z.string().refine((val) => values.includes(val), { message })
  );
}

function optionalEnum(values: string[], message: string) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
    z.string().refine((val) => values.includes(val), { message }).nullable()
  );
}

function optionalInt(opts: { max?: number } = {}) {
  const base = opts.max === undefined
    ? z.number().int().min(0)
    : z.number().int().min(0).max(opts.max);
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : null),
    base.nullable()
  );
}

const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").nullable()
);

export const projectCreateSchema = z.object({
  companyId: z.string().uuid("Empresa inválida"),
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "El nombre es obligatorio")
  ),
  stage: requiredEnum(STAGE_VALUES, "Etapa inválida", "lead_sin_contactar"),
  solutionType: requiredEnum(SOLUTION_TYPE_VALUES, "Solución inválida", "unknown"),
  estimatedValue: optionalInt(),
  notes: optionalText,
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z
  .object({
    name: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : ""),
      z.string().min(1, "El nombre es obligatorio")
    ),
    plantName: optionalText,
    locationAddress: optionalText,
    city: optionalText,
    state: optionalText,
    country: optionalText,
    industrySubsegment: optionalText,
    stage: requiredEnum(STAGE_VALUES, "Etapa inválida"),
    status: requiredEnum(STATUS_VALUES, "Status inválido"),
    solutionType: requiredEnum(SOLUTION_TYPE_VALUES, "Solución inválida"),
    estimatedValue: optionalInt(),
    probability: optionalInt({ max: 100 }),
    expectedCloseDate: optionalDate,
    source: optionalEnum(SOURCE_VALUES, "Fuente inválida"),
    lostReason: optionalEnum(LOST_REASON_VALUES, "Motivo inválido"),
    lostReasonNote: optionalText,
    notes: optionalText,
  })
  .refine((d) => d.status !== "lost" || d.lostReason != null, {
    message: "Falta el motivo de pérdida",
    path: ["lostReason"],
  });

export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/validation.ts
git commit -m "feat: projectCreateSchema + projectUpdateSchema (enums + refine)"
```

---

### Task 5: `lib/project-mutations.ts` glue

**Files:**
- Create: `lib/project-mutations.ts`
- Test: `test/project-mutations.test.ts`

**Interfaces:**
- Consumes: `createProject`, `updateProject`, `NewProjectInput`, `ProjectUpdateFields` (Task 3); `projectCreateSchema`, `projectUpdateSchema` (Task 4); `stageGroupFor` (Task 2); `ActionResult` (`@/lib/company-mutations`); `AnyDb`.
- Produces: `runCreateProject(db, formData, ownerUserId: string | null): Promise<ActionResult>`; `runUpdateProject(db, formData): Promise<ActionResult>`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `test/project-mutations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { listProjects, listAllProjects } from "@/db/projects";
import { runCreateProject, runUpdateProject } from "@/lib/project-mutations";

function formOf(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("runCreateProject", () => {
  it("crea con defaults y deriva stage_group", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const result = await runCreateProject(
      db,
      formOf({ companyId: company.id, name: "Planta Norte", stage: "propuesta_enviada" }),
      "user-123"
    );
    expect(result).toEqual({ ok: true });
    const [row] = await listProjects(db, company.id);
    expect(row.name).toBe("Planta Norte");
    expect(row.stage).toBe("propuesta_enviada");
    expect(row.stageGroup).toBe("commercial");
    expect(row.status).toBe("open");
    expect(row.ownerUserId).toBe("user-123");
  });

  it("aplica defaults cuando faltan stage/solution", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    await runCreateProject(db, formOf({ companyId: company.id, name: "P" }), null);
    const [row] = await listProjects(db, company.id);
    expect(row.stage).toBe("lead_sin_contactar");
    expect(row.stageGroup).toBe("lead");
    expect(row.solutionType).toBe("unknown");
  });

  it("falla con name vacío", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const result = await runCreateProject(db, formOf({ companyId: company.id, name: "  " }), null);
    expect(result.ok).toBe(false);
  });

  it("falla con companyId no-uuid", async () => {
    const db = await createTestDb();
    const result = await runCreateProject(db, formOf({ companyId: "nope", name: "P" }), null);
    expect(result).toEqual({ ok: false, error: "Empresa inválida" });
  });
});

describe("runUpdateProject", () => {
  async function seed() {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    await runCreateProject(db, formOf({ companyId: company.id, name: "P" }), null);
    const [row] = await listProjects(db, company.id);
    return { db, company, id: row.id };
  }

  it("actualiza y re-deriva stage_group", async () => {
    const { db, company, id } = await seed();
    const result = await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P2", stage: "contrato_enviado", status: "open", solutionType: "solar" })
    );
    expect(result).toEqual({ ok: true });
    const [row] = await listAllProjects(db);
    expect(row.name).toBe("P2");
    expect(row.stage).toBe("contrato_enviado");
    expect(row.stageGroup).toBe("delivery");
    expect(row.solutionType).toBe("solar");
  });

  it("falla si falta id", async () => {
    const { db } = await seed();
    const result = await runUpdateProject(db, formOf({ name: "P" }));
    expect(result).toEqual({ ok: false, error: "Falta el identificador del proyecto" });
  });

  it("status=lost sin lostReason falla; con lostReason ok", async () => {
    const { db, company, id } = await seed();
    const base = { id, companyId: company.id, name: "P", stage: "negociacion_objeciones", solutionType: "unknown" };
    const bad = await runUpdateProject(db, formOf({ ...base, status: "lost" }));
    expect(bad).toEqual({ ok: false, error: "Falta el motivo de pérdida" });
    const good = await runUpdateProject(db, formOf({ ...base, status: "lost", lostReason: "precio" }));
    expect(good).toEqual({ ok: true });
  });

  it("id inexistente → No se encontró el proyecto", async () => {
    const { db, company } = await seed();
    const result = await runUpdateProject(
      db,
      formOf({
        id: "00000000-0000-0000-0000-000000000000",
        companyId: company.id,
        name: "P",
        stage: "lead_sin_contactar",
        status: "open",
        solutionType: "unknown",
      })
    );
    expect(result).toEqual({ ok: false, error: "No se encontró el proyecto" });
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run test/project-mutations.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar el glue**

Crear `lib/project-mutations.ts`:

```ts
import type { AnyDb } from "@/db/types";
import {
  createProject,
  updateProject,
  type NewProjectInput,
  type ProjectUpdateFields,
} from "@/db/projects";
import { projectCreateSchema, projectUpdateSchema } from "@/lib/validation";
import { stageGroupFor } from "@/lib/project-pipeline";
import type { ActionResult } from "@/lib/company-mutations";

export async function runCreateProject(
  db: AnyDb,
  formData: FormData,
  ownerUserId: string | null
): Promise<ActionResult> {
  const parsed = projectCreateSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    stage: formData.get("stage"),
    solutionType: formData.get("solutionType"),
    estimatedValue: formData.get("estimatedValue"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input: NewProjectInput = {
    companyId: parsed.data.companyId,
    name: parsed.data.name,
    ownerUserId,
    stage: parsed.data.stage,
    stageGroup: stageGroupFor(parsed.data.stage),
    status: "open",
    solutionType: parsed.data.solutionType,
    estimatedValue: parsed.data.estimatedValue,
    notes: parsed.data.notes,
  };
  try {
    await createProject(db, input);
  } catch {
    return { ok: false, error: "No se pudo crear el proyecto" };
  }
  return { ok: true };
}

export async function runUpdateProject(
  db: AnyDb,
  formData: FormData
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Falta el identificador del proyecto" };
  }
  const parsed = projectUpdateSchema.safeParse({
    name: formData.get("name"),
    plantName: formData.get("plantName"),
    locationAddress: formData.get("locationAddress"),
    city: formData.get("city"),
    state: formData.get("state"),
    country: formData.get("country"),
    industrySubsegment: formData.get("industrySubsegment"),
    stage: formData.get("stage"),
    status: formData.get("status"),
    solutionType: formData.get("solutionType"),
    estimatedValue: formData.get("estimatedValue"),
    probability: formData.get("probability"),
    expectedCloseDate: formData.get("expectedCloseDate"),
    source: formData.get("source"),
    lostReason: formData.get("lostReason"),
    lostReasonNote: formData.get("lostReasonNote"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const fields: ProjectUpdateFields = {
    ...parsed.data,
    stageGroup: stageGroupFor(parsed.data.stage),
  };
  try {
    const row = await updateProject(db, id, fields);
    if (!row) {
      return { ok: false, error: "No se encontró el proyecto" };
    }
  } catch {
    return { ok: false, error: "No se pudo actualizar el proyecto" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run test/project-mutations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/project-mutations.ts test/project-mutations.test.ts
git commit -m "feat: project-mutations glue con tests (TDD)"
```

---

### Task 6: `app/projects/actions.ts` server actions

**Files:**
- Create: `app/projects/actions.ts`

**Interfaces:**
- Consumes: `runCreateProject`, `runUpdateProject` (Task 5); `archiveProject`, `restoreProject` (Task 3); `db`; `createClient` de `@/lib/supabase/server`; `ActionResult`; `revalidatePath`, `redirect`, `z`.
- Produces: `createProjectAction`, `updateProjectAction` (`(_prev, formData) => Promise<ActionResult>`); `archiveProjectAction`, `restoreProjectAction` (`(formData) => Promise<void>`).

Sin test dedicado (actions delgadas; lógica en el glue ya testeado). Verificación: `npx tsc --noEmit`.

- [ ] **Step 1: Crear las actions**

Crear `app/projects/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { archiveProject, restoreProject } from "@/db/projects";
import { runCreateProject, runUpdateProject } from "@/lib/project-mutations";
import type { ActionResult } from "@/lib/company-mutations";

const idSchema = z.string().uuid();

export async function createProjectAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const result = await runCreateProject(db, formData, user?.id ?? null);
  if (result.ok) {
    revalidatePath("/projects");
    const companyId = idSchema.safeParse(formData.get("companyId"));
    if (companyId.success) revalidatePath(`/companies/${companyId.data}`);
  }
  return result;
}

export async function updateProjectAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const result = await runUpdateProject(db, formData);
  if (result.ok) {
    revalidatePath("/projects");
    const id = formData.get("id");
    if (typeof id === "string" && id.length > 0) revalidatePath(`/projects/${id}`);
    const companyId = idSchema.safeParse(formData.get("companyId"));
    if (companyId.success) revalidatePath(`/companies/${companyId.data}`);
  }
  return result;
}

export async function archiveProjectAction(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  if (id.success) await archiveProject(db, id.data);
  revalidatePath("/projects");
  redirect(id.success ? `/projects/${id.data}` : "/projects");
}

export async function restoreProjectAction(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  if (id.success) await restoreProject(db, id.data);
  revalidatePath("/projects");
  redirect(id.success ? `/projects/${id.data}` : "/projects");
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/projects/actions.ts
git commit -m "feat: projects server actions (owner desde auth, revalidate)"
```

---

### Task 7: UI — `NewProjectForm` + `ProjectTable`

**Files:**
- Create: `components/new-project-form.tsx`
- Create: `components/project-table.tsx`

**Interfaces:**
- Consumes: `createProjectAction` (Task 6); `ActionResult`; `Project`, `ProjectListRow` (Task 3); `STAGES`, `SOLUTION_TYPES`, `STATUSES`, `labelOf`, `formatMXN` (Task 2); tanstack-table.
- Produces: `NewProjectForm({ companyId })`; `ProjectTable({ data, archived, showCompany })`.

Sin tests (componentes client). Verificación: `npx tsc --noEmit`.

- [ ] **Step 1: Crear `NewProjectForm`**

Crear `components/new-project-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { createProjectAction } from "@/app/projects/actions";
import type { ActionResult } from "@/lib/company-mutations";
import { STAGES, SOLUTION_TYPES } from "@/lib/project-pipeline";

export function NewProjectForm({ companyId }: { companyId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createProjectAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Nombre</span>
        <input name="name" required className="rounded-md border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Solución</span>
        <select name="solutionType" defaultValue="unknown" className="rounded-md border px-3 py-2">
          {SOLUTION_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Etapa</span>
        <select name="stage" defaultValue="lead_sin_contactar" className="rounded-md border px-3 py-2">
          {STAGES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Valor estimado (MXN)</span>
        <input name="estimatedValue" type="number" min="0" className="rounded-md border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-medium text-sm">Notas</span>
        <textarea name="notes" rows={2} className="rounded-md border px-3 py-2" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Agregar proyecto"}
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Crear `ProjectTable`**

Crear `components/project-table.tsx`:

```tsx
"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import Link from "next/link";
import type { ProjectListRow } from "@/db/projects";
import { STAGES, STATUSES, SOLUTION_TYPES, labelOf, formatMXN } from "@/lib/project-pipeline";

const columnHelper = createColumnHelper<ProjectListRow>();

function buildColumns(showCompany: boolean) {
  // Explicit ColumnDef[] typing: accessors of different value types (string vs
  // number) mixed via conditional .push() would otherwise infer too narrow.
  const cols: ColumnDef<ProjectListRow, any>[] = [
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => (
        <Link href={`/projects/${info.row.original.id}`} className="underline">
          {info.getValue()}
        </Link>
      ),
    }),
  ];
  if (showCompany) {
    cols.push(
      columnHelper.accessor("companyName", {
        header: "Empresa",
        cell: (info) => info.getValue() ?? "—",
      })
    );
  }
  cols.push(
    columnHelper.accessor("stage", {
      header: "Etapa",
      cell: (info) => labelOf(STAGES, info.getValue()),
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => labelOf(STATUSES, info.getValue()),
    }),
    columnHelper.accessor("solutionType", {
      header: "Solución",
      cell: (info) => labelOf(SOLUTION_TYPES, info.getValue()),
    }),
    columnHelper.accessor("estimatedValue", {
      header: "Valor",
      cell: (info) => formatMXN(info.getValue()),
    })
  );
  return cols;
}

export function ProjectTable({
  data,
  archived = false,
  showCompany = false,
}: {
  data: ProjectListRow[];
  archived?: boolean;
  showCompany?: boolean;
}) {
  const table = useReactTable({
    data,
    columns: buildColumns(showCompany),
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <p className="mt-4 text-sm text-neutral-500">
        {archived ? "No hay proyectos archivados." : "Aún no hay proyectos."}
      </p>
    );
  }

  return (
    <table className="mt-4 w-full text-left text-sm">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id} className="border-b">
            {hg.headers.map((h) => (
              <th key={h.id} className="col-label py-2">
                {flexRender(h.column.columnDef.header, h.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className="border-b">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="py-2">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

> Nota: `ProjectTable` tipa `data` como `ProjectListRow[]`. La sección de empresa (Task 11) pasa `Project[]` con `showCompany={false}`; `Project` es asignable donde `companyName` no se lee. Si `tsc` se queja por `companyName` faltante, tipar el prop como `data: (Project & { companyName?: string })[]` y ajustar el accessor de empresa a `info.row.original.companyName`. Usar esa variante si hace falta para compilar.

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/new-project-form.tsx components/project-table.tsx
git commit -m "feat: NewProjectForm + ProjectTable (selects, labels, MXN)"
```

---

### Task 8: UI — `ProjectDetailForm` + `ProjectArchiveButton`

**Files:**
- Create: `components/project-detail-form.tsx`
- Create: `components/project-archive-button.tsx`

**Interfaces:**
- Consumes: `updateProjectAction`, `archiveProjectAction`, `restoreProjectAction` (Task 6); `ActionResult`; `Project` (schema); `STAGES, STATUSES, SOLUTION_TYPES, SOURCES, LOST_REASONS, STAGE_GROUPS, stageGroupFor, labelOf` (Task 2); `useActionState/useEffect/useRef`, `useRouter`.
- Produces: `ProjectDetailForm({ project })`; `ProjectArchiveButton({ id, archived })`.

Sin tests (componentes client). Verificación: `npx tsc --noEmit`.

- [ ] **Step 1: Crear `ProjectArchiveButton`**

Crear `components/project-archive-button.tsx` (espejo de `CompanyArchiveButton`):

```tsx
"use client";

import {
  archiveProjectAction,
  restoreProjectAction,
} from "@/app/projects/actions";

export function ProjectArchiveButton({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  return (
    <form
      action={archived ? restoreProjectAction : archiveProjectAction}
      onSubmit={(e) => {
        if (!archived && !window.confirm("¿Archivar este proyecto?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="font-semibold text-sm underline">
        {archived ? "Restaurar" : "Archivar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Crear `ProjectDetailForm`**

Crear `components/project-detail-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateProjectAction } from "@/app/projects/actions";
import type { ActionResult } from "@/lib/company-mutations";
import type { Project } from "@/db/schema";
import {
  STAGES,
  STATUSES,
  SOLUTION_TYPES,
  SOURCES,
  LOST_REASONS,
  labelOf,
  STAGE_GROUPS,
  stageGroupFor,
} from "@/lib/project-pipeline";

type Opt = { value: string; label: string };

function Select({
  name,
  label,
  options,
  defaultValue,
  includeBlank,
}: {
  name: string;
  label: string;
  options: readonly Opt[];
  defaultValue: string;
  includeBlank?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium text-sm">{label}</span>
      <select name={name} defaultValue={defaultValue} className="rounded-md border px-3 py-2">
        {includeBlank && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Text({
  name,
  label,
  defaultValue,
  type = "text",
  full,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1${full ? " sm:col-span-2" : ""}`}>
      <span className="font-medium text-sm">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="rounded-md border px-3 py-2"
      />
    </label>
  );
}

export function ProjectDetailForm({ project }: { project: Project }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateProjectAction,
    null
  );
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (state?.ok && !handled.current) {
      handled.current = true;
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="mt-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={project.id} />
      <input type="hidden" name="companyId" value={project.companyId} />

      <Text name="name" label="Nombre" defaultValue={project.name} full />

      <Select name="stage" label="Etapa" options={STAGES} defaultValue={project.stage} />
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Grupo (derivado)</span>
        <input
          disabled
          value={labelOf(STAGE_GROUPS, stageGroupFor(project.stage))}
          className="rounded-md border bg-neutral-100 px-3 py-2 text-neutral-500"
        />
      </label>

      <Select name="status" label="Status" options={STATUSES} defaultValue={project.status} />
      <Select
        name="solutionType"
        label="Solución"
        options={SOLUTION_TYPES}
        defaultValue={project.solutionType}
      />

      <Text
        name="estimatedValue"
        label="Valor estimado (MXN)"
        type="number"
        defaultValue={project.estimatedValue?.toString() ?? ""}
      />
      <Text
        name="probability"
        label="Probabilidad (%)"
        type="number"
        defaultValue={project.probability?.toString() ?? ""}
      />
      <Text
        name="expectedCloseDate"
        label="Cierre esperado"
        type="date"
        defaultValue={project.expectedCloseDate ?? ""}
      />
      <Select
        name="source"
        label="Fuente"
        options={SOURCES}
        defaultValue={project.source ?? ""}
        includeBlank
      />

      <Select
        name="lostReason"
        label="Motivo de pérdida"
        options={LOST_REASONS}
        defaultValue={project.lostReason ?? ""}
        includeBlank
      />
      <Text name="lostReasonNote" label="Nota de pérdida" defaultValue={project.lostReasonNote ?? ""} />

      <Text name="plantName" label="Planta" defaultValue={project.plantName ?? ""} />
      <Text name="industrySubsegment" label="Subsegmento" defaultValue={project.industrySubsegment ?? ""} />
      <Text name="locationAddress" label="Dirección" defaultValue={project.locationAddress ?? ""} full />
      <Text name="city" label="Ciudad" defaultValue={project.city ?? ""} />
      <Text name="state" label="Estado" defaultValue={project.state ?? ""} />
      <Text name="country" label="País" defaultValue={project.country ?? ""} />

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-medium text-sm">Notas</span>
        <textarea
          name="notes"
          defaultValue={project.notes ?? ""}
          rows={3}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        {state?.ok && <p className="text-sm text-green-600">Cambios guardados.</p>}
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
```

> Nota: el "Grupo (derivado)" mostrado es estático al valor guardado de `stage` (se actualiza tras guardar + `router.refresh()`), consistente con P1 (sin reactividad en vivo). No se envía como campo; el glue lo re-deriva.

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/project-detail-form.tsx components/project-archive-button.tsx
git commit -m "feat: ProjectDetailForm + ProjectArchiveButton"
```

---

### Task 9: página `/projects` (lista top-level) + cross-link en `/companies`

**Files:**
- Create: `app/projects/page.tsx`
- Modify: `app/companies/page.tsx`

**Interfaces:**
- Consumes: `listAllProjects` (Task 3); `ProjectTable` (Task 7); `db`; `Link`.

Sin test (page server). Verificación: `npx tsc --noEmit`.

- [ ] **Step 1: Crear `app/projects/page.tsx`**

```tsx
import Link from "next/link";
import { db } from "@/db/client";
import { listAllProjects } from "@/db/projects";
import { ProjectTable } from "@/components/project-table";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const projects = await listAllProjects(db, { archived: showArchived });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">Proyectos</h1>
        <Link href="/companies" className="text-sm underline">
          Empresas
        </Link>
      </div>

      <div className="mt-6 flex gap-4 text-sm">
        <Link href="/projects" className={showArchived ? "underline" : "font-semibold"}>
          Activos
        </Link>
        <Link
          href="/projects?archived=1"
          className={showArchived ? "font-semibold" : "underline"}
        >
          Archivados
        </Link>
      </div>

      <ProjectTable data={projects} archived={showArchived} showCompany />
    </main>
  );
}
```

- [ ] **Step 2: Agregar cross-link en `app/companies/page.tsx`**

En el `<div className="flex items-center justify-between">` del header (donde está el botón "Salir"), agregar un link a Proyectos **antes** del form de Salir, envolviendo ambos en un contenedor flex si hace falta. Cambiar:

```tsx
        <form action={signOut}>
          <button className="font-semibold text-sm underline">Salir</button>
        </form>
```
por:
```tsx
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-sm underline">
            Proyectos
          </Link>
          <form action={signOut}>
            <button className="font-semibold text-sm underline">Salir</button>
          </form>
        </div>
```
(`Link` ya está importado en ese archivo.)

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/projects/page.tsx app/companies/page.tsx
git commit -m "feat: /projects list page + cross-link desde /companies"
```

---

### Task 10: página `/projects/[id]` (detalle)

**Files:**
- Create: `app/projects/[id]/page.tsx`

**Interfaces:**
- Consumes: `getProject` (Task 3); `getCompany` (`@/db/companies`); `ProjectDetailForm`, `ProjectArchiveButton` (Task 8); `db`; `notFound`, `Link`.

Sin test (page server). Verificación: `npx tsc --noEmit`.

- [ ] **Step 1: Crear `app/projects/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getProject } from "@/db/projects";
import { getCompany } from "@/db/companies";
import { ProjectDetailForm } from "@/components/project-detail-form";
import { ProjectArchiveButton } from "@/components/project-archive-button";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(db, id);
  if (!project) notFound();

  const company = await getCompany(db, project.companyId);
  const archived = project.archivedAt !== null;

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
    </main>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/projects/[id]/page.tsx
git commit -m "feat: /projects/[id] detail page (edit + archive)"
```

---

### Task 11: sección "Proyectos" en el detalle de empresa + verificación de suite

**Files:**
- Modify: `app/companies/[id]/page.tsx`

**Interfaces:**
- Consumes: `listProjects` (Task 3); `NewProjectForm`, `ProjectTable` (Task 7).

Sin test propio; esta task cierra con la suite completa. Verificación: `npx tsc --noEmit` + `npm test` + `npm run build`.

- [ ] **Step 1: Ampliar `searchParams` y cargar proyectos**

En `app/companies/[id]/page.tsx`:
1. Agregar imports: `import { listProjects } from "@/db/projects";`, `import { NewProjectForm } from "@/components/new-project-form";`, `import { ProjectTable } from "@/components/project-table";`.
2. Ampliar el tipo de `searchParams` a `{ contactsArchived?: string; projectsArchived?: string }` y desestructurar `projectsArchived`.
3. Después de cargar `contactRows`, agregar:
```tsx
  const showArchivedProjects = projectsArchived === "1";
  const projectRows = await listProjects(db, company.id, {
    archived: showArchivedProjects,
  });
```

- [ ] **Step 2: Renderizar la sección "Proyectos"**

Después de la `<section>` de "Contactos" (antes de cerrar `</main>`), agregar (espejo de Contactos):

```tsx
      <section className="mt-12">
        <h2 className="font-display font-bold text-2xl tracking-display">Proyectos</h2>
        <div className="mt-4 flex gap-4 text-sm">
          <Link
            href={`/companies/${company.id}`}
            className={showArchivedProjects ? "underline" : "font-semibold"}
          >
            Activos
          </Link>
          <Link
            href={`/companies/${company.id}?projectsArchived=1`}
            className={showArchivedProjects ? "font-semibold" : "underline"}
          >
            Archivados
          </Link>
        </div>
        {!showArchivedProjects && <NewProjectForm companyId={company.id} />}
        <ProjectTable data={projectRows} archived={showArchivedProjects} />
      </section>
```

> Nota: `ProjectTable` recibe `Project[]` acá (sin `companyName`), con `showCompany` en `false` (default). Ver la nota de Task 7 si `tsc` exige ajustar el tipo del prop.

- [ ] **Step 3: Verificar typecheck + suite + build**

```bash
npx tsc --noEmit && npm test && npm run build
```
Expected: tsc sin errores; **todos** los tests PASS (los previos + project-pipeline + projects + project-mutations); build OK.

- [ ] **Step 4: Commit**

```bash
git add app/companies/[id]/page.tsx
git commit -m "feat: sección Proyectos en el detalle de empresa (alta + lista)"
```

---

### Task 12: verificación manual + cierre

**Files:** ninguno.

- [ ] **Step 1: Suite completa + typecheck + lint**

```bash
npm test && npx tsc --noEmit && npm run lint
```
Expected: todo verde.

- [ ] **Step 2: Verificación manual en dev (toca Supabase prod — paso del usuario)**

Nota: `npm run dev` se conecta a Supabase prod vía Drizzle. La tabla `projects` **no existe en prod** hasta aplicar la migración 0003 (post-merge). Si se corre dev contra prod antes de migrar, el detalle de empresa fallará al listar proyectos. La verificación manual completa se hace **después** de aplicar la migración. Checklist:
- En un detalle de empresa: sección "Proyectos" con "Nuevo proyecto"; crear uno → aparece en la tabla.
- Clic en el nombre → `/projects/[id]`; editar campos + selects; Guardar → "Cambios guardados"; el grupo derivado refleja la nueva etapa tras refrescar.
- `status = Perdido` sin motivo → error "Falta el motivo de pérdida"; con motivo → guarda.
- Archivar desde el detalle → toggle Activos/Archivados en la empresa y en `/projects`.
- `/projects` lista todos con columna Empresa y valores en MXN.

- [ ] **Step 3: Commit final si hubo ajustes**

Si la verificación no requirió cambios, no hay commit.

---

## Notas de deploy

- `npm run db:generate` produce `db/migrations/0003_*.sql` (en Task 1) — va al repo.
- **Tras merge+push a `main`:** aplicar la migración a Supabase prod con `npm run db:migrate` (DIRECT_URL de `.env.local`); Vercel no corre migraciones. Paso del usuario, o de Claude con OK explícito. Sin esto, cualquier página que liste proyectos rompe en prod (igual que 0002/contacts).
