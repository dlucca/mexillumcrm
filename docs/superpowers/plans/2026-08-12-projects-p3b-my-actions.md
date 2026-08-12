# Projects P3b — My Actions (espinazo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vista diaria `/my-actions` (cross-project, read-only) con tareas vencidas / de hoy / próximas (7 días) y projects abiertos sin next action, cada item linkeando a su proyecto; más una navegación mínima con My Actions como landing.

**Architecture:** Una query nueva cross-project (`listOpenTasksWithContext`), lógica pura de fechas/buckets (`lib/my-actions.ts`), una página server component que compone ambas, un componente de navegación client (oculto en `/login`) montado en el layout, y el redirect de `/` a `/my-actions`. Sin tabla, sin migración.

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle ORM (Postgres/Supabase, PGlite en tests), Vitest, Tailwind v4.

## Global Constraints

- **TDD siempre**: test primero, verlo fallar, implementar mínimo, verlo pasar, commit.
- **Fechas como strings `YYYY-MM-DD`** (due_date es columna `date`): se comparan como strings (ordenan cronológicamente). "Hoy" en `America/Mexico_City` (§15.2).
- **Helpers puros con `now` inyectable** para tests deterministas.
- **Sin migración, sin schema change, sin tabla nueva.**
- **UI copy en español.** Título display con `font-display ... tracking-display` (sistema de diseño).
- **Nav oculto en `/login`** (client component con `usePathname`). `/` redirige a `/my-actions`.
- **Archivados fuera**: `listOpenTasksWithContext` excluye tasks de projects archivados.
- **Postura de seguridad (sin cambios)**: queries cross-project sin filtro de ownership (RLS deny-all, Drizzle como `postgres`). Se cierra con el slice de RLS.
- **Tests**: focalizados `npm test -- <patrón>` (fiables). Suite completa flaky por PGlite file-parallelism → `npm test -- --no-file-parallelism`.

---

### Task 1: `listOpenTasksWithContext` (`db/tasks.ts`)

**Files:**
- Modify: `db/tasks.ts` (añadir tipo + función; ampliar imports)
- Test: `test/tasks.test.ts` (añadir describe)

**Interfaces:**
- Consumes: `tasks`, `projects`, `companies`, `Task` de `./schema`; `AnyDb`.
- Produces:
  - `type OpenTaskRow = Task & { projectName: string; companyName: string }`
  - `listOpenTasksWithContext(db: AnyDb): Promise<OpenTaskRow[]>` (abiertas, project no archivado, orden `due_date asc`)

- [ ] **Step 1: Write the failing test**

Añadir a `test/tasks.test.ts` (un nuevo `describe` al final). El archivo ya importa `createTestDb`, `createCompany`, `tasks`, `projects`, `eq`, `createTask`.

```ts
import { listOpenTasksWithContext } from "@/db/tasks";
import { archiveProject } from "@/db/projects";

describe("listOpenTasksWithContext", () => {
  it("trae solo abiertas de projects no archivados, con nombres y orden due_date asc", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [pA] = await db.insert(projects).values({ companyId: company.id, name: "Planta A" }).returning();
    const [pArch] = await db.insert(projects).values({ companyId: company.id, name: "Planta Vieja" }).returning();

    await createTask(db, { projectId: pA.id, companyId: company.id, ownerUserId: null, title: "tarde", dueDate: "2026-12-01" });
    await createTask(db, { projectId: pA.id, companyId: company.id, ownerUserId: null, title: "pronto", dueDate: "2026-09-01" });
    // completada: no debe aparecer
    const done = await createTask(db, { projectId: pA.id, companyId: company.id, ownerUserId: null, title: "hecha", dueDate: "2026-09-05" });
    await db.update(tasks).set({ completedAt: new Date() }).where(eq(tasks.id, done.id));
    // task de un project archivado: no debe aparecer
    await createTask(db, { projectId: pArch.id, companyId: company.id, ownerUserId: null, title: "de archivado", dueDate: "2026-08-01" });
    await archiveProject(db, pArch.id);

    const rows = await listOpenTasksWithContext(db);
    expect(rows.map((r) => r.title)).toEqual(["pronto", "tarde"]);
    expect(rows[0].projectName).toBe("Planta A");
    expect(rows[0].companyName).toBe("Acme");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tasks`
Expected: FAIL (no export `listOpenTasksWithContext`).

