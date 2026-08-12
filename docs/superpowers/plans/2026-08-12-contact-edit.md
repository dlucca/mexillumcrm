# Edición de contactos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar los 5 campos de un contacto activo vía expand inline de su fila en la tabla anidada del detalle de empresa.

**Architecture:** Espejo exacto del patrón de edición de company: data layer puro (`updateContact`) → glue puro testeable (`runUpdateContact`) → server action delgada que revalida (`updateContactAction`) → UI client (`ContactEditForm` montado por `ContactTable` como fila expandida). Se agrega `contactUpdateSchema` (Zod). Sin cambios de esquema de base de datos.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Drizzle ORM, Zod, @tanstack/react-table, Vitest + PGlite in-process.

## Global Constraints

- TDD siempre: test primero, verlo fallar, implementar mínimo, verlo pasar, commit.
- UI copy en español.
- Zod para campos opcionales: reusar el helper `optionalText` de `lib/validation.ts` (vacío/no-string → `null`).
- Tipos honestos: los updates retornan `Promise<Contact | undefined>`.
- `ActionResult` se importa desde `lib/company-mutations.ts` (no redefinir).
- Update por `id` únicamente — NO scopear por `companyId` ni verificar ownership (eso es el slice C / RLS). `companyId` viaja como hidden field solo para revalidar.
- Solo contactos activos son editables. Los archivados no muestran "Editar".
- Tests corren con `npm test` (Vitest). Un test único: `npm test -- -t "<nombre>"` o por archivo `npx vitest run test/<archivo>.test.ts`.

---

### Task 1: `contactUpdateSchema` (validación)

**Files:**
- Modify: `lib/validation.ts` (agregar schema al final, junto a `contactCreateSchema`)
- Test: `test/contact-mutations.test.ts` (el schema se cubre indirectamente vía los tests de `runUpdateContact` en Task 3; este task solo agrega el schema y su tipo)

**Interfaces:**
- Consumes: `optionalText` (helper existente en `lib/validation.ts`), `z` (zod).
- Produces:
  - `contactUpdateSchema` — `ZodObject` con `{ name: string; email: string|null; phone: string|null; role: string|null; notes: string|null }`. `name` requerido (trim, min 1, mensaje "El nombre es obligatorio"); resto vía `optionalText`.
  - `type ContactUpdateInput = z.infer<typeof contactUpdateSchema>`.

- [ ] **Step 1: Agregar el schema**

En `lib/validation.ts`, después del bloque de `contactCreateSchema` (línea ~47), agregar:

```ts
export const contactUpdateSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "El nombre es obligatorio")
  ),
  email: optionalText,
  phone: optionalText,
  role: optionalText,
  notes: optionalText,
});

export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/validation.ts
git commit -m "feat: contactUpdateSchema con name requerido + campos opcionales"
```

---

### Task 2: `updateContact` (data layer)

**Files:**
- Modify: `db/contacts.ts` (agregar función + tipo)
- Test: `test/contacts.test.ts`

**Interfaces:**
- Consumes: `contacts` table + `Contact` type (`db/schema.ts`), `eq` (drizzle-orm), `AnyDb` (`db/types.ts`). Nota: `eq` ya está importado en `db/contacts.ts`.
- Produces:
  - `type ContactUpdateFields = { name: string; email: string|null; phone: string|null; role: string|null; notes: string|null }`.
  - `updateContact(db: AnyDb, id: string, fields: ContactUpdateFields): Promise<Contact | undefined>`.

- [ ] **Step 1: Escribir los tests que fallan**

En `test/contacts.test.ts`, agregar. El archivo ya trae los helpers `createTestDb()` (una db PGlite fresca por test) y `contactInput(companyId, name)` (`{ companyId, name, email: null, phone: null, role: null, notes: null }`); reusarlos. Agregar `updateContact` al import existente desde `@/db/contacts`:

