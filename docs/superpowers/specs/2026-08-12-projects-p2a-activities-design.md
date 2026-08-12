# Projects P2a — Activities (espinazo): Design

**Fecha:** 2026-08-12
**Slice:** Projects P2a (primer sub-slice de P2 — Activities + timeline)
**PRD ancla:** §7.4 (entidad Activity), §8.3 (reglas de etapa), §10.4 (requerimientos de Activities), §11.5 (Activity Timeline)

## Contexto

P1 dejó la entidad `Project` con CRUD completo: `stage`/`stage_group`/`status` son
editables, pero **cambiar la etapa hoy no deja rastro**. P2a cierra ese hueco:
convierte la edición de etapa en un evento auditable e introduce la timeline de
Activities, que es la base de reportes (§10.8), del Kanban P4 (arrastrar dispara
`stage_change`) y da contexto a Tasks P3.

P2 completo es grande (12 tipos de Activity, generación automática, momentos
comerciales, automatización de `status`). Se descompone; **este spec cubre solo el
espinazo (P2a)**.

### Alcance de P2a (decidido en brainstorming)

- **Slice:** Activities + timeline (Opción A del arco Projects).
- **Profundidad:** espinazo. Timeline + nota manual + `stage_change` automático.
- **Eventos automáticos:** `stage_change` (al cambiar etapa) **+** `system` (al crear
  Project). NO momentos comerciales (P2b).
- **Mutación:** append-only. Ni notas ni eventos de sistema se editan o borran.
  Honra el principio de inmutabilidad de §7.4.
- **Display de autor:** diferido (no hay tabla de perfiles todavía). La timeline
  muestra timestamp + tipo, no nombre de autor.
- **Filtro por tipo:** query param SSR (`?activityType=`), recarga; no client-side.

## 1. Modelo de datos — tabla `activities` (migración 0004)

Subconjunto forward-compatible de §7.4. Mismo criterio que P1: se difieren los campos
que dependen de otras entidades o de Fase 2.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK defaultRandom | |
| `company_id` | uuid NOT NULL → companies | denormalizado (timeline a nivel empresa futura) |
| `project_id` | uuid NOT NULL → projects | P2a es project-scoped |
| `user_id` | uuid (nullable) | actor; de `supabase.auth.getUser()` |
| `type` | text NOT NULL | union 12 valores §7.4; P2a usa `note`/`stage_change`/`system` |
| `direction` | text (nullable) | union `inbound`/`outbound`/`internal`/`none` |
| `subject` | text (nullable) | forward-compat; P2a lo deja null |
| `body` | text (nullable) | contenido de la nota manual |
| `occurred_at` | timestamptz NOT NULL defaultNow | eje de la timeline |
| `source` | text NOT NULL | union `manual`/`diagnostic_engine`/`gmail`/`calendar`/`system` |
| `metadata` | jsonb (nullable) | `stage_change`: `{ fromStage, toStage, fromGroup, toGroup }` |
| `created_at` | timestamptz NOT NULL defaultNow | |
| `updated_at` | timestamptz NOT NULL defaultNow `$onUpdate` | |

**Índices:** `activities_project_id_idx` on `(project_id)`,
`activities_project_id_occurred_at_idx` on `(project_id, occurred_at)`,
`activities_company_id_idx` on `(company_id)`.

**RLS:** `.enableRLS()` en el schema → genera `ALTER TABLE ... ENABLE ROW LEVEL
SECURITY` (deny-all en la REST API), consistente con companies/contacts/projects.
Drizzle se conecta como rol `postgres` y bypassa RLS. Policies por-usuario diferidas
al slice de RLS.

**Enums = columnas `text` + Zod union** (patrón establecido, NO pgEnum).

**Diferidos** (dependen de otras entidades/Fase 2, no en esta tabla todavía):
`contact_id` (ProjectContacts §7.5), `due_at`/`completed_at` (son de Tasks §10.5),
`external_id` (Fase 2).

Schema añade el import `jsonb` a `db/schema.ts` y exporta `Activity` / `NewActivity`.

