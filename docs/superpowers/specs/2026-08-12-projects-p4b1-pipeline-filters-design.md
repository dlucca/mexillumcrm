# Projects P4b-1 — Filtros + Búsqueda del Pipeline (Design)

Fecha: 2026-08-12
Rama: `feat/projects-p4b1-pipeline-filters`
PRD: §11.3 (Pipeline Opción C), §10.8 (totales por grupo MXN+USD), §4/§15 (moneda MXN base + equivalente USD por tipo de cambio configurable).

## Contexto y alcance

`§11.3` junta tres capacidades del Pipeline: (a) drag entre columnas, (b) filtros
(owner / solución / etapa / grupo / valor / fecha esperada / estado), (c) búsqueda global.
P4b se parte en dos sub-slices:

- **P4b-1 (este spec):** filtros + búsqueda. Lógica pura, SSR, bajo riesgo, desplegable solo.
- **P4b-2 (aparte):** drag entre columnas (interacción client).

### Fuera de alcance (decisiones tomadas en brainstorming)

- **Filtro por owner:** DIFERIDO al slice de RLS/ownership. Hoy `owner_user_id` es un uuid
  pelado en `projects`, sin tabla de usuarios/perfiles ni nombres para mostrar; el filtro "de
  verdad" (dropdown con nombres, "mío" desde auth) pertenece a ese slice. Gap conocido de §11.3.
- **Búsqueda global cross-entity** (command palette proyectos+empresas+contactos): fuera. La
  búsqueda de este slice se acota a las cards del pipeline. La global es slice aparte (junto al nav).
- **Multi-select en enums:** fuera. Selección simple. Un valor es un caso de la lista si más
  adelante se agrega multi, sin romper el esquema.
- **Totales por etapa:** fuera. Solo totales por grupo (recalculados sobre el conjunto filtrado).
  El desglose por-etapa de §11.3 queda como gap conocido.
- **Tipo de cambio configurable (tabla `settings` + config Admin):** fuera. Ver "Moneda" abajo.
- **Re-skin completo del board:** fuera (es la "pasada de diseño" dedicada). Este slice solo
  alinea al spec de diseño la UI que toca (barra de filtros nueva + línea de totales).

## Arquitectura

Todo server-side + funciones puras, siguiendo los patrones del repo (capa pura sobre `AnyDb`,
constantes/predicados puros en `lib/`, páginas y cards como server components, filtros vía
`searchParams`). **Sin cambio de schema → sin migración.**

### Flujo de datos

```
app/pipeline/page.tsx (server, force-dynamic)
  1. const sp = await searchParams
  2. const filters = parsePipelineFilters(sp)                 // puro
  3. const projects = await listAllProjects(db, { archived: false })
     const openTasks = await listOpenTasksWithContext(db)
  4. const filtered = filterProjects(projects, filters)        // puro, predicado AND
  5. const columns = groupProjectsByStageGroup(filtered)       // totales sobre lo filtrado
  6. const nextAction = nextActionByProject(openTasks)
  7. render: <PipelineFilterBar filters={filters} /> + columnas + cards
             + estado vacío global si hasActiveFilters(filters) && filtered.length === 0
```

El filtrado ocurre **en memoria** sobre el conjunto ya cargado por `listAllProjects` (el board
necesita todos los grupos de todas formas). Mantiene la lógica pura y testeable sin tocar SQL.

## Componentes / módulos

### `lib/pipeline-filters.ts` (nuevo — puro)

```ts
export type PipelineFilters = {
  stage: string | null;      // debe pertenecer a STAGE_VALUES
  group: string | null;      // debe pertenecer a STAGE_GROUPS[].value
  solution: string | null;   // debe pertenecer a SOLUTION_TYPE_VALUES
  status: string | null;     // debe pertenecer a STATUS_VALUES
  valueMin: number | null;   // entero MXN
  valueMax: number | null;   // entero MXN
  closeFrom: string | null;  // "YYYY-MM-DD"
  closeTo: string | null;    // "YYYY-MM-DD"
  q: string | null;          // texto libre, trim; "" → null
};

// Rechaza enums no válidos → null (nunca rompe). Parsea ints (no numérico → null).
// Fechas se pasan como string YYYY-MM-DD tal cual (sin validar calendario). Trimea q.
export function parsePipelineFilters(
  sp: Record<string, string | string[] | undefined>
): PipelineFilters;

// Predicado AND. Reglas de borde EXPLÍCITAS:
//  - value bound seteado y estimatedValue == null  → NO matchea (excluye sin valor)
//  - date bound seteado y expectedCloseDate == null → NO matchea (excluye sin fecha)
//  - fechas: comparación lexicográfica de YYYY-MM-DD (closeFrom <= d <= closeTo)
//  - q: normaliza minúsculas + sin diacríticos (NFD) sobre name, companyName, plantName;
//       matchea si q normalizado es substring de cualquiera de los tres
export function matchesFilters(
  project: Pick<ProjectListRow,
    "stage" | "stageGroup" | "solutionType" | "status" |
    "estimatedValue" | "expectedCloseDate" | "name" | "companyName" | "plantName">,
  f: PipelineFilters
): boolean;

export function filterProjects<P extends ...>(projects: P[], f: PipelineFilters): P[];

export function hasActiveFilters(f: PipelineFilters): boolean; // algún campo != null
```

