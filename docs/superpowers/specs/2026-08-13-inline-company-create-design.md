# Crear empresa inline en el formulario de proyecto

**Fecha:** 2026-08-13
**Estado:** Aprobado

## Problema

Al crear un proyecto nuevo (`/projects/new`), la empresa propietaria es obligatoria y
se elige de un `<select>` poblado desde el servidor. Si la empresa aún no existe, el
único camino es el enlace "Crear empresa" que lleva a `/companies`, sacando al usuario
del formulario y perdiendo lo que ya había capturado.

Queremos permitir crear una empresa —solo el nombre— sin salir del formulario de
proyecto, y que quede automáticamente seleccionada.

## Alcance

- Crear empresa **solo con el nombre**. Sin industria, tipo, sitio, etc.
- El resto de campos de la empresa se editan después desde el detalle de empresa.
- No se toca el flujo de creación de empresa existente en `/companies`.

## Diseño

### Servidor (TDD)

- Nueva función `runCreateCompanyReturning(db, formData): Promise<CreateCompanyResult>`
  en `lib/company-mutations.ts`.
  - `CreateCompanyResult = { ok: true; company: { id: string; name: string } } | { ok: false; error: string }`.
  - Valida con `companyCreateSchema` (igual que `runCreateCompany`).
  - Usa `createCompany` (que ya hace `.returning()`) y devuelve `{ id, name }`.
  - Mismos mensajes de error que la versión existente
    ("El nombre es obligatorio", "No se pudo crear la empresa").
- `runCreateCompany` existente **no cambia** (sigue devolviendo `{ ok: true }`).
- Nuevo server action `createCompanyInlineAction(_prev, formData)` en
  `app/projects/actions.ts`:
  - Llama `runCreateCompanyReturning(db, formData)`.
  - En éxito hace `revalidatePath("/companies")` y devuelve el resultado con `company`.

### UI

En `components/projects/project-create-form.tsx`, Sección 1 ("Empresa"):

- `companies` pasa de ser prop directa a estado local: `useState(companies)`, para poder
  añadir empresas creadas inline sin recargar.
- Junto al `<select>`, un botón "+ Nueva empresa" que abre un popover `<details>` con el
  mismo estilo visual que `components/companies/new-company-button.tsx`: un solo campo
  "Nombre de la empresa" + botón "Crear empresa".
- El popover tiene su **propio** `useActionState(createCompanyInlineAction)`. Como HTML
  no permite `<form>` anidados, el popover se renderiza como elemento hermano con
  posición absoluta dentro de la Sección 1 (contenedor `relative`), fuera del `<form>`
  principal de proyecto.
- Al éxito (`state.ok`):
  - Añadir `state.company` a la lista local `companies` (al inicio, orden por reciente).
  - `setCompanyId(state.company.id)` para seleccionarla.
  - Cerrar el `<details>` y limpiar el input.
- El texto actual "¿Empresa nueva? Crear empresa" (enlace a `/companies`) se reemplaza
  por este flujo inline.
- Errores de validación/creación se muestran dentro del popover (igual que
  `NewCompanyButton`).

## Testing

- `test/company-mutations.test.ts`: casos para `runCreateCompanyReturning`:
  - crea y devuelve `{ ok: true, company: { id, name } }` con id no vacío.
  - error de validación cuando falta el nombre ("El nombre es obligatorio").
  - error amigable cuando el insert lanza ("No se pudo crear la empresa").
- La UI (client component) se verifica manualmente; la lógica testeable vive en el server.

## Fuera de alcance

- Editar otros campos de la empresa desde el popover.
- Deduplicación / advertencia de empresa con nombre repetido (comportamiento actual no lo
  hace tampoco).
