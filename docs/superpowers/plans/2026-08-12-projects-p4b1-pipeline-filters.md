# Projects P4b-1 — Filtros + Búsqueda del Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar filtros (solución / etapa / grupo / valor / fecha esperada / estado) y búsqueda de texto al board `/pipeline`, con totales de columna en MXN + USD, todo SSR y con lógica pura testeable.

**Architecture:** El board sigue cargando todos los proyectos con `listAllProjects`; un parser puro traduce `searchParams` → `PipelineFilters`, un predicado puro `filterProjects` los recorta, y `groupProjectsByStageGroup` agrupa el conjunto ya filtrado (los totales reflejan lo visible). La barra de filtros es un `<form method="get">` server-side (cero JS de client). El equivalente USD sale de una tasa constante única + helper puro.

**Tech Stack:** Next.js 15 App Router (server components, `force-dynamic`), React 19, TypeScript, Tailwind v4 con tokens del design system, Vitest (tests puros, sin DB).

## Global Constraints

- **Sin cambio de schema → sin migración.** Ninguna task toca `db/schema.ts`.
- **Tests en `test/`** (no `tests/`), nombre `*.test.ts`, imports vía alias `@/`, estilo `describe/it/expect` de Vitest. Fixtures mínimas (solo campos bajo prueba).
- **Selección simple** en enums; **owner queda fuera** (diferido a RLS). Búsqueda acotada a `name` / `companyName` / `plantName`.
- **UI nueva usa tokens del design system** (`docs/color-spec.md`, `docs/typography-spec.md`), NO utilidades ad-hoc `neutral-*`/`amber-*`. Tokens Tailwind disponibles (de `app/globals.css`): `bg-surface`, `bg-surface-2`, `bg-background`, `text-ink`, `text-muted`, `text-faint`, `border-line`, `border-line-strong`, `bg-solar`/`text-on-solar`, `text-solar`, `text-storage`. Tipografía: `font-display tracking-display` (títulos), `font-mono` (dato). **Leer ambos specs antes de escribir estilos.** Copy en **español**.
- **Suite flaky con paralelismo**: durante desarrollo usar tests focalizados (`npm test -- <patrón>`); el gate final corre la suite completa como `npm test -- --no-file-parallelism`.
- Tipos de datos relevantes (`db/schema.ts`): `estimatedValue: number | null` (integer), `expectedCloseDate: string | null` (date `mode:"string"`, formato `YYYY-MM-DD`), `plantName: string | null`, `name: string`. `ProjectListRow = Project & { companyName: string }`.
- Enums y helpers ya existen en `lib/project-pipeline.ts`: `STAGES`, `STAGE_GROUPS`, `SOLUTION_TYPES`, `STATUSES` (arrays `{value,label}`); `STAGE_VALUES`, `STATUS_VALUES`, `SOLUTION_TYPE_VALUES` (arrays de strings); `formatMXN`.

---

### Task 1: Moneda — tasa única + `formatUSD`

**Files:**
- Create: `lib/currency.ts`
- Test: `test/currency.test.ts`

**Interfaces:**
- Produces: `export const MXN_PER_USD: number`; `export function formatUSD(mxn: number | null, rate?: number): string`.

- [ ] **Step 1: Write the failing test**

