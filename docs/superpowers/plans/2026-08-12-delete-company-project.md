# Editar / Eliminar en listas de Empresas y Proyectos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar por fila en `/companies` y `/projects` un botón Editar (link al detalle) y un botón Eliminar (borrado permanente en cascada, con AlertDialog de shadcn que muestra el conteo real), manteniendo el archivar existente.

**Architecture:** Borrado transaccional a nivel app (los FKs no tienen ON DELETE CASCADE): mutaciones puras `runDeleteCompany`/`runDeleteProject` borran hijos antes que padres dentro de `db.transaction`. Las páginas de lista usan queries aumentadas con conteos (`count(distinct …)`). La confirmación es un componente client reutilizable sobre shadcn AlertDialog.

**Tech Stack:** Next.js 15 App Router (server actions), Drizzle + PGlite (tests), Vitest, shadcn/ui AlertDialog (Radix), Tailwind v4 con tokens del design system.

## Global Constraints

- **Sin cambio de schema → sin migración.** Se agrega `@radix-ui/react-alert-dialog` a `package.json` (vía shadcn CLI).
- **Tests en `test/`** (no `tests/`), `describe/it/expect`, alias `@/`. PGlite in-process vía `createTestDb()` de `test/db.ts`.
- **Archivar (soft-delete) se mantiene**; el borrado es permanente y aparte. Botón Eliminar en `text-danger`. Copy en **español**, con pluralización (1 proyecto / N proyectos, etc.).
- **UI nueva usa tokens del design system**, no ad-hoc. Utilidades: `text-danger`, `text-muted`, `border-line`, `underline`.
- **Suite flaky con paralelismo** → gate final `npm test -- --no-file-parallelism`; focalizados fiables.
- **`ProjectTable` se reutiliza** en `app/companies/[id]/page.tsx` con `Project[]` plano → los conteos van OPCIONALES y las acciones se activan sólo con un prop `showActions` (solo `/projects` lo pasa). `CompanyTable` es exclusiva de `/companies`.
- Patrón del repo: capa pura sobre `AnyDb` + `db.transaction`; server actions delgadas que `revalidatePath`. `ActionResult = { ok:true } | { ok:false; error:string }` (de `@/lib/company-mutations`).
- Orden de cascada (hijos→padres por FK): empresa = tasks → activities → contacts → projects → company; proyecto = tasks → activities → project.

---

### Task 1: `runDeleteCompany` (cascada transaccional)

**Files:**
- Modify: `lib/company-mutations.ts` (agregar imports + función)
- Test: `test/company-delete.test.ts`

**Interfaces:**
- Consumes: `AnyDb`; tablas `companies, contacts, projects, activities, tasks` de `@/db/schema`; `eq` de `drizzle-orm`.
- Produces: `export async function runDeleteCompany(db: AnyDb, id: string): Promise<ActionResult>`.

- [ ] **Step 1: Write the failing test**

```ts
// test/company-delete.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "./db";
import { runDeleteCompany } from "@/lib/company-mutations";
import { createCompany, listCompanies } from "@/db/companies";
import { createContact, listContacts } from "@/db/contacts";
import { createProject, listAllProjects } from "@/db/projects";
import { createActivity, listActivitiesForProject } from "@/db/activities";
import { createTask, listTasksForProject } from "@/db/tasks";
import type { AnyDb } from "@/db/types";

async function seedCompany(db: AnyDb, name: string) {
  const company = await createCompany(db, { name });
  const project = await createProject(db, {
    companyId: company.id, name: `${name}-P`, ownerUserId: null,
    stage: "lead_sin_contactar", stageGroup: "lead", status: "open",
    solutionType: "unknown", estimatedValue: null, notes: null,
  });
  await createActivity(db, {
    companyId: company.id, projectId: project.id, userId: null, type: "note",
    direction: null, subject: null, body: "n", source: "user", metadata: null,
  });
  await createTask(db, {
    projectId: project.id, companyId: company.id, ownerUserId: null,
    title: "t", dueDate: "2026-09-01",
  });
  await createContact(db, {
    companyId: company.id, name: `${name}-C`, email: null, phone: null, role: null, notes: null,
  });
  return { company, project };
}

describe("runDeleteCompany", () => {
  it("borra la empresa y toda su descendencia; deja intacta otra empresa", async () => {
    const db = await createTestDb();
    const a = await seedCompany(db, "A");
    const b = await seedCompany(db, "B");

    const res = await runDeleteCompany(db, a.company.id);
    expect(res.ok).toBe(true);

    const companyIds = (await listCompanies(db, {})).map((c) => c.id);
    expect(companyIds).not.toContain(a.company.id);
    expect(companyIds).toContain(b.company.id);

    const projectIds = (await listAllProjects(db)).map((p) => p.id);
    expect(projectIds).not.toContain(a.project.id);
    expect(projectIds).toContain(b.project.id);

    expect(await listActivitiesForProject(db, a.project.id)).toHaveLength(0);
    expect(await listTasksForProject(db, a.project.id)).toHaveLength(0);
    expect(await listContacts(db, a.company.id)).toHaveLength(0);

    expect(await listActivitiesForProject(db, b.project.id)).toHaveLength(1);
    expect(await listTasksForProject(db, b.project.id)).toHaveLength(1);
    expect(await listContacts(db, b.company.id)).toHaveLength(1);
  });

  it("empresa inexistente → error", async () => {
    const db = await createTestDb();
    const res = await runDeleteCompany(db, "00000000-0000-0000-0000-000000000000");
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- company-delete`
Expected: FAIL (`runDeleteCompany` no existe).