## 2. Enums + helpers puros — nuevo `lib/activity-log.ts`

Mismo formato que `lib/project-pipeline.ts` (constantes `Option[]` con label español +
`*_VALUES` + funciones puras).

- `ACTIVITY_TYPES`: 12 valores (`email`, `call`, `meeting`, `whatsapp`, `note`,
  `task`, `diagnostic`, `document`, `stage_change`, `proposal`, `contract`, `system`)
  con label español. `ACTIVITY_TYPE_VALUES`.
- `ACTIVITY_DIRECTIONS` (`inbound`/`outbound`/`internal`/`none`) + `..._VALUES`.
- `ACTIVITY_SOURCES` (`manual`/`diagnostic_engine`/`gmail`/`calendar`/`system`) +
  `..._VALUES`.

Funciones puras (testeables):

- `stageChangeMetadata(fromStage: string, toStage: string)` →
  `{ fromStage, toStage, fromGroup: stageGroupFor(fromStage), toGroup: stageGroupFor(toStage) }`.
- `describeStageChange(metadata)` → `"Lead / sin contactar → Outreach enviado"`
  usando `labelOf(STAGES, ...)`.
- `activityTitle(activity)` → headline por tipo (`stage_change` → "Etapa: X → Y",
  `system` → "Proyecto creado", `note` → "Nota").
- `formatDateTime(date)` → formato es-MX (fecha + hora).

## 3. Capa de datos — nuevo `db/activities.ts` (puro sobre `AnyDb`)

```ts
export type NewActivityInput = {
  companyId: string;
  projectId: string;
  userId: string | null;
  type: string;
  direction: string | null;
  subject: string | null;
  body: string | null;
  occurredAt?: Date;            // default now vía columna
  source: string;
  metadata: unknown | null;     // jsonb
};

createActivity(db, input): Promise<Activity>
listActivitiesForProject(db, projectId, opts?: { type?: string }): Promise<Activity[]>
  // orden: occurred_at desc, created_at desc; filtro opcional por type
```

**Sin** `updateActivity` / `deleteActivity` → inmutabilidad estructural (append-only).

## 4. Glue — registrar eventos en transacción (`lib/`)

Los writes compuestos van en `db.transaction(...)` (soportado por PGlite y postgres-js)
para que un insert de Activity fallido revierta el cambio del project, y un update
fallido no registre nada.

- **`runCreateProject(db, formData, ownerUserId)`** (firma sin cambios): dentro de una
  transacción, crea el project **+** inserta Activity `system` ("Proyecto creado")
  con `companyId = input.companyId`, `projectId = created.id`, `userId = ownerUserId`,
  `source = system`, `direction = none`.
- **`runUpdateProject(db, formData, actorUserId)`** (**nueva firma**, agrega
  `actorUserId`): transacción → `getProject` (captura stage previo) → `updateProject`
  → si `oldStage !== newStage`, inserta Activity `stage_change` inmutable con
  `metadata = stageChangeMetadata(old, new)`, `userId = actorUserId`, `source = system`,
  `direction = none`. Sin cambio de etapa → 0 activities. Cambio de otro campo → 0.
- **`runCreateNote(db, formData, actorUserId)`** (**nuevo**): valida `body` con
  `noteCreateSchema` (nuevo en `validation.ts`), resuelve `company_id` **desde el
  project** (`getProject`, no confía en el cliente), inserta `type=note`,
  `direction=internal`, `source=manual`, `occurred_at=now`, `userId=actorUserId`.
  Devuelve `ActionResult`. Rechaza si el project no existe o `body` vacío.

`noteCreateSchema` (en `lib/validation.ts`):

```ts
export const noteCreateSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  body: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "La nota no puede estar vacía")
  ),
});
```

## 5. Server actions (`app/projects/[id]/actions.ts`)

- **`updateProjectAction`**: agrega `supabase.auth.getUser()` y pasa `user?.id ?? null`
  como `actorUserId` a `runUpdateProject`.
- **`createNoteAction(prev, formData)`** (nuevo): `supabase.auth.getUser()` →
  `runCreateNote(db, formData, user?.id ?? null)` → en éxito
  `revalidatePath('/projects/[id]')` (con el `projectId` del formData validado como uuid).

