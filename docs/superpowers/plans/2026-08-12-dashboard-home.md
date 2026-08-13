# Dashboard (home unificado) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `/dashboard` como home unificado: KPIs + charts de pipeline (Recharts vía shadcn) con My Actions embebido, y mover el landing a `/dashboard`.

**Architecture:** Agregaciones puras en el server (`lib/dashboard.ts`) alimentan componentes de chart client mínimos (solo reciben arrays ya calculados). My Actions se extrae a un componente server reutilizable. El cambio de landing va en la última task, cuando `/dashboard` ya existe.

**Tech Stack:** Next.js 15 App Router (server components + `force-dynamic`), React 19, TypeScript, Tailwind v4 con tokens del design system, shadcn/ui + Recharts (charts), Vitest (tests puros).

## Global Constraints

- **Sin cambio de schema → sin migración.** `recharts` se agrega a `package.json` (Vercel lo instala en build; no hay paso de prod DB).
- **Tests en `test/`** (no `tests/`), `describe/it/expect`, alias `@/`, fixtures mínimas.
- **UI nueva/tocada usa tokens del design system** (`docs/color-spec.md`, `docs/typography-spec.md`), NO ad-hoc `neutral-*`/`amber-*`. Utilidades disponibles: `bg-surface`, `bg-surface-2`, `text-ink`, `text-muted`, `text-faint`, `border-line`, `border-line-strong`, `text-solar-ink`, `text-danger`, `bg-solar`, `text-on-solar`. Tipografía: `font-display tracking-display` (títulos), `font-mono` + `tabular-nums` (numerales). Copy en **español**.
- **Landing = `/dashboard`** tras este slice (post-login y `/` → `/dashboard`).
- **Suite flaky con paralelismo** → gate final `npm test -- --no-file-parallelism`; focalizados fiables.
- Tipos: `estimatedValue: number | null`, `expectedCloseDate: string | null` (YYYY-MM-DD), `OpenTaskRow = Task & { projectName; companyName }` (incluye `projectId`, `title`, `dueDate`). `ProjectListRow = Project & { companyName }`.
- Reusables existentes: `groupProjectsByStageGroup` (`lib/pipeline.ts`); `todayInMexicoCity`/`bucketTasksByDueDate`/`projectsMissingNextAction` (`lib/my-actions.ts`); `formatMXN`/`STAGES`/`stageGroupFor` (`lib/project-pipeline.ts`); `formatUSD` (`lib/currency.ts`); `formatDueDate` (`lib/tasks.ts`).

---

### Task 1: `lib/dashboard.ts` — agregaciones puras + colores de grupo

**Files:**
- Create: `lib/dashboard.ts`
- Test: `test/dashboard.test.ts`

**Interfaces:**
- Consumes: `STAGES`, `stageGroupFor` (`@/lib/project-pipeline`); `projectsMissingNextAction`, `bucketTasksByDueDate` (`@/lib/my-actions`).
- Produces:
  - `export type StageBucket = { stage: string; label: string; group: string; count: number; totalValue: number }`
  - `export function pipelineByStage<P extends { stage: string; estimatedValue: number | null }>(projects: P[]): StageBucket[]`
  - `export type DashboardTotals = { openCount: number; openValue: number; missingNextAction: number; overdueTasks: number }`
  - `export function dashboardTotals(projects: { id: string; status: string; estimatedValue: number | null }[], openTasks: { projectId: string; dueDate: string }[], today: string): DashboardTotals`
  - `export const GROUP_COLORS: Record<string, string>` (grupo → `var(--pipe-N)`)

- [ ] **Step 1: Write the failing test**