- [ ] **Step 3: Write minimal implementation**

En `lib/company-mutations.ts`, agregar al bloque de imports:
```ts
import { companies, contacts, projects, activities, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
```
y al final del archivo:
```ts
export async function runDeleteCompany(db: AnyDb, id: string): Promise<ActionResult> {
  try {
    return await db.transaction(async (tx): Promise<ActionResult> => {
      const [existing] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, id))
        .limit(1);
      if (!existing) return { ok: false, error: "No se encontró la empresa" };
      await tx.delete(tasks).where(eq(tasks.companyId, id));
      await tx.delete(activities).where(eq(activities.companyId, id));
      await tx.delete(contacts).where(eq(contacts.companyId, id));
      await tx.delete(projects).where(eq(projects.companyId, id));
      await tx.delete(companies).where(eq(companies.id, id));
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "No se pudo eliminar la empresa" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- company-delete`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/company-mutations.ts test/company-delete.test.ts
git commit -m "feat: runDeleteCompany (borrado permanente en cascada, transaccional)"
```

---

### Task 2: `runDeleteProject` (cascada transaccional)

**Files:**
- Modify: `lib/project-mutations.ts` (agregar `tasks` al import de schema + función)
- Test: `test/project-delete.test.ts`

**Interfaces:**
- Consumes: `AnyDb`; tablas `projects, activities, tasks` de `@/db/schema` (ya importa `projects, activities`; agregar `tasks`); `eq` (ya importado); `ActionResult`.
- Produces: `export async function runDeleteProject(db: AnyDb, id: string): Promise<ActionResult>`.

- [ ] **Step 1: Write the failing test**

```ts
// test/project-delete.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "./db";
import { runDeleteProject } from "@/lib/project-mutations";
import { createCompany } from "@/db/companies";
import { createContact, listContacts } from "@/db/contacts";
import { createProject, listAllProjects } from "@/db/projects";
import { createActivity, listActivitiesForProject } from "@/db/activities";
import { createTask, listTasksForProject } from "@/db/tasks";
import type { AnyDb } from "@/db/types";

async function mkProject(db: AnyDb, companyId: string, name: string) {
  return createProject(db, {
    companyId, name, ownerUserId: null, stage: "lead_sin_contactar", stageGroup: "lead",
    status: "open", solutionType: "unknown", estimatedValue: null, notes: null,
  });
}

