# Spec: Contacts (columna vertebral relacional)

**Fecha:** 2026-08-12
**Slice:** Contacts anidados en Company (crear + listar + archivar/restaurar)
**Estado:** Aprobado (brainstorming)

## Objetivo

Estrenar el patrón relacional del CRM. Un contacto pertenece a exactamente una
empresa; se crean, listan y archivan/restauran desde la página de detalle de la
empresa. Es el primer slice que introduce una foreign key y un listado anidado.

## Contexto de partida (ya existe)

- `companies` con CRUD completo; detalle en `/companies/[id]` (`app/companies/[id]/page.tsx`).
- Patrones establecidos: data layer puro sobre `AnyDb` (PGlite en tests), Zod
  con `preprocess` vacío→null, glue puro testeable (`runCreate*`/`runUpdate*`) +
  server actions delgadas que revalidan, `$onUpdate` en `updatedAt`, tipos
  honestos `Promise<T | undefined>` en updates, validación UUID en actions que
  redirigen, RLS enabled sin policies (deny-all; app escribe vía Drizzle).

## Decisiones (del brainstorming)

- Entidad: **Contacts** primero (antes que Projects).
- Relación: un contacto pertenece a **una** empresa; `companyId` **NOT NULL**.
- UI: gestionados **anidados** en el detalle de la empresa (sin página top-level
  `/contacts`).
- Alcance: **crear + listar + archivar/restaurar** (editar diferido).
- Campos: `name` (obligatorio) + `email`, `phone`, `role` (puesto), `notes`
  (opcionales), todos texto, vacío→null, **sin validación de formato de email**.
- Orden de listado: `createdAt desc` (consistente con companies).
- `ownerUserId` incluido (nullable) por paridad y futura RLS.

## Componentes

### 1. Schema — nueva tabla `contacts` (`db/schema.ts`)

Columnas:
- `id` uuid pk defaultRandom
- `companyId` uuid **notNull**, `.references(() => companies.id)`
- `name` text notNull
- `email`, `phone`, `role`, `notes` text (nullable)
- `ownerUserId` uuid (nullable)
- `archivedAt` timestamptz (nullable)
- `createdAt` timestamptz notNull defaultNow
- `updatedAt` timestamptz notNull defaultNow `.$onUpdate(() => new Date())`

Índices: `contacts_company_id_idx` en `companyId`, `contacts_archived_at_idx`
en `archivedAt`. `.enableRLS()` (sin policies).

Tipos: `Contact = typeof contacts.$inferSelect`, `NewContact = $inferInsert`.

**Migración nueva:** generar con `npm run db:generate` (drizzle-kit, offline),
commitear el SQL. Los tests la aplican vía el migrator de PGlite
(`test/db.ts` corre `migrate(..., { migrationsFolder: "db/migrations" })`).

### 2. Data layer (`db/contacts.ts`)

Funciones puras sobre `AnyDb` (TDD):
- `createContact(db, input: { companyId: string; name: string; email: string | null; phone: string | null; role: string | null; notes: string | null }): Promise<Contact>`
- `listContacts(db, companyId: string, opts?: { archived?: boolean }): Promise<Contact[]>`
  — `where companyId = ? AND (archived ? archivedAt IS NOT NULL : archivedAt IS NULL)`, `order by createdAt desc`.
- `archiveContact(db, id: string): Promise<Contact | undefined>` — set `archivedAt = now()`.
- `restoreContact(db, id: string): Promise<Contact | undefined>` — set `archivedAt = null`.

### 3. Validación (`lib/validation.ts`)

`contactCreateSchema`:
- `name`: preprocess (non-string→"") + `z.string().min(1, "El nombre es obligatorio")`.
- `email`, `phone`, `role`, `notes`: `optionalText` (reusa el helper existente; vacío/espacios→null).
- `companyId`: `z.string().uuid()` (mensaje: "Empresa inválida").

Exporta `type ContactCreateInput = z.infer<typeof contactCreateSchema>`.
Sin validación de formato de email (YAGNI).

### 4. Glue + server actions

Glue puro en **`lib/contact-mutations.ts`** (módulo plano, NO "use server"),
reutiliza el tipo `ActionResult` de `@/lib/company-mutations`:
- `runCreateContact(db, formData): Promise<ActionResult>` — parsea con
  `contactCreateSchema` (incluye `companyId`), `createContact`, catch→
  "No se pudo crear el contacto".

Server actions en **`app/companies/[id]/contacts/actions.ts`** (`"use server"`):
- `createContactAction(prev, formData): Promise<ActionResult>` — `runCreateContact`,
  y en éxito `revalidatePath("/companies/<companyId>")` (companyId leído del form).
- `archiveContactAction(formData): Promise<void>` — valida UUID del `id`,
  `archiveContact`, revalida el detalle, `redirect` de vuelta al detalle de la
  empresa (companyId del form).
- `restoreContactAction(formData): Promise<void>` — análoga.

> Los redirects de archive/restore vuelven a `/companies/<companyId>` (no a
> `/companies`), leyendo `companyId` del formData; si falta/ inválido, redirige a
> `/companies`.

### 5. UI — sección "Contactos" en el detalle de empresa

En `app/companies/[id]/page.tsx` (pasa a leer `searchParams`):
- Nueva sección debajo del form de la empresa con encabezado "Contactos".
- Toggle **Activos / Archivados** vía `?contactsArchived=1` (dos links, como el
  toggle de companies).
- `listContacts(db, company.id, { archived: showArchivedContacts })`.
- Componente cliente `NewContactForm` (`components/new-contact-form.tsx`):
  `useActionState` sobre `createContactAction`, hidden `companyId`, input `name`
  (required) + email/phone/role + textarea notes; se resetea en éxito (patrón de
  `NewCompanyForm`). Solo visible en modo Activos.
- Componente cliente `ContactTable` (`components/contact-table.tsx`): columnas
  name, email (— si null), teléfono, puesto; en modo activos, **Archivar** por
  fila; en modo archivados, **Restaurar** por fila. Empty-state en español.
  (Puede ser TanStack Table como `CompanyTable`, o una tabla simple — seguir el
  patrón de `CompanyTable`.)

### 6. Tests (TDD, Vitest + PGlite)

- Data layer (`test/contacts.test.ts`): createContact liga companyId; listContacts
  filtra por empresa (no trae contactos de otra) y por archived; ordering
  createdAt desc; archive/restore setean/limpian archivedAt; archive de id
  inexistente → undefined.
- Validación (`test/validation.test.ts`): contactCreateSchema — name requerido,
  opcionales vacío→null, companyId no-UUID → error.
- Glue (`test/contact-mutations.test.ts`): runCreateContact — válido persiste;
  name faltante → error español; companyId inválido → error; insert throws →
  "No se pudo crear el contacto".

## Definición de Hecho (DoD)

- En el detalle de una empresa, agregar un contacto lo persiste y aparece en la
  lista de esa empresa (y no en la de otra).
- Archivar un contacto lo saca de la vista Activos; el toggle Archivados lo
  muestra; Restaurar lo regresa.
- Suite verde; tsc/lint/build limpios.

## Fuera de alcance

Editar contacto, página top-level `/contacts`, validación de formato de
email/teléfono, borrado duro, roles/RLS por-usuario, Projects.

## Dependencia del usuario

Aplicar la migración nueva a Supabase (`npm run db:migrate` con `DIRECT_URL`)
para que la feature funcione en prod (Vercel no corre migraciones). La generación
del SQL es offline y va en el repo; la aplicación a la DB de prod la hace el
usuario (o Claude con confirmación explícita).
