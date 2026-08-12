# Diseño — Projects P1 (CRUD)

Fecha: 2026-08-12
Estado: aprobado, pendiente de plan
PRD de referencia: `docs/mexillum-crm-prd-final.md` (§7.3 Project, §8 Pipeline, §10.3, §11.4)

## Contexto

`Project` es el corazón del CRM de Mexillum (una planta/instalación dentro del pipeline
comercial). El PRD lo acopla a entidades que **todavía no existen** (Activity, Task,
ProjectContact, Diagnostic) y a una UI Kanban sustancial. Por eso el arco "Projects" se
descompone en slices; **este spec cubre solo P1**.

Descomposición acordada del arco:

| Slice | Contenido | Depende de |
|---|---|---|
| **P1 (este)** | tabla `projects` + CRUD (crear/listar/editar/archivar), cambio de etapa por selector, UI table-first | nada |
| P2 | Activities + timeline; el cambio de etapa registra `stage_change` | P1 |
| P3 | Tasks + Next Action derivada | P1 |
| P4 | Pipeline Kanban (Opción C), drag+selector | P1, P2 |
| luego | ProjectContacts N:M, datos técnicos + checklist/gate, documentos, reportes, FX MXN/USD, audit log | varios |

## Alcance de P1

Crear, listar, editar y archivar/restaurar `Project`, siempre asociado a una Company.
Creación **company-scoped** (desde el detalle de empresa, empresa ya fijada). Página de
detalle propia `/projects/[id]` para editar todos los campos. Lista top-level `/projects`
(read-only, navega al detalle). `stage_group` derivado de `stage` por función pura.
`status` editable a mano.

## Fuera de alcance de P1 (diferido)

- Kanban / drag entre grupos (P4). En P1 la etapa se cambia por `<select>`.
- Registro de `stage_change` como Activity (P2) — Activities no existe aún.
- Transiciones automáticas de `status` (won al firmar contrato, active_customer en
  cliente activo, §8.4) — entrelazadas con stage_change/reglas §8.3 → P2/P4.
- Next Action / alerta "sin next action" (P3 — Tasks no existe).
- Gate de datos técnicos a "Propuesta en preparación" (§8.3) — datos técnicos no existe.
- `solution_type_engine`, `diagnostic_id`, `last_interaction_at` (Fase 2 / derivan de
  otras entidades) — no se crean las columnas todavía.
- Alta de Project desde `/projects` con selector de empresa; owner reasignable; columna
  "owner" en tablas (requiere gestión de usuarios). `owner_user_id` **se guarda** al crear,
  no se muestra ni se reasigna en P1.
- FX MXN/USD; el valor se guarda y muestra en MXN.

## Modelo de datos — tabla `projects`

Columnas (Drizzle; agregar `integer` y `date` a los imports de `drizzle-orm/pg-core`):

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | no | `defaultRandom()` | PK |
| `company_id` | uuid | no | — | FK → `companies.id` |
| `name` | text | no | — | |
| `owner_user_id` | uuid | sí | — | se setea al usuario actual al crear; no editable en P1 |
| `plant_name` | text | sí | — | |
| `location_address` | text | sí | — | |
| `city` | text | sí | — | |
| `state` | text | sí | — | |
| `country` | text | sí | — | |
| `industry_subsegment` | text | sí | — | |
| `stage` | text | no | `'lead_sin_contactar'` | union 13 valores |
| `stage_group` | text | no | `'lead'` | derivado de `stage`, denormalizado; nunca editable a mano |
| `status` | text | no | `'open'` | union 5 valores |
| `solution_type` | text | no | `'unknown'` | union 4 valores |
| `estimated_value` | integer | sí | — | MXN en pesos enteros (≥0) |
| `probability` | integer | sí | — | 0–100 |
| `expected_close_date` | date | sí | — | `date("expected_close_date", { mode: "string" })` (YYYY-MM-DD) |
| `source` | text | sí | — | union 5 valores |
| `lost_reason` | text | sí | — | union 7 valores; requerido si `status='lost'` |
| `lost_reason_note` | text | sí | — | |
| `notes` | text | sí | — | |
| `archived_at` | timestamptz | sí | — | |
| `created_at` | timestamptz | no | `defaultNow()` | |
| `updated_at` | timestamptz | no | `defaultNow()` + `$onUpdate(() => new Date())` | |