```ts
// test/dashboard.test.ts
import { describe, it, expect } from "vitest";
import { pipelineByStage, dashboardTotals, GROUP_COLORS } from "@/lib/dashboard";

describe("pipelineByStage", () => {
  it("13 etapas en orden, con grupo, conteo y suma; null→0; vacías presentes", () => {
    const rows = pipelineByStage([
      { stage: "lead_sin_contactar", estimatedValue: 100 },
      { stage: "lead_sin_contactar", estimatedValue: null },
      { stage: "propuesta_enviada", estimatedValue: 500 },
    ]);
    expect(rows).toHaveLength(13);
    expect(rows[0].stage).toBe("lead_sin_contactar");
    expect(rows[0].label).toBe("Lead / sin contactar");
    expect(rows[0].group).toBe("lead");
    expect(rows[0].count).toBe(2);
    expect(rows[0].totalValue).toBe(100); // null cuenta 0
    const prop = rows.find((r) => r.stage === "propuesta_enviada")!;
    expect(prop.group).toBe("commercial");
    expect(prop.count).toBe(1);
    expect(prop.totalValue).toBe(500);
    const empty = rows.find((r) => r.stage === "diagnostico_web")!;
    expect(empty.count).toBe(0);
    expect(empty.totalValue).toBe(0);
  });
});

describe("dashboardTotals", () => {
  const today = "2026-08-12";
  it("openCount/openValue solo status open; null→0", () => {
    const t = dashboardTotals(
      [
        { id: "a", status: "open", estimatedValue: 100 },
        { id: "b", status: "open", estimatedValue: null },
        { id: "c", status: "won", estimatedValue: 999 },
      ],
      [],
      today
    );
    expect(t.openCount).toBe(2);
    expect(t.openValue).toBe(100);
  });
  it("missingNextAction: projects open sin task abierta", () => {
    const t = dashboardTotals(
      [
        { id: "a", status: "open", estimatedValue: 0 },
        { id: "b", status: "open", estimatedValue: 0 },
      ],
      [{ projectId: "a", dueDate: "2026-09-01" }],
      today
    );
    expect(t.missingNextAction).toBe(1);
  });
  it("overdueTasks: due_date < today", () => {
    const t = dashboardTotals(
      [],
      [
        { projectId: "x", dueDate: "2026-08-01" },
        { projectId: "y", dueDate: "2026-08-12" },
        { projectId: "z", dueDate: "2026-08-20" },
      ],
      today
    );
    expect(t.overdueTasks).toBe(1);
  });
});

describe("GROUP_COLORS", () => {
  it("cubre los 6 grupos con var(--pipe-N)", () => {
    for (const g of ["lead", "qualification", "solution", "commercial", "delivery", "active"]) {
      expect(GROUP_COLORS[g]).toMatch(/^var\(--pipe-\d\)$/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dashboard`
Expected: FAIL (no existe `@/lib/dashboard`).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/dashboard.ts
import { STAGES, stageGroupFor } from "@/lib/project-pipeline";
import { projectsMissingNextAction, bucketTasksByDueDate } from "@/lib/my-actions";

export type StageBucket = {
  stage: string;
  label: string;
  group: string;
  count: number;
  totalValue: number;
};

export function pipelineByStage<P extends { stage: string; estimatedValue: number | null }>(
  projects: P[]
): StageBucket[] {
  return STAGES.map((s) => {
    const inStage = projects.filter((p) => p.stage === s.value);
    return {
      stage: s.value,
      label: s.label,
      group: stageGroupFor(s.value),
      count: inStage.length,
      totalValue: inStage.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0),
    };
  });
}

export type DashboardTotals = {
  openCount: number;
  openValue: number;
  missingNextAction: number;
  overdueTasks: number;
};

export function dashboardTotals(
  projects: { id: string; status: string; estimatedValue: number | null }[],
  openTasks: { projectId: string; dueDate: string }[],
  today: string
): DashboardTotals {
  const open = projects.filter((p) => p.status === "open");
  return {
    openCount: open.length,
    openValue: open.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0),
    missingNextAction: projectsMissingNextAction(projects, openTasks).length,
    overdueTasks: bucketTasksByDueDate(openTasks, today).overdue.length,
  };
}