- [ ] **Step 3: Implement en `db/tasks.ts`**

Cambiar la línea de imports de arriba:

```ts
import { and, asc, eq, isNull } from "drizzle-orm";
import { tasks, projects, companies } from "./schema";
import type { Task } from "./schema";
import type { AnyDb } from "@/db/types";
```

Añadir al final del archivo:

```ts
export type OpenTaskRow = Task & { projectName: string; companyName: string };

export async function listOpenTasksWithContext(db: AnyDb): Promise<OpenTaskRow[]> {
  const rows = await db
    .select({ task: tasks, projectName: projects.name, companyName: companies.name })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(companies, eq(tasks.companyId, companies.id))
    .where(and(isNull(tasks.completedAt), isNull(projects.archivedAt)))
    .orderBy(asc(tasks.dueDate));
  return rows.map((r) => ({ ...r.task, projectName: r.projectName, companyName: r.companyName }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tasks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/tasks.ts test/tasks.test.ts
git commit -m "feat: listOpenTasksWithContext (tasks abiertas cross-project con nombres)"
```

---

### Task 2: Lógica pura de My Actions (`lib/my-actions.ts`)

**Files:**
- Create: `lib/my-actions.ts`
- Test: `test/my-actions.test.ts`

**Interfaces:**
- Produces:
  - `todayInMexicoCity(now?: Date): string`
  - `addDays(dateStr: string, n: number): string`
  - `type DueBuckets<T> = { overdue: T[]; dueToday: T[]; upcoming: T[] }`
  - `bucketTasksByDueDate<T extends { dueDate: string }>(tasks: T[], today: string, upcomingDays?: number): DueBuckets<T>`
  - `projectsMissingNextAction<P extends { id: string; status: string }>(openProjects: P[], openTasks: { projectId: string }[]): P[]`

- [ ] **Step 1: Write the failing test**

Create `test/my-actions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  todayInMexicoCity,
  addDays,
  bucketTasksByDueDate,
  projectsMissingNextAction,
} from "@/lib/my-actions";

describe("todayInMexicoCity", () => {
  it("usa la fecha local de America/Mexico_City", () => {
    // 04:00 UTC = 22:00 del día anterior en Mexico_City (UTC-6)
    expect(todayInMexicoCity(new Date("2026-09-01T04:00:00Z"))).toBe("2026-08-31");
    expect(todayInMexicoCity(new Date("2026-09-01T12:00:00Z"))).toBe("2026-09-01");
  });
});

describe("addDays", () => {
  it("suma días sin corrimiento de zona", () => {
    expect(addDays("2026-09-01", 7)).toBe("2026-09-08");
    expect(addDays("2026-08-28", 7)).toBe("2026-09-04"); // rollover de mes
  });
});

describe("bucketTasksByDueDate", () => {
  it("clasifica overdue/hoy/upcoming y excluye fuera de ventana", () => {
    const mk = (dueDate: string) => ({ dueDate });
    const r = bucketTasksByDueDate(
      [mk("2026-09-01"), mk("2026-09-08"), mk("2026-09-10"), mk("2026-09-15"), mk("2026-09-16")],
      "2026-09-08",
      7
    );
    expect(r.overdue.map((t) => t.dueDate)).toEqual(["2026-09-01"]);
    expect(r.dueToday.map((t) => t.dueDate)).toEqual(["2026-09-08"]);
    expect(r.upcoming.map((t) => t.dueDate)).toEqual(["2026-09-10", "2026-09-15"]); // día 7 incluido, 16 excluido
  });
});

describe("projectsMissingNextAction", () => {
  it("devuelve projects open sin task abierta", () => {
    const projects = [
      { id: "p1", status: "open" },
      { id: "p2", status: "open" },
      { id: "p3", status: "won" },
    ];
    const openTasks = [{ projectId: "p1" }];
    const missing = projectsMissingNextAction(projects, openTasks);
    expect(missing.map((p) => p.id)).toEqual(["p2"]); // p1 tiene task, p3 no es open
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- my-actions`
Expected: FAIL (módulo `@/lib/my-actions` no existe).

- [ ] **Step 3: Implement `lib/my-actions.ts`**