`runCreateProject` ya recibía `ownerUserId` desde `createProjectAction` — sin cambios
en esa action salvo que el glue ahora también escribe la Activity.

## 6. UI en `/projects/[id]`

La página (`app/projects/[id]/page.tsx`) pasa a leer `searchParams` para el filtro y
carga `listActivitiesForProject(db, id, { type })`.

Nueva sección **"Actividad"** bajo `ProjectDetailForm`:

- **`NewNoteForm`** (client, patrón add-form de `NewContactForm`): textarea `body` +
  hidden `projectId` + submit; `useActionState(createNoteAction)`; en éxito resetea el
  textarea y `router.refresh()`.
- **Filtro por tipo**: `?activityType=` (patrón `?contactsArchived`). Componente client
  mínimo que hace push del query param al cambiar el `<select>` (opciones: "Todos" +
  los tipos presentes/relevantes). SSR lo lee de `searchParams`.
- **Timeline**: lista descendente. Por item: `formatDateTime(occurred_at)` + label del
  tipo + headline:
  - `stage_change` → "Etapa: {fromStage} → {toStage}" (`describeStageChange`)
  - `system` → "Proyecto creado"
  - `note` → `body`
  - Nombre de autor **diferido** (no hay perfiles); no se muestra.

## 7. Tests (Vitest + PGlite, TDD — test primero)

**Puros:**
- `stageChangeMetadata` arma `fromGroup`/`toGroup` con `stageGroupFor`.
- `describeStageChange` devuelve labels legibles.
- `noteCreateSchema` rechaza body vacío/whitespace, trimea, exige projectId uuid.

**Datos/glue (PGlite in-process):**
- `listActivitiesForProject` ordena `occurred_at desc` (tiebreak `created_at desc`),
  filtra por `type`, y scopea por `projectId` (no trae de otros projects).
- `runCreateProject` inserta exactamente 1 Activity `system` ligada al nuevo project
  (companyId/projectId/userId correctos).
- `runUpdateProject`:
  - cambiar `stage` → inserta exactamente 1 `stage_change` con metadata
    `{fromStage,toStage,fromGroup,toGroup}` y `userId = actor`.
  - dejar `stage` igual → 0 activities.
  - cambiar un campo no-stage (p.ej. `name`) → 0 activities.
  - rollback: si el insert de Activity falla, el update del project se revierte
    (simular con un `type`/constraint inválido o stub).
- `runCreateNote` resuelve `company_id` desde el project, setea type/direction/source,
  rechaza body vacío y project inexistente.

**Inmutabilidad:** estructural — `db/activities.ts` no exporta mutadores; no hay UI de
edición/borrado. (Se documenta; no requiere test de comportamiento.)

## 8. Migración + deploy

- `npm run db:generate` → migración `0004` con `CREATE TABLE activities` + `ENABLE ROW
  LEVEL SECURITY` + FKs + índices. Va al repo.
- Vercel NO corre migraciones. Aplicar a prod = paso post-merge del usuario, o de
  Claude con OK explícito:
  `set -a; . ./.env.local; set +a; npm run db:migrate`.

## 9. Postura de seguridad (sin cambios, intencional)

`activities` con RLS habilitada y **sin policies** (deny-all REST), igual que las otras
tablas. La app funciona porque Drizzle usa rol `postgres`. Los writes scopean por
`id`/`projectId` sin verificar owner/company — se cierra en el slice de RLS/ownership.

## Fuera de alcance (P2b+)

- Momentos comerciales `proposal`/`contract` (§8.3) + automatización de `status` §8.4
  (won al firmar, active_customer al activar).
- Tipos manuales tipados (email/call/meeting con `direction`/`subject`/`occurred_at`
  editable).
- Adjuntos/links (§10.6), comentarios internos.
- Display de autor (requiere tabla de perfiles).
- `contact_id` en Activity (ProjectContacts §7.5).
- Timeline a nivel empresa; eventos de archivado/restauración.