// Rampa Sol→Almacenamiento por grupo. Los var(--pipe-N) se definen en app/globals.css (Task 3).
export const GROUP_COLORS: Record<string, string> = {
  lead: "var(--pipe-1)",
  qualification: "var(--pipe-2)",
  solution: "var(--pipe-3)",
  commercial: "var(--pipe-4)",
  delivery: "var(--pipe-5)",
  active: "var(--pipe-6)",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dashboard`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard.ts test/dashboard.test.ts
git commit -m "feat: agregaciones puras del dashboard (pipelineByStage, dashboardTotals) + GROUP_COLORS"
```

---

### Task 2: Extraer `MyActionsPanel` + refactor de `/my-actions`

**Files:**
- Create: `components/my-actions-panel.tsx`
- Modify: `app/my-actions/page.tsx` (usar el panel; alinear tokens)

**Interfaces:**
- Consumes: `OpenTaskRow` (`@/db/tasks`), `formatDueDate` (`@/lib/tasks`).
- Produces: `export function MyActionsPanel(props: { overdue: OpenTaskRow[]; dueToday: OpenTaskRow[]; upcoming: OpenTaskRow[]; missing: { id: string; name: string; companyName: string }[] }): JSX.Element` (server component).

> Sin unit test (presentacional; la lógica pura de `lib/my-actions` ya está testeada y no cambia). Es un refactor sin cambio de comportamiento: mismo contenido/links/copy, tokens alineados. Gate: build + lint + los tests de `my-actions` siguen verdes.

- [ ] **Step 1: Crear `components/my-actions-panel.tsx`**

```tsx
import Link from "next/link";
import type { OpenTaskRow } from "@/db/tasks";
import { formatDueDate } from "@/lib/tasks";

function TaskRow({ t }: { t: OpenTaskRow }) {
  return (
    <li>
      <Link
        href={`/projects/${t.projectId}`}
        className="flex items-center justify-between gap-3 rounded-md border border-line px-4 py-2 hover:bg-surface-2"
      >
        <span className="text-sm">
          <span className="font-medium">{t.title}</span> · {t.companyName} — {t.projectName}
        </span>
        <span className="text-xs text-muted">vence {formatDueDate(t.dueDate)}</span>
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
          tone === "alert" ? "text-solar-ink" : ""
        }`}
      >
        {title}
      </h2>
      {tasks.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
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

export function MyActionsPanel({
  overdue,
  dueToday,
  upcoming,
  missing,
}: {
  overdue: OpenTaskRow[];
  dueToday: OpenTaskRow[];
  upcoming: OpenTaskRow[];
  missing: { id: string; name: string; companyName: string }[];
}) {
  return (
    <div>
      <TaskSection title="⚠ Vencidas" tasks={overdue} empty="Nada vencido." tone="alert" />
      <TaskSection title="Hoy" tasks={dueToday} empty="Nada para hoy." />
      <TaskSection title="Próximas (7 días)" tasks={upcoming} empty="Nada próximo." />
      <section className="mt-8">
        <h2 className="font-display font-bold text-2xl tracking-display">Sin próxima acción</h2>
        {missing.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Todos los proyectos abiertos tienen próxima acción.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {missing.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-line px-4 py-2 hover:bg-surface-2"
                >
                  <span className="text-sm">
                    <span className="font-medium">{p.name}</span> · {p.companyName}
                  </span>
                  <span className="text-xs text-solar-ink">sin próxima acción</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Refactor `app/my-actions/page.tsx` para usar el panel**

```tsx
import { db } from "@/db/client";
import { listOpenTasksWithContext } from "@/db/tasks";
import { listAllProjects } from "@/db/projects";
import { todayInMexicoCity, bucketTasksByDueDate, projectsMissingNextAction } from "@/lib/my-actions";
import { MyActionsPanel } from "@/components/my-actions-panel";

export const dynamic = "force-dynamic";

export default async function MyActionsPage() {
  const openTasks = await listOpenTasksWithContext(db);
  const activeProjects = await listAllProjects(db, { archived: false });
  const today = todayInMexicoCity();
  const { overdue, dueToday, upcoming } = bucketTasksByDueDate(openTasks, today, 7);
  const missing = projectsMissingNextAction(activeProjects, openTasks);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">My Actions</h1>
      <MyActionsPanel overdue={overdue} dueToday={dueToday} upcoming={upcoming} missing={missing} />
    </main>
  );
}
```

- [ ] **Step 3: Build + lint + tests de my-actions**

Run: `npm run build && npm run lint && npm test -- my-actions`
Expected: build OK, lint limpio, tests de `my-actions` verdes.

- [ ] **Step 4: Commit**

```bash
git add components/my-actions-panel.tsx app/my-actions/page.tsx
git commit -m "refactor: extraer MyActionsPanel (server, tokens del design system) y usarlo en /my-actions"
```

---

### Task 3: shadcn chart+card + Recharts + rampa `--pipe-1..6`

**Files:**
- Create (vía CLI): `components/ui/chart.tsx`, `components/ui/card.tsx`
- Modify: `package.json` (recharts, vía CLI), `app/globals.css` (agregar `--pipe-1..6`)

**Interfaces:**
- Produces: componentes shadcn `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `type ChartConfig` (de `@/components/ui/chart`); vars CSS `--pipe-1..6`.

> Sin unit test. Gate: `npm run build` (typechea el `chart.tsx` generado y que recharts resuelve) + verificar que recharts quedó en `package.json`.

- [ ] **Step 1: Agregar componentes shadcn (instala recharts)**

Run: `npx shadcn@latest add chart card`
Notas: `lib/utils.ts` ya existe (no habrá prompt de overwrite). El CLI instala `recharts` y crea `components/ui/chart.tsx` y `components/ui/card.tsx`. Si el CLI pregunta por overwrite de algo existente, **declinar** (no pisar).

- [ ] **Step 2: Verificar instalación**

Run: `test -f components/ui/chart.tsx && test -f components/ui/card.tsx && grep -q '"recharts"' package.json && echo OK`
Expected: `OK`.

- [ ] **Step 3: Agregar la rampa `--pipe-1..6` en `app/globals.css`**

En el bloque `:root` que define los tokens de dominio (donde están `--solar`/`--storage`, ~línea 110-135), agregar (una sola vez; `var(--solar)`/`var(--storage)` ya theme-adaptan, así que cascada a light/dark):

```css
  /* Rampa de pipeline (6 grupos) Sol→Almacenamiento — usada por los charts del dashboard */
  --pipe-1: var(--solar);
  --pipe-2: color-mix(in oklch, var(--solar), var(--storage) 20%);
  --pipe-3: color-mix(in oklch, var(--solar), var(--storage) 40%);
  --pipe-4: color-mix(in oklch, var(--solar), var(--storage) 60%);
  --pipe-5: color-mix(in oklch, var(--solar), var(--storage) 80%);
  --pipe-6: var(--storage);
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build OK (chart.tsx y card.tsx typechean; recharts resuelve).

- [ ] **Step 5: Commit**

```bash
git add components/ui/chart.tsx components/ui/card.tsx package.json package-lock.json app/globals.css
git commit -m "chore: shadcn chart+card + recharts + rampa --pipe-1..6 (Sol→Almacenamiento)"
```

---

### Task 4: Componentes de chart (client mínimos)

**Files:**
- Create: `components/pipeline-group-chart.tsx`
- Create: `components/pipeline-stage-chart.tsx`

**Interfaces:**
- Consumes: `ChartContainer`/`ChartTooltip`/`ChartTooltipContent`/`ChartConfig` (`@/components/ui/chart`); `GROUP_COLORS`, `StageBucket` (`@/lib/dashboard`); `formatMXN` (`@/lib/project-pipeline`); `recharts`.
- Produces:
  - `export function PipelineGroupChart({ columns }: { columns: { group: string; label: string; count: number; totalValue: number }[] }): JSX.Element`
  - `export function PipelineStageChart({ stages }: { stages: StageBucket[] }): JSX.Element`

> Sin unit test (client presentacional; el cálculo ya está testeado en Task 1). Gate: `npm run build` + `npm run lint`. La navegación por click se verifica en el review final de rama (smoke en el navegador).
> **Nota de API:** el `formatter` de `ChartTooltipContent` puede tener tipos estrictos según la versión generada por shadcn. Si TypeScript se queja del `formatter`, adaptarlo mínimamente a los tipos generados manteniendo el objetivo (tooltip muestra `count · formatMXN(totalValue)`). No cambiar la lógica de datos.

- [ ] **Step 1: Crear `components/pipeline-group-chart.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { GROUP_COLORS } from "@/lib/dashboard";
import { formatMXN } from "@/lib/project-pipeline";

type Col = { group: string; label: string; count: number; totalValue: number };
const chartConfig = { totalValue: { label: "Valor" } } satisfies ChartConfig;

export function PipelineGroupChart({ columns }: { columns: Col[] }) {
  const router = useRouter();
  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart accessibilityLayer data={columns} layout="vertical" margin={{ left: 8, right: 16 }}>
        <YAxis
          type="category"
          dataKey="label"
          width={96}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(_v, _n, item) =>
                `${item.payload.count} · ${formatMXN(item.payload.totalValue)}`
              }
            />
          }
        />
        <Bar
          dataKey="totalValue"
          radius={4}
          cursor="pointer"
          onClick={(_, index) => router.push(`/pipeline?group=${columns[index].group}`)}
        >
          {columns.map((c) => (
            <Cell key={c.group} fill={GROUP_COLORS[c.group] ?? "var(--pipe-1)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
```

- [ ] **Step 2: Crear `components/pipeline-stage-chart.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { GROUP_COLORS, type StageBucket } from "@/lib/dashboard";
import { formatMXN } from "@/lib/project-pipeline";

const chartConfig = { totalValue: { label: "Valor" } } satisfies ChartConfig;

export function PipelineStageChart({ stages }: { stages: StageBucket[] }) {
  const router = useRouter();
  return (
    <ChartContainer config={chartConfig} className="h-[360px] w-full">
      <BarChart accessibilityLayer data={stages} layout="vertical" margin={{ left: 8, right: 16 }}>
        <YAxis
          type="category"
          dataKey="label"
          width={130}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(_v, _n, item) =>
                `${item.payload.count} · ${formatMXN(item.payload.totalValue)}`
              }
            />
          }
        />
        <Bar
          dataKey="totalValue"
          radius={4}
          cursor="pointer"
          onClick={(_, index) => router.push(`/pipeline?stage=${stages[index].stage}`)}
        >
          {stages.map((s) => (
            <Cell key={s.stage} fill={GROUP_COLORS[s.group] ?? "var(--pipe-1)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
```

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: build OK, lint limpio.

- [ ] **Step 4: Commit**

```bash
git add components/pipeline-group-chart.tsx components/pipeline-stage-chart.tsx
git commit -m "feat: charts de pipeline (grupo/etapa) con Recharts+shadcn, color por grupo, click→/pipeline"
```

---

### Task 5: Página `app/dashboard/page.tsx`

**Files:**
- Create: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `listAllProjects` (`@/db/projects`), `listOpenTasksWithContext` (`@/db/tasks`), `groupProjectsByStageGroup` (`@/lib/pipeline`), `pipelineByStage`/`dashboardTotals` (`@/lib/dashboard`), `todayInMexicoCity`/`bucketTasksByDueDate`/`projectsMissingNextAction` (`@/lib/my-actions`), `formatMXN` (`@/lib/project-pipeline`), `formatUSD` (`@/lib/currency`), `MyActionsPanel` (`@/components/my-actions-panel`), `PipelineGroupChart`/`PipelineStageChart` (Task 4).

> Sin unit test (server/presentacional; cálculo ya testeado). Gate: build + lint.

- [ ] **Step 1: Crear `app/dashboard/page.tsx`**

```tsx
import { db } from "@/db/client";
import { listAllProjects } from "@/db/projects";
import { listOpenTasksWithContext } from "@/db/tasks";
import { groupProjectsByStageGroup } from "@/lib/pipeline";
import { pipelineByStage, dashboardTotals } from "@/lib/dashboard";
import {
  todayInMexicoCity,
  bucketTasksByDueDate,
  projectsMissingNextAction,
} from "@/lib/my-actions";
import { formatMXN } from "@/lib/project-pipeline";
import { formatUSD } from "@/lib/currency";
import { MyActionsPanel } from "@/components/my-actions-panel";
import { PipelineGroupChart } from "@/components/pipeline-group-chart";
import { PipelineStageChart } from "@/components/pipeline-stage-chart";

export const dynamic = "force-dynamic";

function Kpi({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className={`font-mono text-3xl tabular-nums ${alert ? "text-danger" : "text-ink"}`}>
        {value}
      </span>
      {sub ? <span className="text-xs text-muted">{sub}</span> : null}
    </div>
  );
}

export default async function DashboardPage() {
  const projects = await listAllProjects(db, { archived: false });
  const openTasks = await listOpenTasksWithContext(db);
  const today = todayInMexicoCity();
  const totals = dashboardTotals(projects, openTasks, today);
  const groups = groupProjectsByStageGroup(projects);
  const stages = pipelineByStage(projects);
  const { overdue, dueToday, upcoming } = bucketTasksByDueDate(openTasks, today, 7);
  const missing = projectsMissingNextAction(projects, openTasks);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">Dashboard</h1>

      <div className="mt-6 flex flex-wrap gap-x-12 gap-y-4 border-b border-line pb-6">
        <Kpi
          label="Pipeline abierto"
          value={formatMXN(totals.openValue)}
          sub={`${totals.openCount} proyectos · ${formatUSD(totals.openValue)}`}
        />
        <Kpi
          label="Sin próxima acción"
          value={String(totals.missingNextAction)}
          alert={totals.missingNextAction > 0}
        />
        <Kpi
          label="Tareas vencidas"
          value={String(totals.overdueTasks)}
          alert={totals.overdueTasks > 0}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="font-display font-bold text-xl tracking-display">Pipeline por grupo</h2>
            <div className="mt-3">
              <PipelineGroupChart columns={groups} />
            </div>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl tracking-display">Pipeline por etapa</h2>
            <div className="mt-3">
              <PipelineStageChart stages={stages} />
            </div>
          </section>
        </div>
        <div>
          <h2 className="font-display font-bold text-xl tracking-display">My Actions</h2>
          <MyActionsPanel overdue={overdue} dueToday={dueToday} upcoming={upcoming} missing={missing} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build && npm run lint`
Expected: build OK (`/dashboard` compila como dynamic ƒ), lint limpio.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: página /dashboard (KPIs + charts de pipeline + My Actions embebido)"
```

---

### Task 6: Cambiar el landing a `/dashboard`

**Files:**
- Modify: `lib/supabase/auth-redirect.ts`
- Modify: `test/auth-redirect.test.ts`
- Modify: `app/page.tsx`
- Modify: `app/login/actions.ts`
- Modify: `components/nav.tsx`
- Modify: `app/my-actions/page.tsx` (→ redirect)

**Interfaces:**
- Consumes: `redirect` de `next/navigation`.

- [ ] **Step 1: Actualizar el test de auth-redirect (falla primero)**

En `test/auth-redirect.test.ts`, cambiar el caso authed-en-/login:

```ts
  it("sends an authenticated user away from /login to /dashboard", () => {
    expect(authRedirectTarget("/login", true)).toBe("/dashboard");
  });
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- auth-redirect`
Expected: FAIL (la impl aún retorna `/my-actions`).

- [ ] **Step 3: Actualizar la implementación**

En `lib/supabase/auth-redirect.ts`, en el comentario y el cuerpo:

```ts
 * - Authenticated users on /login → "/dashboard".
```
```ts
  if (isAuthed && onLogin) return "/dashboard";
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- auth-redirect`
Expected: PASS.

- [ ] **Step 5: Aplicar los demás cambios de landing/nav**

`app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

`app/login/actions.ts` — en `login()`, la línea de éxito:
```ts
  redirect("/dashboard");
```
(No tocar `signOut`, que redirige a `/login`.)

`components/nav.tsx` — el primer elemento de `links`:
```ts
  { href: "/dashboard", label: "Dashboard" },
```

`app/my-actions/page.tsx` — reemplazar TODO el archivo por un redirect (su contenido vive embebido en `/dashboard`):
```tsx
import { redirect } from "next/navigation";

export default function MyActionsPage() {
  redirect("/dashboard");
}
```

- [ ] **Step 6: Build + lint + suite completa (gate final del slice)**

Run: `npm run build && npm run lint && npm test -- --no-file-parallelism`
Expected: build OK, lint limpio, TODA la suite verde (incluye `auth-redirect` actualizado y `dashboard` nuevo).

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/auth-redirect.ts test/auth-redirect.test.ts app/page.tsx app/login/actions.ts components/nav.tsx app/my-actions/page.tsx
git commit -m "feat: landing pasa a /dashboard (auth-redirect, root, post-login, nav; /my-actions→redirect)"
```

---

## Cierre del slice (tras el review de rama)

- Actualizar `.superpowers/sdd/progress.md`.
- `git checkout main && git merge --no-ff feat/dashboard-home && git push`.
- Sin migración. Confirmar en Vercel que el build instala `recharts`.
- Smoke manual recomendado en el review final: abrir `/dashboard`, verificar charts con color por grupo y que clickear una barra navega a `/pipeline?group=…`/`?stage=…` (reusa filtros P4b-1).

## Self-Review (hecho)

- **Cobertura del spec:** KPIs (Task 5, `dashboardTotals` Task 1), pipeline por grupo (Task 4/5, reusa `groupProjectsByStageGroup`), pipeline por etapa (Task 1 `pipelineByStage` + Task 4/5), My Actions embebido (Task 2 panel + Task 5), charts clickeables → filtros P4b-1 (Task 4), Recharts vía shadcn + rampa de marca (Task 3), landing `/dashboard` + `/my-actions`→redirect (Task 6), MXN+USD en KPIs (Task 5 `formatMXN`/`formatUSD`). Fuera de v1 (reportes analíticos, owner) explícitos en el spec. ✔ sin gaps.
- **Placeholders:** ninguno de lógica. La única nota de adaptación es el `formatter` del tooltip contra los tipos generados por shadcn (dependencia versionada), no un placeholder de lógica. ✔
- **Consistencia de tipos:** `StageBucket`/`GROUP_COLORS` (Task 1) usados en Tasks 4-5; `MyActionsPanel` firma (Task 2) invocada igual en `/my-actions` (Task 2) y `/dashboard` (Task 5) con `missing: ProjectListRow[]` (subset estructural {id,name,companyName}); `groups` = `groupProjectsByStageGroup(...)` satisface `{group,label,count,totalValue}[]` de `PipelineGroupChart`; `dashboardTotals` (Task 1) consumido en Task 5. ✔
```