```ts
describe("updateContact", () => {
  it("actualiza los campos y retorna la fila", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const contact = await createContact(db, contactInput(company.id, "Ana"));

    const updated = await updateContact(db, contact.id, {
      name: "Ana Pérez",
      email: "ana@acme.mx",
      phone: "555",
      role: "Compras",
      notes: "VIP",
    });

    expect(updated?.name).toBe("Ana Pérez");
    expect(updated?.email).toBe("ana@acme.mx");
    expect(updated?.role).toBe("Compras");
  });

  it("retorna undefined para un id inexistente", async () => {
    const db = await createTestDb();
    const updated = await updateContact(db, "00000000-0000-0000-0000-000000000000", {
      name: "X",
      email: null,
      phone: null,
      role: null,
      notes: null,
    });
    expect(updated).toBeUndefined();
  });

  it("mueve updatedAt hacia adelante", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const contact = await createContact(db, contactInput(company.id, "Ana"));

    const updated = await updateContact(db, contact.id, {
      name: "Ana 2",
      email: null,
      phone: null,
      role: null,
      notes: null,
    });

    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      contact.updatedAt.getTime()
    );
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run test/contacts.test.ts`
Expected: FAIL — `updateContact is not a function` / no exportada.

- [ ] **Step 3: Implementar `updateContact`**

En `db/contacts.ts`, agregar después de `restoreContact`:

```ts
export type ContactUpdateFields = {
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  notes: string | null;
};

export async function updateContact(
  db: AnyDb,
  id: string,
  fields: ContactUpdateFields
): Promise<Contact | undefined> {
  const [row] = await db
    .update(contacts)
    .set(fields)
    .where(eq(contacts.id, id))
    .returning();
  return row;
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run test/contacts.test.ts`
Expected: PASS (todos, incluyendo los previos).

- [ ] **Step 5: Commit**

```bash
git add db/contacts.ts test/contacts.test.ts
git commit -m "feat: updateContact data layer con tests (TDD)"
```

---

### Task 3: `runUpdateContact` (glue puro)

**Files:**
- Modify: `lib/contact-mutations.ts` (agregar función)
- Test: `test/contact-mutations.test.ts`

**Interfaces:**
- Consumes: `updateContact` + `ContactUpdateFields` (Task 2), `contactUpdateSchema` (Task 1), `ActionResult` (`lib/company-mutations.ts`), `AnyDb`.
- Produces: `runUpdateContact(db: AnyDb, formData: FormData): Promise<ActionResult>`.

- [ ] **Step 1: Escribir los tests que fallan**

En `test/contact-mutations.test.ts`, agregar. El archivo ya trae `createTestDb()` y el helper `formOf(entries: Record<string,string>): FormData`; reusarlos. Ajustar imports: agregar `runUpdateContact` al import desde `@/lib/contact-mutations`, y `createContact` al import desde `@/db/contacts` (hoy solo importa `listContacts`):

```ts
describe("runUpdateContact", () => {
  it("actualiza con datos válidos", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const contact = await createContact(db, {
      companyId: company.id,
      name: "Ana",
      email: null,
      phone: null,
      role: null,
      notes: null,
    });

    const result = await runUpdateContact(
      db,
      formOf({
        id: contact.id,
        companyId: company.id,
        name: "Ana Pérez",
        email: "ana@acme.mx",
        phone: "",
        role: "",
        notes: "",
      })
    );
    expect(result.ok).toBe(true);

    const [reloaded] = await listContacts(db, company.id);
    expect(reloaded.name).toBe("Ana Pérez");
    expect(reloaded.email).toBe("ana@acme.mx");
  });

  it("falla si falta id", async () => {
    const db = await createTestDb();
    const result = await runUpdateContact(db, formOf({ name: "Ana" }));
    expect(result).toEqual({ ok: false, error: "Falta el identificador del contacto" });
  });

  it("falla si name está vacío", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const contact = await createContact(db, {
      companyId: company.id,
      name: "Ana",
      email: null,
      phone: null,
      role: null,
      notes: null,
    });
    const result = await runUpdateContact(
      db,
      formOf({ id: contact.id, name: "   " })
    );
    expect(result.ok).toBe(false);
  });

  it("persiste email vacío como null", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const contact = await createContact(db, {
      companyId: company.id,
      name: "Ana",
      email: "old@acme.mx",
      phone: null,
      role: null,
      notes: null,
    });
    const result = await runUpdateContact(
      db,
      formOf({ id: contact.id, companyId: company.id, name: "Ana", email: "" })
    );
    expect(result.ok).toBe(true);

    const [reloaded] = await listContacts(db, company.id);
    expect(reloaded.email).toBeNull();
  });

  it("falla para id inexistente", async () => {
    const db = await createTestDb();
    const result = await runUpdateContact(
      db,
      formOf({ id: "00000000-0000-0000-0000-000000000000", name: "Ana" })
    );
    expect(result).toEqual({ ok: false, error: "No se encontró el contacto" });
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run test/contact-mutations.test.ts`
Expected: FAIL — `runUpdateContact is not a function`.

