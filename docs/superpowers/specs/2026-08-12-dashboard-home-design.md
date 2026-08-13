# Dashboard (home unificado) — Design

Fecha: 2026-08-12
Rama: `feat/dashboard-home`
PRD: §10.8 (Reportes/dashboards con Recharts — subconjunto "barato"), §11.1 (interfaz sobria/densa/operativa), §11.2 (sección Reports/Dashboard), §11.6 (My Actions), §4/§10.8 (MXN + USD).

## Contexto y alcance

Herramienta de uso **solo** las primeras ~3 semanas (sin roles/ownership todavía). Se quiere un
**dashboard** que dé el pulso del pipeline de un vistazo, **con My Actions embebido** para que el
home unifique "el panorama" + "qué hago hoy". Los **reportes analíticos** (derivados de Activities)
se posponen.

### Dentro de v1
- **KPIs de cabecera**: pipeline abierto (conteo + valor MXN, USD secundario), # projects sin
  próxima acción, # tareas vencidas.
- **Pipeline por grupo**: bar chart de las 6 columnas (conteo/valor).
- **Pipeline por etapa**: desglose de las 13 etapas (conteo/valor), agrupadas por su grupo.
- **My Actions embebido**: buckets diarios (vencidas / hoy / próximas 7d) + projects sin next
  action, cada item linkeando a su proyecto.
- Charts **clickeables** → `/pipeline?group=…` / `?stage=…` (reusa los filtros de P4b-1).

### Fuera de v1 (siguen en "reportes", slice posterior)
- Conversión entre etapas, tiempo promedio en etapa, actividad semanal por usuario (derivados de
  Activities). Projects por owner (vuelve con el slice de usuarios/RLS). Sin paginación.

## Decisiones de producto/arquitectura (del brainstorming)
- **Librería de charts:** Recharts vía **shadcn/ui charts** (`ChartContainer`/`ChartTooltip`), lo
  que nombra el PRD. shadcn ya está configurado (`components.json`, style base-nova, lucide) pero
  sin componentes generados aún.
- **Landing:** `/dashboard` pasa a ser el home (post-login y `/` → `/dashboard`). Nav:
  **Dashboard** · Pipeline · Proyectos · Empresas (reemplaza "My Actions").
- **My Actions embebido sin duplicar lógica:** se extrae el render a un componente reutilizable;
  la lógica pura (`bucketTasksByDueDate`, `projectsMissingNextAction`, `todayInMexicoCity`) se
  reusa tal cual. `/my-actions` queda como **redirect → `/dashboard`**.
- **Sin cambio de schema → sin migración.** Sin ownership (uso solo): las vistas muestran todo.
- **Diseño:** dirección industrial-técnica del repo (tokens Sol/Almacenamiento, Barlow / Barlow
  Condensed / JetBrains Mono). Panel denso, **no** card-grid uniforme, sin hero. Se aplica la
  artesanía de frontend-design DENTRO del design system (no estética nueva ad-hoc).

## Arquitectura

### Capa de datos (pura, en el server)
`lib/dashboard.ts` (nuevo):
```ts
export type StageBucket = { stage: string; label: string; group: string; count: number; totalValue: number };
// 13 etapas SIEMPRE presentes, en el orden de STAGES, con su grupo. count y suma de estimatedValue (null→0).
export function pipelineByStage<P extends { stage: string; estimatedValue: number | null }>(projects: P[]): StageBucket[];

export type DashboardTotals = { openCount: number; openValue: number; missingNextAction: number; overdueTasks: number };
// openCount/openValue = projects con status "open" (conteo + suma estimatedValue null→0).
// missingNextAction = projectsMissingNextAction(projects, openTasks).length
// overdueTasks = bucketTasksByDueDate(openTasks, today).overdue.length
export function dashboardTotals(
  projects: { id: string; status: string; estimatedValue: number | null }[],
  openTasks: { projectId: string; dueDate: string }[],
  today: string
): DashboardTotals;
```
`pipelineByGroup` ya existe: `groupProjectsByStageGroup` (`lib/pipeline.ts`). Se reusa para el
chart por grupo (da `{group,label,count,totalValue}` en orden, con vacías).

La página server calcula todo con funciones puras testeadas y pasa a los charts **arrays ya
preparados** (los componentes de chart no calculan nada).

### Extracción de My Actions
`components/my-actions-panel.tsx` (nuevo, **server component**): recibe props ya computadas y
renderiza los buckets + "sin próxima acción". Firma:
```ts
export function MyActionsPanel(props: {
  overdue: OpenTaskRow[];
  dueToday: OpenTaskRow[];
  upcoming: OpenTaskRow[];
  missing: { id: string; name: string; companyName: string }[];
}): JSX.Element;
```
- Mueve el markup actual de `app/my-actions/page.tsx` (TaskRow/TaskSection + sección "sin próxima
  acción") al componente, **alineando a tokens del design system** (reemplaza `hover:bg-neutral-50`
  → `hover:bg-surface-2`, `text-neutral-500` → `text-muted`, `text-amber-700` → `text-solar-ink`,
  `border` → `border-line`). Copy en español, sin cambios de texto.
- El comportamiento (buckets, links a `/projects/[id]`, textos) NO cambia → los tests existentes de
  `lib/my-actions` siguen verdes (la extracción es de presentación).

### shadcn + Recharts + tokens
- `npx shadcn@latest add chart card` → genera `components/ui/chart.tsx`, `components/ui/card.tsx`,
  y `lib/utils.ts` (`cn()`) si falta; instala `recharts` como dependencia (queda en el repo).
