# Spec: CRUD completo de Companies

**Fecha:** 2026-08-12
**Slice:** Companies — detalle, edición, archivar y restaurar
**Estado:** Aprobado (brainstorming)

## Objetivo

Que una empresa sea una entidad totalmente gestionable: ver su detalle, editar
todos sus campos de negocio, archivarla (con confirmación) y restaurarla. Es el
siguiente slice vertical sobre el walking skeleton, que hoy solo tiene
list + create de Companies.

## Contexto de partida (ya existe, no re-construir)

- Tabla `companies` con schema rico: `name` (notNull), `legalName`, `industry`,
  `companyType`, `website`, `taxId`, `headquartersLocation`, `sizeSegment`,
  `notes`, `ownerUserId`, `archivedAt`, `createdAt`, `updatedAt`. RLS enabled,
  sin policies (deny-all en REST; la app escribe vía Drizzle como rol `postgres`).
- `listCompanies(db)` ya filtra `archivedAt IS NULL` y ordena por `createdAt desc`.
- `createCompany(db, { name })`, `companyCreateSchema` (solo `name`).
- UI: `/companies` con `NewCompanyForm` + `CompanyTable` (TanStack Table v8).
- Tests: Vitest + PGlite in-process (`test/db.ts` provee el harness `AnyDb`).

## Decisiones de diseño

- **Superficie de edición:** página de detalle en ruta dinámica
  `/companies/[id]`. Escala para alojar después Contacts/Projects relacionados.
- **Campos editables:** los 9 de negocio (`name` obligatorio + los otros 8),
  todos como inputs de texto / textarea. Sin selects/enums (YAGNI).
- **Archivar:** soft-delete escribiendo `archivedAt`. Se archiva desde el
  detalle (con confirmación). La lista tiene un toggle "Ver archivadas" que
  muestra las archivadas con opción "Restaurar".
- **`updated_at` auto-bump:** vía Drizzle `$onUpdate(() => new Date())` en la
  columna. Funciona in-process, testeable con PGlite, sin trigger de Postgres
  (la app solo escribe vía Drizzle).

## Componentes

### 1. Capa de datos — `db/companies.ts`

Funciones puras sobre `AnyDb`, cada una testeada con PGlite (TDD):

- `getCompany(db, id): Promise<Company | undefined>` — busca por id.
- `updateCompany(db, id, fields): Promise<Company>` — actualiza los 9 campos de
  negocio y devuelve la fila; `updatedAt` se bumpea solo por `$onUpdate`.
- `archiveCompany(db, id): Promise<Company>` — set `archivedAt = now()`.
- `restoreCompany(db, id): Promise<Company>` — set `archivedAt = null`.
- `listCompanies(db, opts?: { includeArchived?: boolean }): Promise<Company[]>` —
  parámetro opcional. Por defecto (`includeArchived` falsy) mantiene el
  comportamiento actual: solo no-archivadas. Con `includeArchived: true` lista
  solo las archivadas (para el modo toggle). Orden `createdAt desc` en ambos.

> Nota: la firma existente `listCompanies(db)` sigue funcionando (segundo
> argumento opcional), así que la llamada actual de `page.tsx` no se rompe.

### 2. Schema — `db/schema.ts`

- Añadir `.$onUpdate(() => new Date())` a la definición de `updatedAt`. Sin
  cambio de estructura de la tabla, sin migración nueva.

### 3. Validación — `lib/validation.ts`

- `companyUpdateSchema`: objeto Zod donde
  - `name`: `z.string().trim().min(1, "El nombre es obligatorio")`
  - los otros 8 (`legalName`, `industry`, `companyType`, `website`, `taxId`,
    `headquartersLocation`, `sizeSegment`, `notes`): opcionales; string vacío o
    solo-espacios se normaliza a `null` (no guardar `""`).
- Exporta `CompanyUpdateInput`.
- Sin validación de formato de URL / tax id (YAGNI).

### 4. Rutas y Server Actions

- **`app/companies/[id]/page.tsx`** — Server Component. `getCompany(db, id)`;
  si `undefined` → `notFound()`. Renderiza detalle + form de edición + botón
  Archivar (o Restaurar si `archivedAt` no es null). `dynamic = "force-dynamic"`.
- **`app/companies/[id]/actions.ts`** — `"use server"`, mismo patrón
  `ActionResult = { ok: true } | { ok: false; error: string }`:
  - `updateCompanyAction(prev, formData)` — parsea con `companyUpdateSchema`,
    `updateCompany`, `revalidatePath("/companies")` y `revalidatePath` del
    detalle. Devuelve `ActionResult`.
  - `archiveCompanyAction(formData)` / `restoreCompanyAction(formData)` — toman
    el `id` del formData, ejecutan, revalidan y `redirect("/companies")`.

### 5. UI

- **Lista (`/companies`)**:
  - El nombre de cada fila es un link a `/companies/[id]`.
  - Toggle "Ver archivadas" mediante query param `?archived=1`. `page.tsx` lee
    `searchParams` y llama `listCompanies(db, { includeArchived: true })` en ese
    modo. En modo archivadas, cada fila ofrece "Restaurar".
- **Detalle (`/companies/[id]`)**:
  - Form (client component) con los 9 campos: `name` input required, el resto
    inputs de texto y `notes` como textarea. Botón "Guardar cambios" con estado
    pending (patrón `useActionState`, igual que `NewCompanyForm`).
  - Botón "Archivar" con confirmación (o "Restaurar" si ya está archivada),
    como `form action`.
  - Link "← Empresas" de regreso a la lista.
  - Reutiliza tokens existentes (`font-display`, `tracking-display`,
    `col-label`, etc.).

### 6. Tests (Vitest + PGlite, TDD — test primero)

- **Data layer** (`test/companies.test.ts`):
  - `getCompany`: hit devuelve la fila; miss devuelve `undefined`.
  - `updateCompany`: cambia los campos indicados y bumpea `updatedAt`
    (assert `updatedAt` posterior al `createdAt` / al valor previo).
  - `archiveCompany` / `restoreCompany`: setean y limpian `archivedAt`.
  - `listCompanies` con y sin `includeArchived`: filtrado correcto en cada modo.
- **Validación** (`test/validation.test.ts`):
  - `companyUpdateSchema`: `name` requerido; opcionales aceptan valor; string
    vacío/espacios → `null`.
- **Glue** (pendiente diferido que se cierra aquí): test unitario de
  `createCompanyAction` — extracción de `FormData` y catch de error de DB.
  (Se testea la lógica de la action con un `db` inyectable o mock según lo que
  permita el patrón actual; si la action importa `db` directo, se refactoriza
  mínimamente para inyectarlo.)

## Fuera de alcance (explícito)

- Selects/enums para `companyType` / `sizeSegment`.
- Validación de formato de URL o tax id.
- Borrado duro (hard delete).
- Edición inline en la tabla.
- Acción de archivar desde la fila de la lista (archivar solo desde detalle;
  restaurar sí desde la fila en modo archivadas).
- Roles / ownership por-usuario y policies RLS (siguen pendientes, otro slice).

## Definición de Hecho (DoD)

- Abrir una empresa desde la lista muestra su detalle con todos los campos.
- Editar y guardar persiste los cambios y bumpea `updatedAt`.
- Archivar (con confirmación) la saca de la lista por defecto.
- "Ver archivadas" la muestra; "Restaurar" la regresa a la lista activa.
- Todos los tests (nuevos y existentes) en verde; lint, typecheck y build ok.