Índices: `company_id`, `archived_at`, `stage_group` (mismo patrón que `contacts`).
RLS: `ENABLE ROW LEVEL SECURITY` sin policies (postura deliberada del proyecto; deny-all en
la REST API, Drizzle bypassa como rol `postgres`). La generación de migración de Drizzle ya
emite el `ENABLE ROW LEVEL SECURITY` (como en `contacts`/0002).

Tipos: `Project = typeof projects.$inferSelect`, `NewProject = typeof projects.$inferInsert`.

## Enums (columnas text + Zod union) y labels

Los valores viven como constantes en `lib/project-pipeline.ts` con label en español para la UI.

**`stage` (13):**

| slug | label |
|---|---|
| `lead_sin_contactar` | Lead / sin contactar |
| `outreach_enviado` | Outreach enviado |
| `respondio_interesado` | Respondió / interesado |
| `diagnostico_web` | Diagnóstico web |
| `webcall_discovery` | Webcall / discovery |
| `propuesta_preparacion` | Propuesta en preparación |
| `propuesta_enviada` | Propuesta enviada |
| `negociacion_objeciones` | Negociación / objeciones |
| `propuesta_aceptada` | Propuesta aceptada |
| `contrato_enviado` | Contrato enviado |
| `contrato_firmado` | Contrato firmado |
| `onboarding_kickoff` | Onboarding / kickoff |
| `cliente_activo` | Cliente activo |

**`stage_group` (6) y mapeo `stageGroupFor(stage)` (§8.2):**

| grupo (slug) | label | etapas incluidas |
|---|---|---|
| `lead` | Lead | lead_sin_contactar |
| `qualification` | Qualification | outreach_enviado, respondio_interesado |
| `solution` | Solution | diagnostico_web, webcall_discovery, propuesta_preparacion |
| `commercial` | Commercial | propuesta_enviada, negociacion_objeciones, propuesta_aceptada |
| `delivery` | Delivery | contrato_enviado, contrato_firmado, onboarding_kickoff |
| `active` | Active | cliente_activo |

**`status` (5):** `open` Abierto · `won` Ganado · `lost` Perdido · `paused` Pausado ·
`active_customer` Cliente activo.

**`solution_type` (4):** `solar` Solar · `bess` BESS · `solar_bess` Solar + BESS ·
`unknown` Sin definir.

**`source` (5):** `diagnostico_web` Diagnóstico web · `referido` Referido ·
`outbound` Outbound · `intermepro` Intermepro · `otro` Otro.

**`lost_reason` (7):** `precio` Precio · `timing` Timing · `competencia` Competencia ·
`sin_presupuesto` Sin presupuesto · `sin_respuesta` Sin respuesta ·
`no_viable_tecnico` No viable técnico · `otro` Otro.

## Validación (`lib/validation.ts`)

Helpers existentes reutilizados: `optionalText` (vacío/no-string → null). Se agregan dos
helpers locales: un enum Zod desde un array de slugs, y un entero opcional (vacío→null).

**`projectCreateSchema`** (campos del form de alta — subconjunto):
- `companyId`: `z.string().uuid("Empresa inválida")`
- `name`: preprocess trim + `min(1, "El nombre es obligatorio")`
- `solutionType`: enum de las 4, default `'unknown'` (si vacío → `'unknown'`)
- `stage`: enum de las 13, default `'lead_sin_contactar'`
- `estimatedValue`: entero opcional ≥0 (vacío→null)
- `notes`: `optionalText`

**`projectUpdateSchema`** (todos los campos editables):
- `name`: requerido (igual que create)
- `plantName`, `locationAddress`, `city`, `state`, `country`, `industrySubsegment`,
  `lostReasonNote`, `notes`: `optionalText`
