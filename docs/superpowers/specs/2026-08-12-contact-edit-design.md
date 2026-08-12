# Diseño — Edición de contactos

Fecha: 2026-08-12
Estado: aprobado, pendiente de plan

## Contexto

El slice de contactos dejó la edición diferida: hoy se pueden crear, listar y
archivar/restaurar contactos anidados en el detalle de empresa, pero no editarlos.
Este slice cierra el CRUD de la entidad `contacts` agregando edición de sus 5 campos.

Multi-usuario no es inminente, así que la postura de seguridad (RLS + ownership) sigue
diferida al slice C. Este diseño **no** introduce scoping por `companyId` ni verificación
de pertenencia: espeja el patrón existente de `archiveContact`/`restoreContact`, que
actualizan solo por `id`. Cerrar la brecha de pertenencia es trabajo explícito del slice C.

## Alcance

Editar los 5 campos de un contacto **activo** desde la tabla anidada en el detalle de
empresa, vía expand inline de la fila:

- `name` — requerido
- `email`, `phone`, `role`, `notes` — opcionales (vacío → `null`)

Los contactos archivados no son editables: siguen mostrando solo "Restaurar", igual que hoy.

## Fuera de alcance

- Scoping por `companyId` / verificación de ownership → slice C (RLS).
- Edición de contactos archivados.
- Edición masiva.

## Arquitectura (espejo del patrón de company)

Las capas siguen los patrones ya establecidos: data layer puro sobre `AnyDb`, Zod con
`optionalText` (vacío→null), glue puro testeable (`runUpdate*`) + server action delgada
que revalida, tipos honestos `Promise<T | undefined>` en updates, `ActionResult` desde
`lib/company-mutations`.

### 1. Validación — `lib/validation.ts`

`contactUpdateSchema`:

- `name`: `preprocess` trim + `string().min(1, "El nombre es obligatorio")`
- `email`, `phone`, `role`, `notes`: `optionalText` (reusa el helper existente)

Sin `companyId` en el schema. El update va por `id`; `companyId` viaja como hidden field
solo para revalidar la ruta, igual que en `createContactAction`.

### 2. Data layer — `db/contacts.ts`

```
updateContact(db, id, fields): Promise<Contact | undefined>
```

`db.update(contacts).set(fields).where(eq(contacts.id, id)).returning()`, retorna la
primera fila o `undefined`. `updatedAt` lo maneja el `$onUpdate` del schema.

Tipo `ContactUpdateFields`: `{ name: string; email/phone/role/notes: string | null }`.

### 3. Glue puro — `lib/contact-mutations.ts`

```
runUpdateContact(db, formData): Promise<ActionResult>
```

- Lee `id` del formData; guard si falta o no es string no vacío → error "Falta el identificador del contacto".
- Parsea el resto con `contactUpdateSchema.safeParse`; en fallo → primer issue message.
- Llama `updateContact`; si retorna `undefined` → "No se encontró el contacto".
- `catch` → "No se pudo actualizar el contacto".
- Éxito → `{ ok: true }`.

### 4. Server action delgada — `app/companies/[id]/contacts/actions.ts`

```
updateContactAction(_prev, formData): Promise<ActionResult>
```

- Llama `runUpdateContact(db, formData)`.
- En éxito: parsea `companyId` con `idSchema` (uuid); si válido, `revalidatePath('/companies/{companyId}')`.
- Retorna el `ActionResult` (sin redirect; la UI hace `router.refresh()`).

## UI

### 5. `ContactEditForm` (nuevo componente client)

- Mismo layout de campos que `NewContactForm` (`grid gap-3 sm:grid-cols-2`), con
  `defaultValue` de cada campo del contacto.
- Hidden `id` + `companyId`.
- `useActionState(updateContactAction)`.
- En éxito (`state.ok`): `router.refresh()` + invoca callback `onDone()` para colapsar la fila.
- Botones: "Guardar cambios" (submit, con estado `pending` → "Guardando…") y "Cancelar"
  (llama `onDone`).
- Error inline en rojo (`state && !state.ok`).

### 6. `ContactTable` (modificado)

- Estado local: id de la fila en edición (una sola fila a la vez).
- Celda de acciones activa: "Editar · Archivar" juntos (mismo `<td>`). "Editar" hace
  toggle del estado de edición; "Archivar" queda como está.
- En vista de archivados: la celda sigue mostrando solo "Restaurar" (sin "Editar").
- Cuando una fila está en edición, se renderiza una `<tr>` extra debajo con una celda
  `colSpan` completo que contiene el `ContactEditForm`, pasando `onDone` para colapsar.

## Testing (TDD — tests primero)

- `test/contacts.test.ts` (data layer):
  - `updateContact` actualiza los campos y retorna la fila.
  - `updateContact` retorna `undefined` para un `id` inexistente.
  - `updateContact` mueve `updatedAt` hacia adelante.
- `test/contact-mutations.test.ts` (glue):
  - `runUpdateContact` éxito con datos válidos.
  - Falta `id` → error "Falta el identificador del contacto".
  - `name` vacío → error de validación.
  - `email` vacío → se persiste `null`.
  - `id` inexistente → "No se encontró el contacto".
- `contactUpdateSchema` queda cubierto vía los tests de mutations (igual que hoy con
  `contactCreateSchema`).
- UI sin tests: consistente con el resto de la app, que no testea componentes client.

## Notas de migración

Ninguna. No hay cambios de esquema (los campos ya existen; `updatedAt`/`$onUpdate` ya está).
