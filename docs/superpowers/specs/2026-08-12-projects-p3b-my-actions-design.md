# Projects P3b — My Actions (espinazo): Design

**Fecha:** 2026-08-12
**Slice:** Projects P3b (segundo sub-slice de P3 — vista diaria cross-project)
**PRD ancla:** §11.6 (My Actions), §9.3 (seguimiento comercial diario), §11.2 (navegación), §15.2 (zona horaria)

## Contexto

P3a dejó Tasks project-scoped + Next Action derivada en `/projects/[id]`. P3b agrega la
vista **My Actions** (§11.6): el tablero diario cross-project. §11.6 completo incluye
"projects sin interacción reciente" (necesita `last_interaction_at`, aún inexistente) y
botones rápidos (email/llamada son tipos de Activity manuales que faltan; nota/tarea son
project-scoped). Se descompone; **este spec cubre el espinazo**: los 4 elementos
accionables de solo-lectura, más navegación mínima.

### Decisiones de alcance (brainstorming)

- **Slice:** `/my-actions` con tareas **vencidas** + **de hoy** + **próximas** (abiertas,
  cross-project, linkeando a su proyecto) y la lista de projects `open` **sin next action**.
  Read-only.
- **Próximas = próximos 7 días** (due_date entre mañana y +7). Las más lejanas no aparecen
  acá (siguen visibles en su proyecto).
- **Nav mínima + landing:** barra de navegación mínima (My Actions · Proyectos · Empresas)
  en el layout; `/` redirige a `/my-actions` (arranque diario, §9.3).
- **Archivados fuera:** tasks de projects archivados NO aparecen en My Actions.
- **Diferido:** projects sin interacción reciente, botones rápidos, resto de secciones de
  §11.2 (Pipeline/Reports/Settings/Contacts), filtros.

## 1. Datos (cross-project)

### 1.1 `db/tasks.ts` — `listOpenTasksWithContext`

```ts
export type OpenTaskRow = Task & { projectName: string; companyName: string };

// Todas las tasks abiertas (completed_at IS NULL) cuyo project NO está archivado,
// con nombre de project y company, ordenadas por due_date asc.
listOpenTasksWithContext(db: AnyDb): Promise<OpenTaskRow[]>
```

Implementación: `select({ task: tasks, projectName: projects.name, companyName: companies.name })`
join `projects` (por `tasks.projectId`) join `companies` (por `tasks.companyId`), where
`isNull(tasks.completedAt)` AND `isNull(projects.archivedAt)`, order `asc(tasks.dueDate)`;
`.map` a `{ ...r.task, projectName, companyName }`.

### 1.2 Reutilización para "sin next action"

No hay query nueva: `listAllProjects(db, { archived: false })` (existente, devuelve
`ProjectListRow = Project & { companyName }`) + derivación pura (§2.4).

## 2. Lógica pura — `lib/my-actions.ts`

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

// Bucketea tasks (con due_date string) contra `today`. upcoming = ventana (mañana..+days].
// Las de due_date más allá de la ventana NO entran en ningún bucket.
export function bucketTasksByDueDate<T extends { dueDate: string }>(
  tasks: T[],
  today: string,
  upcomingDays = 7
): DueBuckets<T> {
  const upper = addDays(today, upcomingDays);
  const overdue: T[] = [], dueToday: T[] = [], upcoming: T[] = [];
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

> Nota: `bucketTasksByDueDate` recibe solo tasks abiertas (la query ya filtra
> `completed_at IS NULL`), pero es agnóstico: opera por `due_date`.

## 3. UI — `app/my-actions/page.tsx` (server component, `dynamic = "force-dynamic"`)

```ts
const openTasks = await listOpenTasksWithContext(db);
const activeProjects = await listAllProjects(db, { archived: false });
const today = todayInMexicoCity();
const { overdue, dueToday, upcoming } = bucketTasksByDueDate(openTasks, today, 7);
const missing = projectsMissingNextAction(activeProjects, openTasks);
```

Secciones (cada una con empty state):
- **⚠ Vencidas** (`overdue`) — estilo de alerta (ámbar/rojo).
- **Hoy** (`dueToday`).
- **Próximas (7 días)** (`upcoming`).
- Cada task-row: `title` + `formatDueDate(dueDate)` (de `lib/tasks`) + `companyName · projectName`,
  toda la fila linkea a `/projects/${projectId}`.
- **Sin próxima acción** (`missing`) — cada project: `name` + `companyName`, link a
  `/projects/${id}`.

Título de página "My Actions" con el sistema de diseño (Barlow Condensed display).

## 4. Navegación mínima + landing

- **`components/nav.tsx`** (client, `"use client"`): barra con links **My Actions**
  (`/my-actions`), **Proyectos** (`/projects`), **Empresas** (`/companies`). Usa
  `usePathname()`; si el pathname es `/login`, retorna `null` (no se muestra en el login).
  Marca el link activo (comparando el pathname).
- **`app/layout.tsx`**: monta `<Nav />` dentro de `<body>`, antes de `{children}`.
- **`app/page.tsx`**: cambia el redirect de `/companies` a `/my-actions`.

## 5. Tests (Vitest + PGlite, TDD — test primero)

**Puros (`lib/my-actions`):**
- `todayInMexicoCity(now)`: con `now = 2026-09-01T04:00:00Z` (22:00 del 31/08 en Mexico_City,
  UTC-6) → `"2026-08-31"`; con `now = 2026-09-01T12:00:00Z` → `"2026-09-01"`.
- `addDays`: `"2026-09-01" + 7 = "2026-09-08"`; rollover de mes `"2026-08-28" + 7 = "2026-09-04"`.
- `bucketTasksByDueDate` (today `"2026-09-08"`, 7 días): `"2026-09-01"`→overdue,
  `"2026-09-08"`→dueToday, `"2026-09-10"`→upcoming, `"2026-09-15"` (día 7)→upcoming,
  `"2026-09-16"` (fuera de ventana)→ninguno.
- `projectsMissingNextAction`: un project open sin task abierta entra; con task abierta no
  entra; un project no-open no entra aunque no tenga tasks.

**Datos (`db/tasks`):**
- `listOpenTasksWithContext`: devuelve solo abiertas, con `projectName`/`companyName`
  correctos, orden `due_date asc`; excluye completadas; excluye tasks cuyo project está
  archivado.

**UI/nav:** `npm run build` + `npm run lint` (el proyecto no tiene tests de componentes).

## 6. Postura de seguridad (sin cambios)

Las queries cross-project traen TODOS los projects/tasks (sin filtro de ownership) —
consistente con la postura actual (RLS deny-all, Drizzle como `postgres`). Se cierra con el
slice de RLS.

## Fuera de alcance (después)

- Projects **sin interacción reciente** (§11.6) — requiere `last_interaction_at` (derivado
  de Activities); su propio slice.
- **Botones rápidos** para registrar email/llamada (tipos de Activity manuales inexistentes)
  y nota/tarea global (selector de proyecto).
- Resto de la navegación de §11.2: **Pipeline** (P4), **Reports**, **Settings**, **Contacts**.
- Filtros/ordenamiento en My Actions; paginación.