- [ ] **Step 3: Implementar `runUpdateContact`**

En `lib/contact-mutations.ts`, agregar (junto a `runCreateContact`; ajustar el import de `@/db/contacts` para incluir `updateContact`, y el de `@/lib/validation` para incluir `contactUpdateSchema`):

```ts
export async function runUpdateContact(
  db: AnyDb,
  formData: FormData
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Falta el identificador del contacto" };
  }
  const parsed = contactUpdateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const row = await updateContact(db, id, parsed.data);
    if (!row) {
      return { ok: false, error: "No se encontró el contacto" };
    }
  } catch {
    return { ok: false, error: "No se pudo actualizar el contacto" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run test/contact-mutations.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/contact-mutations.ts lib/validation.ts test/contact-mutations.test.ts
git commit -m "feat: runUpdateContact glue con tests (TDD)"
```

---

### Task 4: `updateContactAction` (server action)

**Files:**
- Modify: `app/companies/[id]/contacts/actions.ts`

**Interfaces:**
- Consumes: `runUpdateContact` (Task 3), `db` (`@/db/client`), `ActionResult` (`@/lib/company-mutations`), `idSchema` (ya definido en este archivo), `revalidatePath`.
- Produces: `updateContactAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult>`.

Sin test unitario dedicado (las server actions delgadas no se testean en este proyecto; la lógica vive en `runUpdateContact`, ya cubierto). El "test" es la verificación de compilación.

- [ ] **Step 1: Agregar la action**

En `app/companies/[id]/contacts/actions.ts`, agregar `runUpdateContact` al import desde `@/lib/contact-mutations`, y agregar:

```ts
export async function updateContactAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const result = await runUpdateContact(db, formData);
  if (result.ok) {
    const companyId = idSchema.safeParse(formData.get("companyId"));
    if (companyId.success) revalidatePath(`/companies/${companyId.data}`);
  }
  return result;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/companies/[id]/contacts/actions.ts
git commit -m "feat: updateContactAction que revalida el detalle de empresa"
```

---

### Task 5: `ContactEditForm` (UI — form de edición)

**Files:**
- Create: `components/contact-edit-form.tsx`

**Interfaces:**
- Consumes: `updateContactAction` (Task 4), `ActionResult` (`@/lib/company-mutations`), `Contact` (`@/db/schema`), `useActionState`/`useEffect` (react), `useRouter` (next/navigation).
- Produces: `ContactEditForm({ contact, onDone }: { contact: Contact; onDone: () => void })`.

Sin test (componente client; consistente con el resto de la app).

- [ ] **Step 1: Crear el componente**

Crear `components/contact-edit-form.tsx` (mismo layout de campos que `components/new-contact-form.tsx`, pero con `defaultValue`, hidden `id`+`companyId`, y botones Guardar/Cancelar):

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateContactAction } from "@/app/companies/[id]/contacts/actions";
import type { ActionResult } from "@/lib/company-mutations";
import type { Contact } from "@/db/schema";