describe("runDeleteProject", () => {
  it("borra el proyecto y sus activities/tasks; no toca otros proyectos ni los contacts", async () => {
    const db = await createTestDb();
    const c = await createCompany(db, { name: "C" });
    const p1 = await mkProject(db, c.id, "P1");
    const p2 = await mkProject(db, c.id, "P2");
    await createActivity(db, { companyId: c.id, projectId: p1.id, userId: null, type: "note", direction: null, subject: null, body: "n", source: "user", metadata: null });
    await createTask(db, { projectId: p1.id, companyId: c.id, ownerUserId: null, title: "t1", dueDate: "2026-09-01" });
    await createActivity(db, { companyId: c.id, projectId: p2.id, userId: null, type: "note", direction: null, subject: null, body: "n", source: "user", metadata: null });
    await createTask(db, { projectId: p2.id, companyId: c.id, ownerUserId: null, title: "t2", dueDate: "2026-09-01" });
    await createContact(db, { companyId: c.id, name: "C1", email: null, phone: null, role: null, notes: null });

    const res = await runDeleteProject(db, p1.id);
    expect(res.ok).toBe(true);

    const projectIds = (await listAllProjects(db)).map((p) => p.id);
    expect(projectIds).not.toContain(p1.id);
    expect(projectIds).toContain(p2.id);
    expect(projectIds).toHaveLength(1);

    expect(await listActivitiesForProject(db, p1.id)).toHaveLength(0);
    expect(await listTasksForProject(db, p1.id)).toHaveLength(0);
    expect(await listActivitiesForProject(db, p2.id)).toHaveLength(1);
    expect(await listTasksForProject(db, p2.id)).toHaveLength(1);
    expect(await listContacts(db, c.id)).toHaveLength(1);
  });

  it("proyecto inexistente → error", async () => {
    const db = await createTestDb();
    const res = await runDeleteProject(db, "00000000-0000-0000-0000-000000000000");
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- project-delete`
Expected: FAIL (`runDeleteProject` no existe).

- [ ] **Step 3: Write minimal implementation**

En `lib/project-mutations.ts`, cambiar el import de schema para incluir `tasks`:
```ts
import { projects, activities, tasks } from "@/db/schema";
```
y agregar al final del archivo:
```ts
export async function runDeleteProject(db: AnyDb, id: string): Promise<ActionResult> {
  try {
    return await db.transaction(async (tx): Promise<ActionResult> => {
      const [existing] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      if (!existing) return { ok: false, error: "No se encontró el proyecto" };
      await tx.delete(tasks).where(eq(tasks.projectId, id));
      await tx.delete(activities).where(eq(activities.projectId, id));
      await tx.delete(projects).where(eq(projects.id, id));
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "No se pudo eliminar el proyecto" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- project-delete`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/project-mutations.ts test/project-delete.test.ts
git commit -m "feat: runDeleteProject (borrado permanente en cascada, transaccional)"
```

---

### Task 3: `listCompaniesWithProjectCount`

**Files:**
- Modify: `db/companies.ts`
- Test: `test/companies-count.test.ts`

**Interfaces:**
- Consumes: `sql` de `drizzle-orm` (agregar al import existente `desc, eq, isNull, isNotNull`); `projects` de `./schema` (agregar).
- Produces:
  - `export type CompanyListRow = Company & { projectCount: number }`
  - `export async function listCompaniesWithProjectCount(db: AnyDb, opts?: { archived?: boolean }): Promise<CompanyListRow[]>`

- [ ] **Step 1: Write the failing test**

```ts
// test/companies-count.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "./db";
import { createCompany, listCompaniesWithProjectCount } from "@/db/companies";
import { createProject, archiveProject } from "@/db/projects";
import type { AnyDb } from "@/db/types";

async function mkProject(db: AnyDb, companyId: string, name: string) {
  return createProject(db, {
    companyId, name, ownerUserId: null, stage: "lead_sin_contactar", stageGroup: "lead",
    status: "open", solutionType: "unknown", estimatedValue: null, notes: null,
  });
}

describe("listCompaniesWithProjectCount", () => {
  it("cuenta todos los proyectos de la empresa (incl. archivados); 0 si no tiene", async () => {
    const db = await createTestDb();
    const a = await createCompany(db, { name: "A" });
    const b = await createCompany(db, { name: "B" });
    const p1 = await mkProject(db, a.id, "P1");
    await mkProject(db, a.id, "P2");
    await archiveProject(db, p1.id); // archivado igual cuenta (el hard delete lo borra)

    const rows = await listCompaniesWithProjectCount(db, { archived: false });
    expect(rows.find((r) => r.id === a.id)!.projectCount).toBe(2);
    expect(rows.find((r) => r.id === b.id)!.projectCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- companies-count`
Expected: FAIL (`listCompaniesWithProjectCount` no existe).

- [ ] **Step 3: Write minimal implementation**

En `db/companies.ts`: cambiar el import de drizzle a `import { desc, eq, isNull, isNotNull, sql } from "drizzle-orm";`, agregar `import { companies, projects } from "./schema";` (o sumar `projects` al import existente de `./schema`), y agregar:
```ts
export type CompanyListRow = Company & { projectCount: number };

export async function listCompaniesWithProjectCount(
  db: AnyDb,
  opts: { archived?: boolean } = {}
): Promise<CompanyListRow[]> {
  const rows = await db
    .select({
      company: companies,
      projectCount: sql<number>`count(distinct ${projects.id})`.mapWith(Number),
    })
    .from(companies)
    .leftJoin(projects, eq(projects.companyId, companies.id))
    .where(opts.archived ? isNotNull(companies.archivedAt) : isNull(companies.archivedAt))
    .groupBy(companies.id)
    .orderBy(desc(companies.createdAt));
  return rows.map((r) => ({ ...r.company, projectCount: r.projectCount }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- companies-count`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/companies.ts test/companies-count.test.ts
git commit -m "feat: listCompaniesWithProjectCount (conteo de proyectos por empresa)"
```

---

### Task 4: `listAllProjectsWithCounts`

**Files:**
- Modify: `db/projects.ts`
- Test: `test/projects-count.test.ts`

**Interfaces:**
- Consumes: `sql` de `drizzle-orm` (agregar al import `and, desc, eq, isNull, isNotNull`); `activities, tasks` de `./schema` (agregar a `projects, companies`); `ProjectListRow` (ya definido en este archivo).
- Produces:
  - `export type ProjectCountRow = ProjectListRow & { activityCount: number; taskCount: number }`
  - `export async function listAllProjectsWithCounts(db: AnyDb, opts?: { archived?: boolean }): Promise<ProjectCountRow[]>`

- [ ] **Step 1: Write the failing test**

```ts
// test/projects-count.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "./db";
import { createCompany } from "@/db/companies";
import { createProject, listAllProjectsWithCounts } from "@/db/projects";
import { createActivity } from "@/db/activities";
import { createTask } from "@/db/tasks";
import type { AnyDb } from "@/db/types";

async function mkProject(db: AnyDb, companyId: string, name: string) {
  return createProject(db, {
    companyId, name, ownerUserId: null, stage: "lead_sin_contactar", stageGroup: "lead",
    status: "open", solutionType: "unknown", estimatedValue: null, notes: null,
  });
}

describe("listAllProjectsWithCounts", () => {
  it("cuenta activities y tasks por proyecto sin inflar por el doble join; 0 si no tiene", async () => {
    const db = await createTestDb();
    const c = await createCompany(db, { name: "C" });
    const p = await mkProject(db, c.id, "P");
    const q = await mkProject(db, c.id, "Q");
    for (const i of [1, 2]) {
      await createActivity(db, { companyId: c.id, projectId: p.id, userId: null, type: "note", direction: null, subject: null, body: `n${i}`, source: "user", metadata: null });
    }
    for (const i of [1, 2, 3]) {
      await createTask(db, { projectId: p.id, companyId: c.id, ownerUserId: null, title: `t${i}`, dueDate: "2026-09-01" });
    }

    const rows = await listAllProjectsWithCounts(db, { archived: false });
    const rp = rows.find((r) => r.id === p.id)!;
    const rq = rows.find((r) => r.id === q.id)!;
    expect(rp.activityCount).toBe(2); // no 6 (2 activities × 3 tasks) → count(distinct) correcto
    expect(rp.taskCount).toBe(3);
    expect(rp.companyName).toBe("C");
    expect(rq.activityCount).toBe(0);
    expect(rq.taskCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- projects-count`
Expected: FAIL (`listAllProjectsWithCounts` no existe).

- [ ] **Step 3: Write minimal implementation**

En `db/projects.ts`: cambiar el import de drizzle a `import { and, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";` y el de schema a `import { projects, companies, activities, tasks } from "./schema";`, y agregar:
```ts
export type ProjectCountRow = ProjectListRow & { activityCount: number; taskCount: number };

export async function listAllProjectsWithCounts(
  db: AnyDb,
  opts: { archived?: boolean } = {}
): Promise<ProjectCountRow[]> {
  const rows = await db
    .select({
      project: projects,
      companyName: companies.name,
      activityCount: sql<number>`count(distinct ${activities.id})`.mapWith(Number),
      taskCount: sql<number>`count(distinct ${tasks.id})`.mapWith(Number),
    })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .leftJoin(activities, eq(activities.projectId, projects.id))
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .where(opts.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt))
    .groupBy(projects.id, companies.name)
    .orderBy(desc(projects.createdAt));
  return rows.map((r) => ({
    ...r.project,
    companyName: r.companyName,
    activityCount: r.activityCount,
    taskCount: r.taskCount,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- projects-count`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/projects.ts test/projects-count.test.ts
git commit -m "feat: listAllProjectsWithCounts (conteo de activities/tasks por proyecto)"
```

---

### Task 5: Server actions de borrado

**Files:**
- Modify: `app/companies/[id]/actions.ts` (`deleteCompanyAction`)
- Modify: `app/projects/actions.ts` (`deleteProjectAction`)

**Interfaces:**
- Consumes: `runDeleteCompany` (Task 1), `runDeleteProject` (Task 2), `db`, `revalidatePath`, `idSchema` (ya en ambos archivos).
- Produces: `export async function deleteCompanyAction(formData: FormData): Promise<void>`; `export async function deleteProjectAction(formData: FormData): Promise<void>`.

> Sin unit test (actions delgadas que delegan en run* ya testeadas; consistente con el repo). Gate: build + lint.

- [ ] **Step 1: `deleteCompanyAction` en `app/companies/[id]/actions.ts`**

Agregar `runDeleteCompany` al import de `@/lib/company-mutations` (que ya importa `runUpdateCompany, type ActionResult`):
```ts
import { runUpdateCompany, runDeleteCompany, type ActionResult } from "@/lib/company-mutations";
```
y agregar la action:
```ts
export async function deleteCompanyAction(formData: FormData): Promise<void> {
  const parsedId = idSchema.safeParse(formData.get("id"));
  if (parsedId.success) {
    await runDeleteCompany(db, parsedId.data);
    revalidatePath("/companies");
    revalidatePath("/dashboard");
    revalidatePath("/pipeline");
  }
}
```

- [ ] **Step 2: `deleteProjectAction` en `app/projects/actions.ts`**

Agregar `runDeleteProject` al import de `@/lib/project-mutations`:
```ts
import { runCreateProject, runUpdateProject, runMoveProjectStage, runDeleteProject } from "@/lib/project-mutations";
```
y agregar la action:
```ts
export async function deleteProjectAction(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  if (id.success) {
    await runDeleteProject(db, id.data);
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath("/pipeline");
  }
}
```

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: build OK, lint limpio.

- [ ] **Step 4: Commit**

```bash
git add "app/companies/[id]/actions.ts" app/projects/actions.ts
git commit -m "feat: server actions deleteCompanyAction / deleteProjectAction"
```

---

### Task 6: shadcn AlertDialog + `DeleteEntityDialog`

**Files:**
- Create (vía CLI): `components/ui/alert-dialog.tsx`
- Modify: `package.json` / `package-lock.json` (CLI, `@radix-ui/react-alert-dialog`)
- Create: `components/delete-entity-dialog.tsx`

**Interfaces:**
- Consumes: primitivas de `@/components/ui/alert-dialog`.
- Produces: `export function DeleteEntityDialog(props: { id: string; action: (formData: FormData) => Promise<void>; title: string; description: string }): JSX.Element` (client).

> Sin unit test (client presentacional). Gate: build + lint.

- [ ] **Step 1: Agregar el componente shadcn (instala Radix)**

Run: `npx shadcn@latest add alert-dialog`
Notas: genera `components/ui/alert-dialog.tsx` e instala `@radix-ui/react-alert-dialog`. Si pregunta por overwrite de un archivo EXISTENTE, declinar. Si el CLI falla por red, reportar BLOCKED con el error exacto (no escribir el archivo a mano).

- [ ] **Step 2: Verificar**

Run: `test -f components/ui/alert-dialog.tsx && grep -q '"@radix-ui/react-alert-dialog"' package.json && echo OK`
Expected: `OK`.

- [ ] **Step 3: Crear `components/delete-entity-dialog.tsx`**

```tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DeleteEntityDialog({
  id,
  action,
  title,
  description,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
  title: string;
  description: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger className="text-sm text-danger">Eliminar</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <AlertDialogAction type="submit">Eliminar</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

> Nota de API: si los tipos generados por shadcn difieren (p.ej. `AlertDialogTrigger` sin `className`, o `AlertDialogAction` sin `type`), adaptar mínimamente para que typechee, preservando: trigger "Eliminar" que abre el dialog; "Cancelar" que cierra; y el submit dentro del `<form action={action}>` con el `<input name="id">`. No editar `components/ui/alert-dialog.tsx`.

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run lint`
Expected: build OK, lint limpio.

- [ ] **Step 5: Commit**

```bash
git add components/ui/alert-dialog.tsx components/delete-entity-dialog.tsx package.json package-lock.json
git commit -m "feat: shadcn AlertDialog + DeleteEntityDialog reutilizable"
```

---

### Task 7: Cablear tablas y páginas

**Files:**
- Modify: `components/company-table.tsx`
- Modify: `components/project-table.tsx`
- Modify: `app/companies/page.tsx`
- Modify: `app/projects/page.tsx`

**Interfaces:**
- Consumes: `CompanyListRow` (Task 3), `ProjectCountRow` (Task 4), `listCompaniesWithProjectCount` (Task 3), `listAllProjectsWithCounts` (Task 4), `deleteCompanyAction`/`restoreCompanyAction` (Tasks 5 + existente), `deleteProjectAction` (Task 5), `DeleteEntityDialog` (Task 6).

> Sin unit test (client/SSR presentacional). Gate: build + lint + suite completa.

- [ ] **Step 1: `components/company-table.tsx` — tipo `CompanyListRow` + columna de acciones**

Reemplazar el archivo por:
```tsx
"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { CompanyListRow } from "@/db/companies";
import { restoreCompanyAction, deleteCompanyAction } from "@/app/companies/[id]/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

const columnHelper = createColumnHelper<CompanyListRow>();

function companyDeleteDescription(c: CompanyListRow): string {
  const proyectos = c.projectCount === 1 ? "1 proyecto" : `${c.projectCount} proyectos`;
  return `Se eliminará permanentemente «${c.name}» y sus ${proyectos}, con sus contactos, actividades y tareas. Esta acción no se puede deshacer.`;
}

function buildColumns(archived: boolean) {
  const base = [
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => (
        <Link href={`/companies/${info.row.original.id}`} className="font-medium underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("industry", {
      header: "Industria",
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("createdAt", {
      header: "Creada",
      cell: (info) => new Date(info.getValue()).toLocaleDateString("es-MX"),
    }),
  ];

  const actions = columnHelper.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const c = info.row.original;
      return (
        <div className="flex items-center gap-3">
          {archived ? (
            <form action={restoreCompanyAction}>
              <input type="hidden" name="id" value={c.id} />
              <button className="text-sm underline">Restaurar</button>
            </form>
          ) : (
            <Link href={`/companies/${c.id}`} className="text-sm underline">
              Editar
            </Link>
          )}
          <DeleteEntityDialog
            id={c.id}
            action={deleteCompanyAction}
            title="Eliminar empresa"
            description={companyDeleteDescription(c)}
          />
        </div>
      );
    },
  });

  return [...base, actions];
}

export function CompanyTable({
  data,
  archived = false,
}: {
  data: CompanyListRow[];
  archived?: boolean;
}) {
  const table = useReactTable({
    data,
    columns: buildColumns(archived),
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted">
        {archived ? "No hay empresas archivadas." : "Aún no hay empresas."}
      </p>
    );
  }

  return (
    <table className="mt-8 w-full text-left text-sm">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id} className="border-b border-line">
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
          <tr key={row.id} className="border-b border-line">
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

- [ ] **Step 2: `components/project-table.tsx` — conteos opcionales + prop `showActions`**

Cambios sobre el archivo existente:
1. Al import de tipos, sumar el uso de conteos opcionales en el row type. Reemplazar la definición del `columnHelper` y el tipo de fila para incluir conteos opcionales:
```tsx
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";
import { deleteProjectAction } from "@/app/projects/actions";

type ProjectRow = Project & {
  companyName?: string;
  activityCount?: number;
  taskCount?: number;
};

const columnHelper = createColumnHelper<ProjectRow>();

function projectDeleteDescription(p: ProjectRow): string {
  const a = p.activityCount ?? 0;
  const t = p.taskCount ?? 0;
  const acts = a === 1 ? "1 actividad" : `${a} actividades`;
  const tks = t === 1 ? "1 tarea" : `${t} tareas`;
  return `Se eliminará permanentemente «${p.name}» y sus ${acts} y ${tks}. Esta acción no se puede deshacer.`;
}
```
2. En `buildColumns`, aceptar `(showCompany: boolean, archived: boolean, showActions: boolean)` y, al final, si `showActions`, agregar la columna de acciones:
```tsx
  if (showActions) {
    cols.push(
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const p = info.row.original;
          return (
            <div className="flex items-center gap-3">
              {!archived && (
                <Link href={`/projects/${p.id}`} className="text-sm underline">
                  Editar
                </Link>
              )}
              <DeleteEntityDialog
                id={p.id}
                action={deleteProjectAction}
                title="Eliminar proyecto"
                description={projectDeleteDescription(p)}
              />
            </div>
          );
        },
      })
    );
  }
  return cols;
```
3. Actualizar la firma/props del componente y la llamada a `buildColumns`:
```tsx
export function ProjectTable({
  data,
  archived = false,
  showCompany = false,
  showActions = false,
}: {
  data: ProjectRow[];
  archived?: boolean;
  showCompany?: boolean;
  showActions?: boolean;
}) {
  const table = useReactTable({
    data,
    columns: buildColumns(showCompany, archived, showActions),
    getCoreRowModel: getCoreRowModel(),
  });
  // ...resto igual (el empty-state y la tabla no cambian)
}
```
Mantener el resto del archivo (accessors name/company/stage/status/solution/valor, empty-state, render) sin cambios. El `type Project` ya viene importado; el `ColumnDef<Project & { companyName?: string }, any>` interno pasa a `ColumnDef<ProjectRow, any>`.

- [ ] **Step 3: `app/companies/page.tsx` — usar el listado con conteo**

Cambiar el import y la llamada:
```tsx
import { listCompaniesWithProjectCount } from "@/db/companies";
```
```tsx
  const companies = await listCompaniesWithProjectCount(db, { archived: showArchived });
```
(el resto de la página no cambia; `CompanyTable` ahora recibe `CompanyListRow[]`).

- [ ] **Step 4: `app/projects/page.tsx` — usar el listado con conteos + activar acciones**

Cambiar el import y la llamada, y pasar `showActions`:
```tsx
import { listAllProjectsWithCounts } from "@/db/projects";
```
```tsx
  const projects = await listAllProjectsWithCounts(db, { archived: showArchived });
```
```tsx
      <ProjectTable data={projects} archived={showArchived} showCompany showActions />
```

- [ ] **Step 5: Build + lint + suite completa (gate final del slice)**

Run: `npm run build && npm run lint && npm test -- --no-file-parallelism`
Expected: build OK, lint limpio, TODA la suite verde (incluye los nuevos tests de delete/count).

- [ ] **Step 6: Commit**

```bash
git add components/company-table.tsx components/project-table.tsx app/companies/page.tsx app/projects/page.tsx
git commit -m "feat: botones Editar/Eliminar por fila en /companies y /projects (AlertDialog + conteo)"
```

---

## Cierre del slice (tras el review de rama)

- Actualizar `.superpowers/sdd/progress.md`.
- `git checkout main && git merge --no-ff feat/delete-company-project && git push`.
- Sin migración. Confirmar en Vercel que el build instala `@radix-ui/react-alert-dialog`.
- Smoke manual recomendado en el review final: en `/companies` y `/projects`, que Editar navegue al detalle y que Eliminar abra el AlertDialog con el conteo correcto y borre en cascada al confirmar.

## Self-Review (hecho)

- **Cobertura del spec:** runDeleteCompany cascada (Task 1), runDeleteProject cascada (Task 2), conteos para el dialog (Tasks 3-4), server actions (Task 5), AlertDialog + DeleteEntityDialog (Task 6), Editar/Eliminar en ambas tablas + páginas con conteo (Task 7), archivar intacto (no se toca), tokens/copy español (Tasks 6-7). ✔ sin gaps. Rollback: el spec ya aclara que no se testea con seam artificial (atomicidad por transacción).
- **Placeholders:** ninguno de lógica. La nota de adaptación de API de shadcn AlertDialog es por dependencia versionada, no un placeholder.
- **Consistencia de tipos:** `CompanyListRow` (Task 3) usado en CompanyTable + página (Task 7); `ProjectCountRow` (Task 4) fluye a `/projects` (Task 7) y satisface el `ProjectRow` con conteos opcionales de ProjectTable; `runDeleteCompany`/`runDeleteProject` (Tasks 1-2) consumidos por las actions (Task 5) usados por `DeleteEntityDialog` (Task 6) en las tablas (Task 7); firmas de actions `(FormData)=>Promise<void>` consistentes con el prop `action` del dialog.