Nota: `parsePipelineFilters` ignora valores de array (toma el primero) por robustez ante
`searchParams` repetidos; solo se usa selección simple.

### `lib/currency.ts` (nuevo — puro)

```ts
// TODO: mover a settings/tipo-de-cambio configurable por Admin (§15, §17/§18).
export const MXN_PER_USD = 18;

// "—" si null. Intl.NumberFormat en-US USD, maximumFractionDigits 0.
export function formatUSD(mxn: number | null, rate: number = MXN_PER_USD): string;
```

Único lugar de la tasa. Cuando llegue el slice de tipo de cambio, solo cambia el origen de
`rate`; el display MXN+USD ya queda hecho.

### `components/pipeline-filter-bar.tsx` (nuevo — server component)

`<form method="get" action="/pipeline">` con campos pre-cargados desde `filters`:

- `<select name="stage">`, `name="group"`, `name="solution"`, `name="status"` — cada uno con
  una opción "Todos" (value `""`) + las opciones del enum correspondiente (`STAGES`,
  `STAGE_GROUPS`, `SOLUTION_TYPES`, `STATUSES`), `defaultValue` desde el filtro.
- `<input type="number" name="valueMin">` y `name="valueMax">` (MXN).
- `<input type="date" name="closeFrom">` y `name="closeTo">`.
- `<input type="text" name="q">` (búsqueda).
- Botón submit **"Filtrar"** + `<Link href="/pipeline">` **"Limpiar"**.

Cero JS de client, cero debounce: el submit recarga `/pipeline?...` y el server re-renderiza.
Campos vacíos no aportan filtro (parser los mapea a null).

### `app/pipeline/page.tsx` (modificado)

- `searchParams: Promise<Record<string, string | string[] | undefined>>`.
- Inserta el flujo de arriba. Total de columna pasa a **`{count} · {formatMXN} · {formatUSD}`**.
- Estado vacío global (todas las columnas vacías con filtros activos):
  "Sin proyectos que coincidan con los filtros."

### `components/project-card.tsx`

Sin cambios funcionales en este slice (la card sigue mostrando MXN del proyecto). El USD se
agrega en los **totales de columna** (que es el requisito explícito de §10.8). USD por-card
pertenece más al detalle (§11.4) y queda fuera.

## Diseño visual

La barra de filtros es UI nueva → **usar los tokens de `docs/color-spec.md` y
`docs/typography-spec.md`** (leerlos antes de escribir estilos), no utilidades ad-hoc
(neutral/amber). Alinear al spec la línea de totales que se edita. No re-skinear el resto del
board (pasada de diseño dedicada). Copy en español.

## Manejo de errores / bordes

- Enum inválido en URL → tratado como sin filtro (null); el board no rompe (no 500).
- Int/fecha malformada en URL → null (ignorado). No se valida el calendario de la fecha (deuda
  conocida general del repo con `requiredDate`); una fecha imposible simplemente no matchea.
- `valueMin > valueMax` (o rango de fechas invertido) → resultado vacío legítimo, sin error.
- Board/columna vacía tras filtrar → placeholder "—" existente por columna; mensaje global
  cuando no hay ningún match con filtros activos.

## Testing (TDD — Vitest puro, sin DB, no flaky)

- `parsePipelineFilters`: enum válido/ inválido/ ausente; int válido/ no numérico; `q` con
  espacios → trim; `q` vacío → null; toma el primer valor si viene array.
- `matchesFilters` / `filterProjects`: cada dimensión aislada; combinación AND; `estimatedValue`
  null contra bound de valor (excluye); `expectedCloseDate` null contra bound de fecha (excluye);
  rango de fechas inclusivo en los extremos; `q` case-insensitive y sin acentos
  ("mexico" matchea "México"); `q` sobre los 3 campos.
- `hasActiveFilters`: sin filtros → false; con cualquiera → true.
- `formatUSD`: null → "—"; redondeo a entero; respeta `rate`.
- Totales: `groupProjectsByStageGroup(filterProjects(...))` refleja el conjunto filtrado
  (conteo y suma MXN).

Página / componentes SSR: sin tests dedicados (consistente con el repo; `force-dynamic`,
sin lógica no-pura propia).

## Entrega

- Rama `feat/projects-p4b1-pipeline-filters`, merge `--no-ff` a `main` + push.
- Sin migración (no toca schema).
- Ledger en `.superpowers/sdd/progress.md`.
- Ejecución: subagent-driven-development (subagente fresco por task + review por task + review
  final de rama en opus).