- **Rampa de marca de 6 colores** (hay 6 grupos, pero shadcn scaffoldeó solo `--chart-1..5`): NO se
  depende de esas 5 vars. Se define una constante `GROUP_COLORS: Record<groupValue, cssVar>` que
  mapea los 6 grupos a tokens de marca existentes del color-spec (rampa Sol→Almacenamiento, p.ej.
  `lead`→`var(--solar)`, … `active`→`var(--storage)`), y se pasa como `color` en el `config` del
  `ChartContainer` (la API de shadcn charts toma color por serie/dato vía config, sin exigir
  `--chart-n`). Las etapas heredan el color de su grupo (`stageGroupFor`). Los `--chart-*` gris
  quedan sin usar (no se tocan).

### Componentes de chart (client mínimos)
- `components/pipeline-group-chart.tsx` (`"use client"`): recibe `PipelineColumn[]` ya calculado,
  renderiza un **BarChart horizontal** (6 grupos) con `ChartContainer`. Barra clickeable →
  `router.push('/pipeline?group=' + group)`. Tooltip con conteo + `formatMXN`.
- `components/pipeline-stage-chart.tsx` (`"use client"`): recibe `StageBucket[]`, **BarChart
  horizontal** de 13 etapas, color por grupo (lee como embudo). Barra clickeable →
  `/pipeline?stage=' + stage`. Tooltip con conteo + `formatMXN`.
- Los charts muestran **valor** por defecto (barra proporcional al `totalValue`), con el conteo en
  el tooltip/etiqueta. (El eje monetario en MXN; USD se reserva a los KPIs de cabecera para no
  saturar los ejes.)

### Página `app/dashboard/page.tsx` (nueva, `force-dynamic`)
```
1. today = todayInMexicoCity()
2. projects = listAllProjects(db,{archived:false}); openTasks = listOpenTasksWithContext(db)
3. totals = dashboardTotals(projects, openTasks, today)
4. groups = groupProjectsByStageGroup(projects); stages = pipelineByStage(projects)
5. { overdue, dueToday, upcoming } = bucketTasksByDueDate(openTasks, today, 7)
   missing = projectsMissingNextAction(projects, openTasks)
6. layout:
   - Título "Dashboard" (font-display tracking-display).
   - Franja KPI full-width (numerales JetBrains Mono tabular-nums): Pipeline abierto (conteo +
     formatMXN, USD secundario con formatUSD) · Sin próxima acción (acento solar si >0) ·
     Tareas vencidas (acento danger si >0). No "big-number cards" repetidas: tira compacta,
     jerarquía por tamaño/peso, alineada a la izquierda.
   - Grid de 2 columnas (apilan en angosto, container query / lg:):
       Izquierda: <PipelineGroupChart columns={groups}/> + <PipelineStageChart stages={stages}/>
       Derecha:   <MyActionsPanel overdue dueToday upcoming missing/>
```
Estados vacíos que enseñan (no "nada aquí"): sin projects → sugerir crear el primero; sin tareas →
"Nada pendiente hoy" ya cubierto por MyActionsPanel.

### Cambios de landing / nav
- `lib/supabase/auth-redirect.ts`: `authRedirectTarget` retorna `/dashboard` (no `/my-actions`)
  para authed en `/login`. **Actualizar sus tests.**
- `app/page.tsx`: redirect de `/` (authed) → `/dashboard`.
- `app/login/actions.ts`: post-login redirect → `/dashboard`.
- `components/nav.tsx`: primer ítem pasa a `{ href: "/dashboard", label: "Dashboard" }`.
- `app/my-actions/page.tsx`: reemplazar por `redirect("/dashboard")` (mantiene el link viejo vivo).

## Manejo de errores / bordes
- DB vacía: charts muestran 6 grupos / 13 etapas con valor 0 (no rompen); KPIs en 0; MyActionsPanel
  muestra sus vacíos. Estado vacío de "sin projects" sugiere crear el primero.
- Barras con `totalValue = 0`: se renderizan con longitud mínima/etiqueta 0, siguen clickeables.
- `router.push` en click de barra: el destino usa un enum de grupo/etapa válido (server-rendered),
  así que no hay input inválido.

## Testing (TDD — Vitest puro, sin DB, no flaky)
- `pipelineByStage`: 13 etapas presentes y en orden aunque falten proyectos; conteo y suma por
  etapa; `estimatedValue` null suma 0; asignación de grupo correcta por etapa.
- `dashboardTotals`: `openCount`/`openValue` solo status "open" (excluye won/lost/paused/
  active_customer); null→0 en valor; `missingNextAction` y `overdueTasks` reusan las puras
  existentes y coinciden con ellas.
- `authRedirectTarget`: los tests existentes se actualizan a `/dashboard` (authed en /login).
- `lib/my-actions` (existentes): siguen verdes (la extracción no toca la lógica).
- Charts / página / MyActionsPanel: sin unit test (client/presentacional); gate = `npm run build`
  + `npm run lint` + suite completa `npm test -- --no-file-parallelism`.

## Entrega
- Rama `feat/dashboard-home`, merge `--no-ff` a `main` + push.
- **Sin migración** (no toca schema). `recharts` se agrega a `package.json` (Vercel lo instala en el
  build; no requiere paso de prod DB).
- Ledger en `.superpowers/sdd/progress.md`.
- Ejecución: subagent-driven-development (subagente fresco por task + review por task + review
  final de rama en opus).

## Gaps conocidos que quedan
- Reportes analíticos (§10.8: conversión, tiempo en etapa, actividad por usuario) → slice posterior.
- Projects por owner / "míos" → con el slice de usuarios/RLS.
- Tasa de cambio editable (USD sigue saliendo de la constante `MXN_PER_USD`) → slice de settings.
- Deuda de estilos ad-hoc en OTRAS superficies (no My Actions, que sí se alinea acá).