```ts
// "Hoy" como YYYY-MM-DD en America/Mexico_City (§15.2). now inyectable para tests.
export function todayInMexicoCity(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(now);
}

// Aritmética de fechas en UTC (evita corrimiento de zona). dateStr = YYYY-MM-DD.
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type DueBuckets<T> = { overdue: T[]; dueToday: T[]; upcoming: T[] };

// Bucketea por due_date contra `today`. upcoming = (today .. today+upcomingDays].
// Las de due_date fuera de la ventana no entran en ningún bucket.
export function bucketTasksByDueDate<T extends { dueDate: string }>(
  tasks: T[],
  today: string,
  upcomingDays = 7
): DueBuckets<T> {
  const upper = addDays(today, upcomingDays);
  const overdue: T[] = [];
  const dueToday: T[] = [];
  const upcoming: T[] = [];
  for (const t of tasks) {
    if (t.dueDate < today) overdue.push(t);
    else if (t.dueDate === today) dueToday.push(t);
    else if (t.dueDate <= upper) upcoming.push(t);
  }
  return { overdue, dueToday, upcoming };
}

// Projects `open` (no archivados) sin ninguna task abierta.
export function projectsMissingNextAction<P extends { id: string; status: string }>(
  openProjects: P[],
  openTasks: { projectId: string }[]
): P[] {
  const withOpenTask = new Set(openTasks.map((t) => t.projectId));
  return openProjects.filter((p) => p.status === "open" && !withOpenTask.has(p.id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- my-actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/my-actions.ts test/my-actions.test.ts
git commit -m "feat: lib/my-actions (today MX, addDays, bucketTasksByDueDate, projectsMissingNextAction)"
```

---

### Task 3: Página `/my-actions` (`app/my-actions/page.tsx`)

**Files:**
- Create: `app/my-actions/page.tsx`
- Test: (verificación por `npm run build` + `lint`; el proyecto no tiene tests de componentes)

**Interfaces:**
- Consumes: `listOpenTasksWithContext`, `OpenTaskRow` de `@/db/tasks`; `listAllProjects` de `@/db/projects`; `formatDueDate` de `@/lib/tasks`; `todayInMexicoCity`, `bucketTasksByDueDate`, `projectsMissingNextAction` de `@/lib/my-actions`; `db`.

- [ ] **Step 1: Create `app/my-actions/page.tsx`**

```tsx
import Link from "next/link";
import { db } from "@/db/client";
import { listOpenTasksWithContext, type OpenTaskRow } from "@/db/tasks";
import { listAllProjects } from "@/db/projects";
import { formatDueDate } from "@/lib/tasks";
import {
  todayInMexicoCity,
  bucketTasksByDueDate,
  projectsMissingNextAction,
} from "@/lib/my-actions";

export const dynamic = "force-dynamic";

function TaskRow({ t }: { t: OpenTaskRow }) {
  return (
    <li>
      <Link
        href={`/projects/${t.projectId}`}
        className="flex items-center justify-between gap-3 rounded-md border px-4 py-2 hover:bg-neutral-50"
      >
        <span className="text-sm">
          <span className="font-medium">{t.title}</span> · {t.companyName} — {t.projectName}
        </span>
        <span className="text-xs text-neutral-500">vence {formatDueDate(t.dueDate)}</span>
      </Link>
    </li>
  );
}

function TaskSection({
  title,
  tasks,
  empty,
  tone,
}: {
  title: string;
  tasks: OpenTaskRow[];
  empty: string;
  tone?: "alert";
}) {
  return (
    <section className="mt-8">
      <h2
        className={`font-display font-bold text-2xl tracking-display ${
          tone === "alert" ? "text-amber-700" : ""
        }`}
      >
        {title}
      </h2>
      {tasks.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {tasks.map((t) => (
            <TaskRow key={t.id} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function MyActionsPage() {
  const openTasks = await listOpenTasksWithContext(db);
  const activeProjects = await listAllProjects(db, { archived: false });
  const today = todayInMexicoCity();
  const { overdue, dueToday, upcoming } = bucketTasksByDueDate(openTasks, today, 7);
  const missing = projectsMissingNextAction(activeProjects, openTasks);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">My Actions</h1>

      <TaskSection title="⚠ Vencidas" tasks={overdue} empty="Nada vencido." tone="alert" />
      <TaskSection title="Hoy" tasks={dueToday} empty="Nada para hoy." />
      <TaskSection title="Próximas (7 días)" tasks={upcoming} empty="Nada próximo." />

      <section className="mt-8">
        <h2 className="font-display font-bold text-2xl tracking-display">Sin próxima acción</h2>
        {missing.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Todos los proyectos abiertos tienen próxima acción.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {missing.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border px-4 py-2 hover:bg-neutral-50"
                >
                  <span className="text-sm">
                    <span className="font-medium">{p.name}</span> · {p.companyName}
                  </span>
                  <span className="text-xs text-amber-700">sin próxima acción</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build && npm run lint`