- `stage`: enum 13 (requerido)
- `status`: enum 5 (requerido)
- `solutionType`: enum 4 (requerido)
- `estimatedValue`: entero opcional ≥0
- `probability`: entero opcional 0–100
- `expectedCloseDate`: string fecha opcional (vacío→null; validar formato `YYYY-MM-DD`)
- `source`: enum 5 opcional (vacío→null)
- `lostReason`: enum 7 opcional (vacío→null)
- **refine**: si `status === 'lost'` ⇒ `lostReason` no nulo, si no error
  `"Falta el motivo de pérdida"`.

`stage_group` **no** está en los schemas: lo deriva el glue con `stageGroupFor(stage)`.

## Arquitectura (capas — mirroring de companies/contacts)

**`db/schema.ts`** — tabla `projects` + tipos + índices (arriba).

**`lib/project-pipeline.ts`** (nuevo, puro/testeable — patrón `auth-redirect`):
- Constantes: `STAGES`, `STAGE_GROUPS`, `STATUSES`, `SOLUTION_TYPES`, `SOURCES`,
  `LOST_REASONS` (arrays de `{ value, label }`), y arrays de slugs para los enums Zod.
- `stageGroupFor(stage: string): StageGroup` — mapa etapa→grupo (las 13).
- Tipos union derivados (`Stage`, `StageGroup`, `Status`, `SolutionType`, `Source`,
  `LostReason`).

**`db/projects.ts`** (nuevo):
- `createProject(db, input: NewProjectInput): Promise<Project>` — inserta y retorna la fila.
  `NewProjectInput` incluye `companyId`, `name`, `ownerUserId`, `stage`, `stageGroup`,
  `status`, `solutionType`, `estimatedValue`, `notes` (los del alta) — el resto usa defaults.
- `listProjects(db, companyId, { archived }): Promise<Project[]>` — por company + filtro
  archived, orden `desc(createdAt)`.
- `listAllProjects(db, { archived }): Promise<ProjectListRow[]>` — todos, con JOIN a
  `companies` para traer `companyName`; `ProjectListRow = Project & { companyName: string }`.
  Orden `desc(createdAt)`.
- `getProject(db, id): Promise<Project | undefined>`.
- `updateProject(db, id, fields: ProjectUpdateFields): Promise<Project | undefined>` —
  `fields` incluye todas las columnas editables **+ `stageGroup`** (derivado); no toca
  `companyId`, `ownerUserId`, `createdAt`.
- `archiveProject(db, id)` / `restoreProject(db, id): Promise<Project | undefined>`.

**`lib/project-mutations.ts`** (nuevo, glue puro):
- `runCreateProject(db, formData, ownerUserId: string | null): Promise<ActionResult>` —
  parsea con `projectCreateSchema`; deriva `stageGroup = stageGroupFor(parsed.stage)`;
  arma el `NewProjectInput` (incluye `ownerUserId`, `status: 'open'`); llama `createProject`;
  mapea errores. `ActionResult` desde `@/lib/company-mutations`.
- `runUpdateProject(db, formData): Promise<ActionResult>` — lee `id` (guard si falta);
  parsea con `projectUpdateSchema`; deriva `stageGroup`; llama `updateProject`;
  `undefined`→"No se encontró el proyecto"; catch→"No se pudo actualizar el proyecto".

**`app/projects/actions.ts`** (nuevo, `"use server"`, actions delgadas):
- `createProjectAction(_prev, formData)` — obtiene el usuario actual vía
  `createClient()` de `@/lib/supabase/server` (`supabase.auth.getUser()` → `user?.id ?? null`);
  llama `runCreateProject(db, formData, ownerUserId)`; en éxito revalida
  `/projects` y `/companies/{companyId}` (companyId parseado con `idSchema` del formData).
- `updateProjectAction(_prev, formData)` — `runUpdateProject`; en éxito revalida
  `/projects`, `/projects/{id}` y `/companies/{companyId}`.
- `archiveProjectAction(formData)` / `restoreProjectAction(formData)` — uuid-validan `id`,
  archivan/restauran, revalidan y `redirect` a `/projects/{id}` (mismo patrón que company).

**UI:**
- `components/new-project-form.tsx` (client) — `useActionState(createProjectAction)`; hidden
  `companyId`; campos: `name` (req), `solutionType` (`<select>`), `stage` (`<select>` default
  lead), `estimatedValue` (number), `notes` (textarea). Reset + `router.refresh()` en éxito.