export function ContactEditForm({
  contact,
  onDone,
}: {
  contact: Contact;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateContactAction,
    null
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  return (
    <form action={formAction} className="grid gap-3 py-2 sm:grid-cols-2">
      <input type="hidden" name="id" value={contact.id} />
      <input type="hidden" name="companyId" value={contact.companyId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Nombre</span>
        <input
          name="name"
          required
          defaultValue={contact.name}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Email</span>
        <input
          name="email"
          defaultValue={contact.email ?? ""}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Teléfono</span>
        <input
          name="phone"
          defaultValue={contact.phone ?? ""}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Puesto</span>
        <input
          name="role"
          defaultValue={contact.role ?? ""}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-medium text-sm">Notas</span>
        <textarea
          name="notes"
          defaultValue={contact.notes ?? ""}
          rows={2}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm underline"
        >
          Cancelar
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/contact-edit-form.tsx
git commit -m "feat: ContactEditForm para edición inline de contacto"
```

---

### Task 6: `ContactTable` — expand inline + "Editar"

**Files:**
- Modify: `components/contact-table.tsx`

**Interfaces:**
- Consumes: `ContactEditForm` (Task 5), estado local de React (`useState`), la estructura de tabla existente de @tanstack/react-table.
- Produces: cambios internos a `ContactTable`; su firma pública `ContactTable({ data, archived })` no cambia.

Sin test (componente client).

- [ ] **Step 1: Agregar estado de edición y botón "Editar"**

En `components/contact-table.tsx`:

1. Agregar imports arriba:

```tsx
import { useState } from "react";
import { ContactEditForm } from "@/components/contact-edit-form";
```

2. `buildColumns` necesita saber qué fila está en edición y cómo alternarla. Cambiar su firma para recibir un handler y modificar la celda de acciones para incluir "Editar" **solo cuando no está archivado**:

Reemplazar la definición de `buildColumns(archived)` para que acepte `onEdit`:

```tsx
function buildColumns(
  archived: boolean,
  onEdit: (id: string) => void
) {
  const action = archived
    ? { fn: restoreContactAction, label: "Restaurar" }
    : { fn: archiveContactAction, label: "Archivar" };

  return [
    columnHelper.accessor("name", { header: "Nombre" }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("phone", {
      header: "Teléfono",
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("role", {
      header: "Puesto",
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => (
        <div className="flex items-center gap-3">
          {!archived && (
            <button
              type="button"
              onClick={() => onEdit(info.row.original.id)}
              className="text-sm underline"
            >
              Editar
            </button>
          )}
          <form action={action.fn}>
            <input type="hidden" name="id" value={info.row.original.id} />
            <input type="hidden" name="companyId" value={info.row.original.companyId} />
            <button className="text-sm underline">{action.label}</button>
          </form>
        </div>
      ),
    }),
  ];
}
```

- [ ] **Step 2: Cablear estado + fila expandida en el componente**

Reemplazar el cuerpo de `ContactTable` para: mantener `editingId`, construir columnas con el handler, y renderizar una `<tr>` extra con la fila en edición.

```tsx
export function ContactTable({
  data,
  archived = false,
}: {
  data: Contact[];
  archived?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const table = useReactTable({
    data,
    columns: buildColumns(archived, setEditingId),
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <p className="mt-4 text-sm text-neutral-500">
        {archived ? "No hay contactos archivados." : "Aún no hay contactos."}
      </p>
    );
  }

  return (
    <table className="mt-4 w-full text-left text-sm">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id} className="border-b">
            {hg.headers.map((h) => (
              <th key={h.id} className="col-label py-2">
                {flexRender(h.column.columnDef.header, h.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <React.Fragment key={row.id}>
            <tr className="border-b">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
            {editingId === row.original.id && (
              <tr className="border-b bg-neutral-50">
                <td colSpan={row.getVisibleCells().length} className="px-2">
                  <ContactEditForm
                    contact={row.original}
                    onDone={() => setEditingId(null)}
                  />
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}
```

Agregar `import React from "react";` arriba (necesario por `React.Fragment` con `key`), o alternativamente importar `Fragment` nombrado y usar `<Fragment key=...>`. Usar la variante que ya prefiera el codebase; si no hay precedente, `import { Fragment } from "react";` y `<Fragment key={row.id}>`.

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Verificar la suite completa**

Run: `npm test`
Expected: PASS — todos los tests (los previos + los nuevos de Tasks 2 y 3).

- [ ] **Step 5: Commit**

```bash
git add components/contact-table.tsx
git commit -m "feat: edición inline de contacto en ContactTable (expand por fila)"
```

---

### Task 7: Verificación manual + cierre

**Files:** ninguno (verificación).

- [ ] **Step 1: Correr la suite completa y typecheck**

```bash
npm test && npx tsc --noEmit
```
Expected: todos los tests PASS, typecheck limpio.

- [ ] **Step 2: Verificación manual en dev**

Levantar `npm run dev`, entrar a un detalle de empresa con al menos un contacto activo, y verificar:
- "Editar" aparece en la fila de un contacto activo, no en la vista de archivados.
- Al hacer clic en "Editar", la fila se expande con el form precargado.
- Guardar con nombre válido → la fila se colapsa y la tabla muestra los datos nuevos.
- Guardar con nombre vacío → muestra error inline, no cierra.
- "Cancelar" colapsa sin guardar.

- [ ] **Step 3: Commit final si hubo ajustes**

Si la verificación manual no requirió cambios, no hay commit. Si hubo ajustes, commitearlos con un mensaje descriptivo.

---

## Notas

- No hay migración de base de datos (los campos ya existen; `updatedAt`/`$onUpdate` ya está en el schema).
- La brecha de pertenencia (`update` por `id` sin verificar `companyId`) es intencional y queda para el slice C (RLS + ownership), consistente con `archiveContact`/`restoreContact`.