Expected: build OK (ruta `/my-actions` dinámica), lint limpio.

- [ ] **Step 3: Commit**

```bash
git add app/my-actions/page.tsx
git commit -m "feat: página /my-actions (vencidas/hoy/próximas + sin próxima acción)"
```

---

### Task 4: Navegación mínima + landing

**Files:**
- Create: `components/nav.tsx`
- Modify: `app/layout.tsx` (montar `<Nav />`)
- Modify: `app/page.tsx` (redirect a `/my-actions`)
- Test: (verificación por `npm run build` + `lint`)

**Interfaces:**
- Produces: `Nav` (client component); layout monta la nav; `/` → `/my-actions`.

- [ ] **Step 1: Create `components/nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/my-actions", label: "My Actions" },
  { href: "/projects", label: "Proyectos" },
  { href: "/companies", label: "Empresas" },
];

export function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="border-b">
      <div className="mx-auto flex max-w-4xl items-center gap-4 px-8 py-3 text-sm">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={active ? "font-semibold" : "text-neutral-500 hover:text-neutral-900"}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Mount `<Nav />` in `app/layout.tsx`**

Añadir el import y renderizar `<Nav />` dentro de `<body>` antes de `{children}`:

```tsx
import { Nav } from "@/components/nav";
```

```tsx
      <body>
        <Nav />
        {children}
      </body>
```

- [ ] **Step 3: Change the landing in `app/page.tsx`**

Reemplazar el redirect:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/my-actions");
}
```

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run lint`
Expected: build OK, lint limpio.

- [ ] **Step 5: Manual verification (opcional)**

`npm run dev`: `/` redirige a `/my-actions`; la nav aparece en todas las páginas menos `/login`; el link activo se resalta; clic en un item de My Actions abre `/projects/[id]`.

- [ ] **Step 6: Commit**

```bash
git add components/nav.tsx app/layout.tsx app/page.tsx
git commit -m "feat: nav mínima (My Actions · Proyectos · Empresas) + landing en /my-actions"
```

---

### Task 5: Verificación final de rama

**Files:** ninguno (verificación).

- [ ] **Step 1: Suite completa + build + lint**

Run: `npm test -- --no-file-parallelism && npm run build && npm run lint`
Expected: todo verde.

- [ ] **Step 2: Confirmar sin drift de schema**

Run: `npm run db:generate`
Expected: "No schema changes, nothing to migrate" (P3b no toca el schema; NO debe generar 0006).

---

## Self-Review

**Spec coverage (spec §→task):**
- §1.1 `listOpenTasksWithContext` → Task 1. ✓
- §1.2 reutilización de `listAllProjects` → Task 3 (uso). ✓
- §2 lógica pura (today MX, addDays, bucket, missingNextAction) → Task 2. ✓
- §3 página `/my-actions` → Task 3. ✓
- §4 nav + landing → Task 4. ✓
- §5 tests → puros (T2), datos (T1), UI/build (T3/T4). ✓
- §6 postura de seguridad (sin cambios) → ninguna task la toca; Task 5 confirma sin drift. ✓

**Placeholder scan:** sin TBD/TODO; todos los pasos con código o comando exacto. ✓

**Type consistency:** `OpenTaskRow` (T1) consumido por la página (T3) y compatible con `bucketTasksByDueDate<T extends {dueDate}>` (T2); `projectsMissingNextAction<P extends {id,status}>` (T2) recibe `ProjectListRow` (de `listAllProjects`, que tiene `id`/`status`/`companyName`) en T3; `todayInMexicoCity`/`addDays` (T2) usados por el bucket y testeados con `now` inyectado. ✓

**Nota de alcance:** las páginas existentes (companies/projects) conservan sus cross-links ad-hoc; la nav nueva se suma sin removerlos (evitar churn fuera de alcance). Sin migración: Task 5 lo confirma con `db:generate`.