- `components/project-table.tsx` (client, tanstack) — prop `data: ProjectListRow[]` (o
  `Project[]`), `archived`, `showCompany?`. Columnas: nombre (link `/projects/[id]`),
  [empresa si `showCompany`], etapa (label), status (label), solución (label),
  `estimatedValue` (formato MXN vía `Intl.NumberFormat('es-MX', currency MXN, 0 decimales)`).
  Sin columna de acciones (archivar vive en el detalle, como company).
- `components/project-detail-form.tsx` (client) — `useActionState(updateProjectAction)`;
  hidden `id` + `companyId`; inputs/selects de todos los campos; `stage_group` mostrado
  read-only al lado de `stage`; `router.refresh()` en éxito. Guard de éxito con `useRef`
  (patrón adoptado en `ContactEditForm`).
- `components/project-archive-button.tsx` (client) — espejo de `CompanyArchiveButton`
  (archivar/restaurar con `window.confirm`).
- `app/projects/page.tsx` (server, `force-dynamic`) — `listAllProjects({archived})`, toggle
  Activas/Archivadas (`?archived=1`), `ProjectTable showCompany`. Link a `/companies`.
- `app/projects/[id]/page.tsx` (server, `force-dynamic`) — `getProject`; `notFound()` si no
  existe; `getCompany` para el nombre/back-link; heading + `ProjectArchiveButton` +
  `ProjectDetailForm`; link "← {company.name}" a `/companies/{companyId}`.
- `app/companies/[id]/page.tsx` (modificar) — agregar sección "Proyectos" (espejo de
  "Contactos"): `listProjects(companyId, {archived})` con toggle `?projectsArchived=1`,
  `NewProjectForm` (companyId fijo) en vista activa, `ProjectTable showCompany={false}`.
- Cross-link mínimo: en `/companies` un link a "Proyectos" y en `/projects` uno a "Empresas".
  Nav global unificada diferida.

## Testing (TDD — tests primero; UI sin tests)

- `test/project-pipeline.test.ts`:
  - `stageGroupFor` mapea las 13 etapas a su grupo correcto (exhaustivo, un assert por etapa).
- `test/projects.test.ts` (data layer, PGlite):
  - `createProject` inserta con link a company y retorna la fila con defaults esperados.
  - `listProjects` filtra por company y por archived; orden por createdAt desc.
  - `listAllProjects` retorna todos con `companyName`; filtra archived.
  - `getProject` retorna la fila / `undefined`.
  - `updateProject` actualiza campos y retorna la fila; `undefined` para id inexistente;
    `updatedAt` avanza.
  - `archiveProject`/`restoreProject` togglean `archivedAt`.
- `test/project-mutations.test.ts` (glue, PGlite):
  - `runCreateProject`: válido persiste (con `ownerUserId` dado) y deriva `stage_group`
    correcto; `name` vacío → error; `companyId` no-uuid → "Empresa inválida"; defaults
    (`status='open'`, `stage='lead_sin_contactar'`, `stage_group='lead'`).
  - `runUpdateProject`: válido; falta `id` → error; cambiar `stage` re-deriva `stage_group`;
    `status='lost'` sin `lostReason` → "Falta el motivo de pérdida"; con `lostReason` → ok;
    id inexistente → "No se encontró el proyecto".
- Los schemas quedan cubiertos vía los tests de mutations (igual que en companies/contacts).

## Migración + deploy

- `npm run db:generate` (offline) genera `db/migrations/0003_*.sql` (nueva tabla `projects`,
  FK, índices, ENABLE RLS) — va al repo.
- Tras merge+push, aplicar a Supabase prod con `npm run db:migrate` (DIRECT_URL de
  `.env.local`); Vercel no corre migraciones. Paso del usuario, o de Claude con OK explícito.

## Notas

- La brecha de ownership/pertenencia (update por `id` sin verificar company/owner) sigue el
  patrón existente y se cierra con el slice de RLS.
- Primeros `<select>` de la app: usar `<select>` nativo con `defaultValue`, sin dependencias.