```ts
// test/currency.test.ts
import { describe, it, expect } from "vitest";
import { formatUSD } from "@/lib/currency";

describe("formatUSD", () => {
  it("null → guion", () => {
    expect(formatUSD(null)).toBe("—");
  });
  it("convierte MXN→USD con la tasa por defecto y redondea a entero", () => {
    expect(formatUSD(18000)).toBe("$1,000"); // 18000 / 18
  });
  it("respeta una tasa provista", () => {
    expect(formatUSD(2000, 20)).toBe("$100"); // 2000 / 20
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- currency`
Expected: FAIL (no existe `@/lib/currency`).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/currency.ts
// TODO: mover a settings/tipo-de-cambio configurable por Admin (§15, §17/§18).
// Única fuente de verdad de la tasa hasta ese slice; el display MXN+USD ya queda hecho.
export const MXN_PER_USD = 18;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUSD(mxn: number | null, rate: number = MXN_PER_USD): string {
  if (mxn == null) return "—";
  return usdFormatter.format(mxn / rate);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- currency`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/currency.ts test/currency.test.ts
git commit -m "feat: formatUSD + tasa MXN_PER_USD (única fuente hasta slice de tipo de cambio)"
```

---

### Task 2: `PipelineFilters` + parser + `hasActiveFilters`

**Files:**
- Create: `lib/pipeline-filters.ts`
- Test: `test/pipeline-filters.test.ts`

**Interfaces:**
- Consumes: `STAGE_VALUES`, `STATUS_VALUES`, `SOLUTION_TYPE_VALUES`, `STAGE_GROUPS` de `@/lib/project-pipeline`.
- Produces:
  - `export type PipelineFilters = { stage, group, solution, status: string|null; valueMin, valueMax: number|null; closeFrom, closeTo, q: string|null }`
  - `export function parsePipelineFilters(sp: Record<string, string | string[] | undefined>): PipelineFilters`
  - `export function hasActiveFilters(f: PipelineFilters): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// test/pipeline-filters.test.ts
import { describe, it, expect } from "vitest";
import { parsePipelineFilters, hasActiveFilters } from "@/lib/pipeline-filters";

describe("parsePipelineFilters", () => {
  it("mapea enums válidos y deja el resto null", () => {
    const f = parsePipelineFilters({ stage: "propuesta_enviada", solution: "solar" });
    expect(f.stage).toBe("propuesta_enviada");
    expect(f.solution).toBe("solar");
    expect(f.group).toBeNull();
    expect(f.status).toBeNull();
  });
  it("rechaza enums inválidos → null", () => {
    const f = parsePipelineFilters({ stage: "nope", group: "xx", solution: "yy", status: "zz" });
    expect(f.stage).toBeNull();
    expect(f.group).toBeNull();
    expect(f.solution).toBeNull();
    expect(f.status).toBeNull();
  });
  it("parsea ints de valor; no numérico → null", () => {
    const f = parsePipelineFilters({ valueMin: "1000", valueMax: "abc" });
    expect(f.valueMin).toBe(1000);
    expect(f.valueMax).toBeNull();
  });
  it("pasa fechas como string y trimea q; q vacío → null", () => {
    const f = parsePipelineFilters({ closeFrom: "2026-01-01", q: "  hola  " });
    expect(f.closeFrom).toBe("2026-01-01");
    expect(f.q).toBe("hola");
    expect(parsePipelineFilters({ q: "   " }).q).toBeNull();
  });
  it("toma el primer valor si viene array", () => {
    const f = parsePipelineFilters({ stage: ["propuesta_enviada", "otra"] });
    expect(f.stage).toBe("propuesta_enviada");
  });
});

describe("hasActiveFilters", () => {
  it("sin filtros → false", () => {
    expect(hasActiveFilters(parsePipelineFilters({}))).toBe(false);
  });
  it("con cualquier filtro → true", () => {
    expect(hasActiveFilters(parsePipelineFilters({ q: "x" }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pipeline-filters`
Expected: FAIL (no existe `@/lib/pipeline-filters`).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/pipeline-filters.ts
import {
  STAGE_VALUES,
  STATUS_VALUES,
  SOLUTION_TYPE_VALUES,
  STAGE_GROUPS,
} from "@/lib/project-pipeline";

const GROUP_VALUES = STAGE_GROUPS.map((g) => g.value);

export type PipelineFilters = {
  stage: string | null;
  group: string | null;
  solution: string | null;
  status: string | null;
  valueMin: number | null;
  valueMax: number | null;
  closeFrom: string | null;
  closeTo: string | null;
  q: string | null;
};

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function enumOrNull(v: SP[string], allowed: readonly string[]): string | null {
  const s = first(v);
  return s != null && allowed.includes(s) ? s : null;
}

function intOrNull(v: SP[string]): number | null {
  const s = first(v);
  if (s == null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

function dateOrNull(v: SP[string]): string | null {
  const s = first(v);
  return s != null && s.trim() !== "" ? s : null;
}

function textOrNull(v: SP[string]): string | null {
  const s = first(v)?.trim();
  return s ? s : null;
}

export function parsePipelineFilters(sp: SP): PipelineFilters {
  return {
    stage: enumOrNull(sp.stage, STAGE_VALUES),
    group: enumOrNull(sp.group, GROUP_VALUES),
    solution: enumOrNull(sp.solution, SOLUTION_TYPE_VALUES),
    status: enumOrNull(sp.status, STATUS_VALUES),
    valueMin: intOrNull(sp.valueMin),
    valueMax: intOrNull(sp.valueMax),
    closeFrom: dateOrNull(sp.closeFrom),
    closeTo: dateOrNull(sp.closeTo),
    q: textOrNull(sp.q),
  };
}

export function hasActiveFilters(f: PipelineFilters): boolean {
  return Object.values(f).some((v) => v !== null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pipeline-filters`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline-filters.ts test/pipeline-filters.test.ts
git commit -m "feat: PipelineFilters + parsePipelineFilters + hasActiveFilters"
```

---

### Task 3: Predicado `matchesFilters` + `filterProjects`

**Files:**
- Modify: `lib/pipeline-filters.ts` (append)
- Test: `test/pipeline-filters.test.ts` (append)

**Interfaces:**
- Consumes: `PipelineFilters`, `parsePipelineFilters` (Task 2).
- Produces:
  - `export type FilterableProject = { stage, stageGroup, solutionType, status: string; estimatedValue: number|null; expectedCloseDate: string|null; name, companyName: string; plantName: string|null }`
  - `export function matchesFilters(p: FilterableProject, f: PipelineFilters): boolean`
  - `export function filterProjects<P extends FilterableProject>(projects: P[], f: PipelineFilters): P[]` (preserva el tipo concreto de la fila, ej. `ProjectListRow`)

- [ ] **Step 1: Write the failing test (append al archivo existente)**

```ts
// test/pipeline-filters.test.ts  (agregar imports arriba y estos describe abajo)
import { matchesFilters, filterProjects } from "@/lib/pipeline-filters";

type P = Parameters<typeof matchesFilters>[0];
function proj(over: Partial<P> = {}): P {
  return {
    stage: "lead_sin_contactar",
    stageGroup: "lead",
    solutionType: "solar",
    status: "open",
    estimatedValue: 1000,
    expectedCloseDate: "2026-06-15",
    name: "Planta Norte",
    companyName: "Acme",
    plantName: "Nave 1",
    ...over,
  };
}
const none = parsePipelineFilters({});

describe("matchesFilters", () => {
  it("sin filtros matchea todo", () => {
    expect(matchesFilters(proj(), none)).toBe(true);
  });
  it("filtra por cada enum", () => {
    expect(matchesFilters(proj({ status: "won" }), parsePipelineFilters({ status: "won" }))).toBe(true);
    expect(matchesFilters(proj({ status: "open" }), parsePipelineFilters({ status: "won" }))).toBe(false);
    expect(matchesFilters(proj({ stageGroup: "commercial" }), parsePipelineFilters({ group: "commercial" }))).toBe(true);
    expect(matchesFilters(proj({ solutionType: "bess" }), parsePipelineFilters({ solution: "solar" }))).toBe(false);
  });
  it("rango de valor inclusivo; estimatedValue null con bound → excluye; sin bound pasa", () => {
    const f = parsePipelineFilters({ valueMin: "500", valueMax: "1500" });
    expect(matchesFilters(proj({ estimatedValue: 1000 }), f)).toBe(true);
    expect(matchesFilters(proj({ estimatedValue: 500 }), f)).toBe(true);
    expect(matchesFilters(proj({ estimatedValue: 1500 }), f)).toBe(true);
    expect(matchesFilters(proj({ estimatedValue: 2000 }), f)).toBe(false);
    expect(matchesFilters(proj({ estimatedValue: null }), f)).toBe(false);
    expect(matchesFilters(proj({ estimatedValue: null }), none)).toBe(true);
  });
  it("rango de fecha lexicográfico inclusivo; expectedCloseDate null con bound → excluye", () => {
    const f = parsePipelineFilters({ closeFrom: "2026-01-01", closeTo: "2026-12-31" });
    expect(matchesFilters(proj({ expectedCloseDate: "2026-06-15" }), f)).toBe(true);
    expect(matchesFilters(proj({ expectedCloseDate: "2026-01-01" }), f)).toBe(true);
    expect(matchesFilters(proj({ expectedCloseDate: "2025-12-31" }), f)).toBe(false);
    expect(matchesFilters(proj({ expectedCloseDate: null }), f)).toBe(false);
  });
  it("q: case-insensitive y sin acentos, sobre name/companyName/plantName", () => {
    expect(matchesFilters(proj({ name: "Planta México" }), parsePipelineFilters({ q: "mexico" }))).toBe(true);
    expect(matchesFilters(proj({ companyName: "Açaí SA" }), parsePipelineFilters({ q: "acai" }))).toBe(true);
    expect(matchesFilters(proj({ plantName: "Nave Sur" }), parsePipelineFilters({ q: "SUR" }))).toBe(true);
    expect(matchesFilters(proj({ name: "X", companyName: "Y", plantName: "Z" }), parsePipelineFilters({ q: "nada" }))).toBe(false);
    expect(matchesFilters(proj({ name: "X", companyName: "Y", plantName: null }), parsePipelineFilters({ q: "nave" }))).toBe(false);
  });
});

describe("filterProjects", () => {
  it("aplica AND entre dimensiones", () => {
    const rows = [
      proj({ name: "A", status: "won", solutionType: "solar" }),
      proj({ name: "B", status: "won", solutionType: "bess" }),
      proj({ name: "C", status: "open", solutionType: "solar" }),
    ];
    const out = filterProjects(rows, parsePipelineFilters({ status: "won", solution: "solar" }));
    expect(out.map((p) => p.name)).toEqual(["A"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pipeline-filters`
Expected: FAIL (`matchesFilters`/`filterProjects` no exportados).

- [ ] **Step 3: Write minimal implementation (append a `lib/pipeline-filters.ts`)**

```ts
export type FilterableProject = {
  stage: string;
  stageGroup: string;
  solutionType: string;
  status: string;
  estimatedValue: number | null;
  expectedCloseDate: string | null;
  name: string;
  companyName: string;
  plantName: string | null;
};

function normalizeText(s: string): string {
  // \u0300-\u036f = bloque de marcas diacríticas combinantes (quita acentos tras NFD)
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function matchesFilters(p: FilterableProject, f: PipelineFilters): boolean {
  if (f.stage && p.stage !== f.stage) return false;
  if (f.group && p.stageGroup !== f.group) return false;
  if (f.solution && p.solutionType !== f.solution) return false;
  if (f.status && p.status !== f.status) return false;

  if (f.valueMin != null || f.valueMax != null) {
    if (p.estimatedValue == null) return false;
    if (f.valueMin != null && p.estimatedValue < f.valueMin) return false;
    if (f.valueMax != null && p.estimatedValue > f.valueMax) return false;
  }

  if (f.closeFrom != null || f.closeTo != null) {
    if (p.expectedCloseDate == null) return false;
    if (f.closeFrom != null && p.expectedCloseDate < f.closeFrom) return false;
    if (f.closeTo != null && p.expectedCloseDate > f.closeTo) return false;
  }

  if (f.q) {
    const needle = normalizeText(f.q);
    const hay = [p.name, p.companyName, p.plantName ?? ""].map(normalizeText);
    if (!hay.some((h) => h.includes(needle))) return false;
  }

  return true;
}

export function filterProjects<P extends FilterableProject>(
  projects: P[],
  f: PipelineFilters
): P[] {
  return projects.filter((p) => matchesFilters(p, f));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pipeline-filters`
Expected: PASS (todos, incluidos los de Task 2).

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline-filters.ts test/pipeline-filters.test.ts
git commit -m "feat: matchesFilters + filterProjects (predicado AND del pipeline)"
```

---

### Task 4: `PipelineFilterBar` (server component)

**Files:**
- Create: `components/pipeline-filter-bar.tsx`

**Interfaces:**
- Consumes: `PipelineFilters` (Task 2); `STAGES`, `STAGE_GROUPS`, `SOLUTION_TYPES`, `STATUSES` de `@/lib/project-pipeline`.
- Produces: `export function PipelineFilterBar({ filters }: { filters: PipelineFilters }): JSX.Element`.

> No lleva unit test (componente presentacional server, consistente con el repo). El gate es lint acá + build en Task 5. **Antes de escribir estilos, leer `docs/color-spec.md` y `docs/typography-spec.md`** y ajustar clases a sus tokens si difieren de las de abajo (que ya usan tokens del tema).

- [ ] **Step 1: Leer los specs de diseño**

Run: leer `docs/color-spec.md` y `docs/typography-spec.md` (roles de color, jerarquía tipográfica). Confirmar que los tokens usados abajo (`surface`, `surface-2`, `line`, `ink`, `muted`, `solar`/`on-solar`) son los correctos para una barra de controles sobre fondo.

- [ ] **Step 2: Escribir el componente**

```tsx
// components/pipeline-filter-bar.tsx
import Link from "next/link";
import { STAGES, STAGE_GROUPS, SOLUTION_TYPES, STATUSES } from "@/lib/project-pipeline";
import type { PipelineFilters } from "@/lib/pipeline-filters";
import type { Option } from "@/lib/project-pipeline";

const fieldClass = "rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink";
const labelClass = "flex flex-col gap-1 text-xs text-muted";

function EnumSelect({
  name,
  label,
  options,
  value,
}: {
  name: string;
  label: string;
  options: readonly Option[];
  value: string | null;
}) {
  return (
    <label className={labelClass}>
      {label}
      <select name={name} defaultValue={value ?? ""} className={fieldClass}>
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PipelineFilterBar({ filters }: { filters: PipelineFilters }) {
  return (
    <form
      method="get"
      action="/pipeline"
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface-2 p-3"
    >
      <label className={labelClass}>
        Búsqueda
        <input
          type="text"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Proyecto, empresa o planta"
          className={fieldClass}
        />
      </label>
      <EnumSelect name="group" label="Grupo" options={STAGE_GROUPS} value={filters.group} />
      <EnumSelect name="stage" label="Etapa" options={STAGES} value={filters.stage} />
      <EnumSelect name="solution" label="Solución" options={SOLUTION_TYPES} value={filters.solution} />
      <EnumSelect name="status" label="Estado" options={STATUSES} value={filters.status} />
      <label className={labelClass}>
        Valor mín (MXN)
        <input type="number" name="valueMin" defaultValue={filters.valueMin ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Valor máx (MXN)
        <input type="number" name="valueMax" defaultValue={filters.valueMax ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Cierre desde
        <input type="date" name="closeFrom" defaultValue={filters.closeFrom ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Cierre hasta
        <input type="date" name="closeTo" defaultValue={filters.closeTo ?? ""} className={fieldClass} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-solar px-3 py-1 text-sm font-medium text-on-solar">
          Filtrar
        </button>
        <Link href="/pipeline" className="rounded-md border border-line px-3 py-1 text-sm text-ink">
          Limpiar
        </Link>
      </div>
    </form>
  );
}
```

> `Option` está exportado en `lib/project-pipeline.ts` (`export type Option = { value: string; label: string }`).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores en `components/pipeline-filter-bar.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/pipeline-filter-bar.tsx
git commit -m "feat: PipelineFilterBar (form GET server-side con tokens del design system)"
```

---

### Task 5: Cablear `/pipeline` (filtros + totales MXN+USD + estado vacío)

**Files:**
- Modify: `app/pipeline/page.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: `parsePipelineFilters`, `filterProjects`, `hasActiveFilters` (Tasks 2–3); `formatUSD` (Task 1); `PipelineFilterBar` (Task 4); `groupProjectsByStageGroup`, `nextActionByProject` (`@/lib/pipeline`); `formatMXN` (`@/lib/project-pipeline`); `listAllProjects` (`@/db/projects`); `listOpenTasksWithContext` (`@/db/tasks`); `ProjectCard` (`@/components/project-card`).

- [ ] **Step 1: Reemplazar el contenido de `app/pipeline/page.tsx`**

```tsx
// app/pipeline/page.tsx
import { db } from "@/db/client";
import { listAllProjects } from "@/db/projects";
import { listOpenTasksWithContext } from "@/db/tasks";
import { groupProjectsByStageGroup, nextActionByProject } from "@/lib/pipeline";
import { parsePipelineFilters, filterProjects, hasActiveFilters } from "@/lib/pipeline-filters";
import { formatMXN } from "@/lib/project-pipeline";
import { formatUSD } from "@/lib/currency";
import { ProjectCard } from "@/components/project-card";
import { PipelineFilterBar } from "@/components/pipeline-filter-bar";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parsePipelineFilters(await searchParams);
  const projects = await listAllProjects(db, { archived: false });
  const openTasks = await listOpenTasksWithContext(db);
  const filtered = filterProjects(projects, filters);
  const columns = groupProjectsByStageGroup(filtered);
  const nextAction = nextActionByProject(openTasks);
  const empty = hasActiveFilters(filters) && filtered.length === 0;

  return (
    <main className="p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">Pipeline</h1>
      <div className="mt-6">
        <PipelineFilterBar filters={filters} />
      </div>
      {empty ? (
        <p className="mt-6 text-sm text-muted">Sin proyectos que coincidan con los filtros.</p>
      ) : (
        <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div key={col.group} className="w-72 shrink-0">
              <div className="flex items-baseline justify-between border-b border-line pb-2">
                <h2 className="font-display font-bold text-lg tracking-display">{col.label}</h2>
                <span className="text-xs text-muted">
                  {col.count} · {formatMXN(col.totalValue)} · {formatUSD(col.totalValue)}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {col.projects.length === 0 ? (
                  <p className="text-xs text-faint">—</p>
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
      )}
    </main>
  );
}
```

> Cambios respecto al original: parseo de `searchParams` (ahora `Record` en vez de `{}`), `filterProjects` antes de agrupar, `PipelineFilterBar`, total de columna con `formatUSD`, estado vacío, y alineación ligera a tokens (`text-muted`/`border-line`/`text-faint`) en la superficie editada.

- [ ] **Step 2: Typecheck + build**

Run: `npm run build`
Expected: build OK, sin errores de TypeScript (valida el uso de `PipelineFilterBar`, tipos de `searchParams`, y todos los imports).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 4: Suite completa (gate final del slice)**

Run: `npm test -- --no-file-parallelism`
Expected: PASS toda la suite (los 152 previos + los nuevos de `currency` y `pipeline-filters`).

- [ ] **Step 5: Commit**

```bash
git add app/pipeline/page.tsx
git commit -m "feat: filtros + búsqueda + totales MXN/USD en /pipeline (§11.3, §10.8)"
```

---

## Cierre del slice (fuera de las tasks, tras el review de rama)

- Actualizar el ledger `.superpowers/sdd/progress.md` con P4b-1.
- `git checkout main && git merge --no-ff feat/projects-p4b1-pipeline-filters` + `git push`.
- Sin migración (no toca schema).
- Gaps conocidos que quedan de §11.3 (anotar): filtro por owner (va con RLS), totales por-etapa, tasa de cambio editable (constante por ahora), drag entre columnas (P4b-2).

## Self-Review (hecho)

- **Cobertura del spec:** filtros enum (Task 3 `matchesFilters` + Task 4 UI), rangos valor/fecha (Task 3 + Task 4), búsqueda `q` (Task 3 + Task 4), totales sobre filtrado (Task 5), MXN+USD (Task 1 + Task 5), estado vacío (Task 5), parser robusto (Task 2). Owner/multi-select/por-etapa/FX-editable: declarados fuera de alcance en el spec. ✔ sin gaps.
- **Placeholders:** ninguno; todo el código está completo. La constante `MXN_PER_USD = 18` es intencional con TODO. ✔
- **Consistencia de tipos:** `PipelineFilters` (Task 2) usado igual en Tasks 3–5; `FilterableProject` (Task 3) lo satisface `ProjectListRow`; `formatUSD(number|null)` (Task 1) recibe `col.totalValue: number` (Task 5); `PipelineFilterBar({filters})` (Task 4) invocado con `filters` (Task 5). ✔
