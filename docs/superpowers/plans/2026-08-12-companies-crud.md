# Companies CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir Company en una entidad gestionable de punta a punta: ver detalle, editar todos sus campos, archivar (con confirmación) y restaurar.

**Architecture:** Ruta dinámica `/companies/[id]` para el detalle/edición. La capa de datos (`db/companies.ts`) gana funciones puras get/update/archive/restore probadas con PGlite. La lógica de las server actions se extrae a un módulo puro (`lib/company-mutations.ts`) para poder testearla sin el runtime de Next. El auto-bump de `updated_at` se hace con Drizzle `$onUpdate` (sin trigger de Postgres).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Drizzle ORM (postgres-js en prod, PGlite en tests), Zod, TanStack Table v8, Vitest.

## Global Constraints

- Node 22.x (ya fijado en CI/Vercel).
- Todo el UI copy en **español** (es-MX).
- **TDD**: test primero en toda la lógica (data layer, validación, glue). El UI (componentes/páginas) no tiene test runner de componentes en este stack; se verifica con `npx tsc --noEmit`, `npm run lint` y `npm run build`.
- La app **solo escribe vía Drizzle** (rol `postgres`, bypassa RLS). No tocar RLS/policies en este slice.
- Páginas que leen la DB llevan `export const dynamic = "force-dynamic"`.
- Reutilizar los tokens de diseño existentes (`font-display`, `tracking-display`, `col-label`, clases neutrales), sin inventar estilos nuevos.
- Path alias: `@/*` → raíz del repo.
- Sin migración nueva: `$onUpdate` es lógica de Drizzle en tiempo de query, no emite DDL; todas las columnas ya existen en `db/migrations/`.

---

### Task 1: Data layer — `getCompany`, `updateCompany` y `$onUpdate` en `updatedAt`

**Files:**
- Modify: `db/schema.ts` (columna `updatedAt`)
- Modify: `db/companies.ts` (nuevas funciones + tipo)
- Test: `test/companies.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `companies` (schema), `Company` type, `AnyDb`, `createTestDb`.
- Produces:
  - `getCompany(db: AnyDb, id: string): Promise<Company | undefined>`
  - `type CompanyUpdateFields = { name: string; legalName: string | null; industry: string | null; companyType: string | null; website: string | null; taxId: string | null; headquartersLocation: string | null; sizeSegment: string | null; notes: string | null }`
  - `updateCompany(db: AnyDb, id: string, fields: CompanyUpdateFields): Promise<Company>`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `test/companies.test.ts` (y agregar `getCompany`, `updateCompany` al import de `@/db/companies`):

```ts
describe("getCompany", () => {
  it("returns the row when it exists", async () => {
    const db = await createTestDb();
    const created = await createCompany(db, { name: "Naviera Cortés" });
    const found = await getCompany(db, created.id);
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe("Naviera Cortés");
  });

  it("returns undefined when it does not exist", async () => {
    const db = await createTestDb();
    const found = await getCompany(db, "00000000-0000-0000-0000-000000000000");
    expect(found).toBeUndefined();
  });
});

describe("updateCompany", () => {
  it("updates business fields and bumps updatedAt", async () => {
    const db = await createTestDb();
    const past = new Date("2020-01-01T00:00:00Z");
    const [row] = await db
      .insert(companies)
      .values({ name: "Antes", createdAt: past, updatedAt: past })
      .returning();

    const updated = await updateCompany(db, row.id, {
      name: "Después",
      legalName: "Después S.A. de C.V.",
      industry: "Acuicultura",
      companyType: null,
      website: null,
      taxId: null,
      headquartersLocation: null,
      sizeSegment: null,
      notes: null,
    });

    expect(updated.name).toBe("Después");
    expect(updated.legalName).toBe("Después S.A. de C.V.");
    expect(updated.industry).toBe("Acuicultura");
    expect(updated.updatedAt.getTime()).toBeGreaterThan(past.getTime());
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run test/companies.test.ts`
Expected: FAIL — `getCompany`/`updateCompany` no exportados.

- [ ] **Step 3: Añadir `$onUpdate` al schema**

En `db/schema.ts`, reemplazar la línea de `updatedAt` por:

```ts
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
```

- [ ] **Step 4: Implementar las funciones de datos**

En `db/companies.ts`, actualizar el import de `drizzle-orm` para incluir `eq` y añadir las funciones:

```ts
import { desc, eq, isNull } from "drizzle-orm";
```

```ts
export async function getCompany(
  db: AnyDb,
  id: string
): Promise<Company | undefined> {
  const [row] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);
  return row;
}

export type CompanyUpdateFields = {
  name: string;
  legalName: string | null;
  industry: string | null;
  companyType: string | null;
  website: string | null;
  taxId: string | null;
  headquartersLocation: string | null;
  sizeSegment: string | null;
  notes: string | null;
};

export async function updateCompany(
  db: AnyDb,
  id: string,
  fields: CompanyUpdateFields
): Promise<Company> {
  const [row] = await db
    .update(companies)
    .set(fields)
    .where(eq(companies.id, id))
    .returning();
  return row;
}
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `npx vitest run test/companies.test.ts`
Expected: PASS (incluye los tests previos de create/list).

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts db/companies.ts test/companies.test.ts
git commit -m "feat: company get/update data layer with updatedAt auto-bump (TDD)"
```

---

### Task 2: Data layer — `archiveCompany`, `restoreCompany`, `listCompanies` archivadas

**Files:**
- Modify: `db/companies.ts`
- Test: `test/companies.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `companies`, `Company`, `AnyDb`, `eq`, `isNull`, `desc`, `createCompany`.
- Produces:
  - `archiveCompany(db: AnyDb, id: string): Promise<Company>`
  - `restoreCompany(db: AnyDb, id: string): Promise<Company>`
  - `listCompanies(db: AnyDb, opts?: { archived?: boolean }): Promise<Company[]>` — `archived` falsy ⇒ solo no-archivadas (comportamiento actual); `archived: true` ⇒ solo archivadas. Orden `createdAt desc` en ambos.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `test/companies.test.ts` (agregar `archiveCompany`, `restoreCompany` al import). Necesitarás `isNotNull`/lectura vía `getCompany` ya importado en Task 1:

```ts
describe("archiveCompany / restoreCompany", () => {
  it("sets and clears archivedAt", async () => {
    const db = await createTestDb();
    const created = await createCompany(db, { name: "Camaronera" });

    const archived = await archiveCompany(db, created.id);
    expect(archived.archivedAt).not.toBeNull();

    const restored = await restoreCompany(db, created.id);
    expect(restored.archivedAt).toBeNull();
  });
});

describe("listCompanies with archived option", () => {
  it("lists only archived companies when archived: true", async () => {
    const db = await createTestDb();
    const active = await createCompany(db, { name: "Activa" });
    const gone = await createCompany(db, { name: "Archivada" });
    await archiveCompany(db, gone.id);

    const activos = await listCompanies(db);
    expect(activos.map((r) => r.name)).toEqual(["Activa"]);

    const archivados = await listCompanies(db, { archived: true });
    expect(archivados.map((r) => r.name)).toEqual(["Archivada"]);

    // sanity: active id present only in the active list
    expect(activos.map((r) => r.id)).toContain(active.id);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run test/companies.test.ts`
Expected: FAIL — `archiveCompany`/`restoreCompany` no exportados y `listCompanies` no acepta opción.

- [ ] **Step 3: Implementar**

En `db/companies.ts`, añadir `isNotNull` al import de `drizzle-orm`:

```ts
import { desc, eq, isNull, isNotNull } from "drizzle-orm";
```

Añadir las funciones y reemplazar `listCompanies`:

```ts
export async function archiveCompany(db: AnyDb, id: string): Promise<Company> {
  const [row] = await db
    .update(companies)
    .set({ archivedAt: new Date() })
    .where(eq(companies.id, id))
    .returning();
  return row;
}

export async function restoreCompany(db: AnyDb, id: string): Promise<Company> {
  const [row] = await db
    .update(companies)
    .set({ archivedAt: null })
    .where(eq(companies.id, id))
    .returning();
  return row;
}

export async function listCompanies(
  db: AnyDb,
  opts: { archived?: boolean } = {}
): Promise<Company[]> {
  return db
    .select()
    .from(companies)
    .where(opts.archived ? isNotNull(companies.archivedAt) : isNull(companies.archivedAt))
    .orderBy(desc(companies.createdAt));
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run test/companies.test.ts`
Expected: PASS (los tests previos de `listCompanies(db)` siguen verdes gracias al parámetro opcional).

- [ ] **Step 5: Commit**

```bash
git add db/companies.ts test/companies.test.ts
git commit -m "feat: archive/restore company + archived listing option (TDD)"
```

---

### Task 3: Validación — `companyUpdateSchema`

**Files:**
- Modify: `lib/validation.ts`
- Test: `test/validation.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `zod`.
- Produces:
  - `companyUpdateSchema` (Zod object) con `name` obligatorio y 8 opcionales normalizados (vacío/espacios ⇒ `null`).
  - `type CompanyUpdateInput = { name: string; legalName: string | null; industry: string | null; companyType: string | null; website: string | null; taxId: string | null; headquartersLocation: string | null; sizeSegment: string | null; notes: string | null }`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `test/validation.test.ts` (agregar `companyUpdateSchema` al import desde `@/lib/validation`):

```ts
describe("companyUpdateSchema", () => {
  it("requires a non-empty name", () => {
    const r = companyUpdateSchema.safeParse({ name: "   " });
    expect(r.success).toBe(false);
  });

  it("normalizes empty and whitespace optionals to null and keeps real values", () => {
    const r = companyUpdateSchema.safeParse({
      name: "Acme",
      industry: "",
      website: "   ",
      notes: "  hola  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Acme");
      expect(r.data.industry).toBeNull();
      expect(r.data.website).toBeNull();
      expect(r.data.notes).toBe("hola");
      expect(r.data.legalName).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run test/validation.test.ts`
Expected: FAIL — `companyUpdateSchema` no exportado.

- [ ] **Step 3: Implementar**

Añadir a `lib/validation.ts`:

```ts
const optionalText = z.preprocess((v) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}, z.string().nullable());

export const companyUpdateSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "El nombre es obligatorio")
  ),
  legalName: optionalText,
  industry: optionalText,
  companyType: optionalText,
  website: optionalText,
  taxId: optionalText,
  headquartersLocation: optionalText,
  sizeSegment: optionalText,
  notes: optionalText,
});

export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run test/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts test/validation.test.ts
git commit -m "feat: company update validation schema with empty->null normalization (TDD)"
```

---

### Task 4: Glue puro — `lib/company-mutations.ts` + refactor de `createCompanyAction`

**Files:**
- Create: `lib/company-mutations.ts`
- Modify: `app/companies/actions.ts`
- Test: `test/company-mutations.test.ts`

**Interfaces:**
- Consumes: `AnyDb`, `createCompany`, `updateCompany`, `getCompany`, `companyCreateSchema`, `companyUpdateSchema`.
- Produces:
  - `type ActionResult = { ok: true } | { ok: false; error: string }`
  - `runCreateCompany(db: AnyDb, formData: FormData): Promise<ActionResult>`
  - `runUpdateCompany(db: AnyDb, formData: FormData): Promise<ActionResult>`
  - `app/companies/actions.ts` sigue exportando `createCompanyAction` y re-exporta el tipo `ActionResult` (para `NewCompanyForm`, que lo importa desde ahí).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `test/company-mutations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { runCreateCompany, runUpdateCompany } from "@/lib/company-mutations";
import { createCompany, getCompany, listCompanies } from "@/db/companies";
import type { AnyDb } from "@/db/types";

function formOf(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("runCreateCompany", () => {
  it("creates a company from valid form data", async () => {
    const db = await createTestDb();
    const result = await runCreateCompany(db, formOf({ name: "Astilleros Sur" }));
    expect(result).toEqual({ ok: true });
    const rows = await listCompanies(db);
    expect(rows.map((r) => r.name)).toContain("Astilleros Sur");
  });

  it("returns a validation error when name is missing", async () => {
    const db = await createTestDb();
    const result = await runCreateCompany(db, formOf({}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("El nombre es obligatorio");
  });

  it("returns a friendly error when the insert throws", async () => {
    const throwingDb = {
      insert() {
        throw new Error("db down");
      },
    } as unknown as AnyDb;
    const result = await runCreateCompany(throwingDb, formOf({ name: "X" }));
    expect(result).toEqual({ ok: false, error: "No se pudo crear la empresa" });
  });
});

describe("runUpdateCompany", () => {
  it("updates fields and normalizes empty optionals to null", async () => {
    const db = await createTestDb();
    const created = await createCompany(db, { name: "Antes" });
    const result = await runUpdateCompany(
      db,
      formOf({ id: created.id, name: "Después", industry: "Pesca", website: "  " })
    );
    expect(result).toEqual({ ok: true });
    const row = await getCompany(db, created.id);
    expect(row?.name).toBe("Después");
    expect(row?.industry).toBe("Pesca");
    expect(row?.website).toBeNull();
  });

  it("returns an error when id is missing", async () => {
    const db = await createTestDb();
    const result = await runUpdateCompany(db, formOf({ name: "X" }));
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run test/company-mutations.test.ts`
Expected: FAIL — `@/lib/company-mutations` no existe.

- [ ] **Step 3: Crear el módulo puro**

Crear `lib/company-mutations.ts`:

```ts
import type { AnyDb } from "@/db/types";
import { createCompany, updateCompany } from "@/db/companies";
import { companyCreateSchema, companyUpdateSchema } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function runCreateCompany(
  db: AnyDb,
  formData: FormData
): Promise<ActionResult> {
  const parsed = companyCreateSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await createCompany(db, parsed.data);
  } catch {
    return { ok: false, error: "No se pudo crear la empresa" };
  }
  return { ok: true };
}

export async function runUpdateCompany(
  db: AnyDb,
  formData: FormData
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Falta el identificador de la empresa" };
  }
  const parsed = companyUpdateSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName"),
    industry: formData.get("industry"),
    companyType: formData.get("companyType"),
    website: formData.get("website"),
    taxId: formData.get("taxId"),
    headquartersLocation: formData.get("headquartersLocation"),
    sizeSegment: formData.get("sizeSegment"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await updateCompany(db, id, parsed.data);
  } catch {
    return { ok: false, error: "No se pudo actualizar la empresa" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Refactorizar `app/companies/actions.ts` para delegar en el glue**

Reemplazar el contenido de `app/companies/actions.ts` por:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { runCreateCompany, type ActionResult } from "@/lib/company-mutations";

export type { ActionResult } from "@/lib/company-mutations";

export async function createCompanyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const result = await runCreateCompany(db, formData);
  if (result.ok) revalidatePath("/companies");
  return result;
}
```

- [ ] **Step 5: Correr toda la suite para verificar que pasa y no rompió nada**

Run: `npx vitest run`
Expected: PASS (incluye `company-mutations`, `companies`, `validation`, `schema`).

- [ ] **Step 6: Typecheck (el form consume el tipo re-exportado)**

Run: `npx tsc --noEmit`
Expected: sin errores (`NewCompanyForm` sigue importando `type ActionResult` desde `@/app/companies/actions`).

- [ ] **Step 7: Commit**

```bash
git add lib/company-mutations.ts app/companies/actions.ts test/company-mutations.test.ts
git commit -m "refactor: extract testable company create/update glue + unit tests (TDD)"
```

---

### Task 5: Server actions del detalle — `app/companies/[id]/actions.ts`

**Files:**
- Create: `app/companies/[id]/actions.ts`

**Interfaces:**
- Consumes: `db`, `archiveCompany`, `restoreCompany`, `runUpdateCompany`, `ActionResult`, `revalidatePath`, `redirect`.
- Produces:
  - `updateCompanyAction(prev: ActionResult | null, formData: FormData): Promise<ActionResult>`
  - `archiveCompanyAction(formData: FormData): Promise<void>` (redirige a `/companies`)
  - `restoreCompanyAction(formData: FormData): Promise<void>` (redirige a `/companies`)

- [ ] **Step 1: Crear el archivo de actions**

Crear `app/companies/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { archiveCompany, restoreCompany } from "@/db/companies";
import { runUpdateCompany, type ActionResult } from "@/lib/company-mutations";

export async function updateCompanyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const result = await runUpdateCompany(db, formData);
  if (result.ok) {
    const id = formData.get("id");
    revalidatePath("/companies");
    if (typeof id === "string" && id.length > 0) {
      revalidatePath(`/companies/${id}`);
    }
  }
  return result;
}

export async function archiveCompanyAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id === "string" && id.length > 0) {
    await archiveCompany(db, id);
    revalidatePath("/companies");
  }
  redirect("/companies");
}

export async function restoreCompanyAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id === "string" && id.length > 0) {
    await restoreCompany(db, id);
    revalidatePath("/companies");
  }
  redirect("/companies");
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/companies/[id]/actions.ts"
git commit -m "feat: detail-page server actions (update, archive, restore)"
```

---

### Task 6: Página de detalle + form de edición + botón archivar/restaurar

**Files:**
- Create: `app/companies/[id]/page.tsx`
- Create: `components/company-detail-form.tsx`
- Create: `components/company-archive-button.tsx`

**Interfaces:**
- Consumes: `getCompany`, `db`, `notFound`, `updateCompanyAction`, `archiveCompanyAction`, `restoreCompanyAction`, `ActionResult`, `Company`.
- Produces: ruta navegable `/companies/[id]`.

- [ ] **Step 1: Crear el botón de archivar/restaurar (client, con confirmación)**

Crear `components/company-archive-button.tsx`:

```tsx
"use client";

import {
  archiveCompanyAction,
  restoreCompanyAction,
} from "@/app/companies/[id]/actions";

export function CompanyArchiveButton({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  return (
    <form
      action={archived ? restoreCompanyAction : archiveCompanyAction}
      onSubmit={(e) => {
        if (!archived && !window.confirm("¿Archivar esta empresa?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="font-semibold text-sm underline">
        {archived ? "Restaurar" : "Archivar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Crear el form de edición (client)**

Crear `components/company-detail-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import {
  updateCompanyAction,
  type ActionResult,
} from "@/app/companies/[id]/actions";
import type { Company } from "@/db/schema";

type TextField = {
  name: "legalName" | "industry" | "companyType" | "website" | "taxId" | "headquartersLocation" | "sizeSegment" | "notes";
  label: string;
  textarea?: boolean;
};

const FIELDS: TextField[] = [
  { name: "legalName", label: "Razón social" },
  { name: "industry", label: "Industria" },
  { name: "companyType", label: "Tipo de empresa" },
  { name: "website", label: "Sitio web" },
  { name: "taxId", label: "RFC / Tax ID" },
  { name: "headquartersLocation", label: "Ubicación" },
  { name: "sizeSegment", label: "Segmento de tamaño" },
  { name: "notes", label: "Notas", textarea: true },
];

export function CompanyDetailForm({ company }: { company: Company }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateCompanyAction,
    null
  );

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      <input type="hidden" name="id" value={company.id} />
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">Nombre</span>
        <input
          name="name"
          required
          defaultValue={company.name}
          className="rounded-md border px-3 py-2"
        />
      </label>
      {FIELDS.map((f) => (
        <label key={f.name} className="flex flex-col gap-1">
          <span className="font-medium text-sm">{f.label}</span>
          {f.textarea ? (
            <textarea
              name={f.name}
              defaultValue={company[f.name] ?? ""}
              rows={3}
              className="rounded-md border px-3 py-2"
            />
          ) : (
            <input
              name={f.name}
              defaultValue={company[f.name] ?? ""}
              className="rounded-md border px-3 py-2"
            />
          )}
        </label>
      ))}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        {state?.ok && <p className="text-sm text-green-600">Cambios guardados.</p>}
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Crear la página de detalle (server component)**

Crear `app/companies/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getCompany } from "@/db/companies";
import { CompanyDetailForm } from "@/components/company-detail-form";
import { CompanyArchiveButton } from "@/components/company-archive-button";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompany(db, id);
  if (!company) notFound();

  const archived = company.archivedAt !== null;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link href="/companies" className="text-sm underline">
        ← Empresas
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">
          {company.name}
        </h1>
        <CompanyArchiveButton id={company.id} archived={archived} />
      </div>
      {archived && (
        <p className="mt-2 text-sm text-neutral-500">Esta empresa está archivada.</p>
      )}
      <CompanyDetailForm company={company} />
    </main>
  );
}
```

- [ ] **Step 4: Verificar typecheck, lint y build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sin errores. La página es `force-dynamic`, así que `next build` no la prerenderiza ni toca la DB.

- [ ] **Step 5: Commit**

```bash
git add "app/companies/[id]/page.tsx" components/company-detail-form.tsx components/company-archive-button.tsx
git commit -m "feat: company detail page with edit form and archive/restore control"
```

---

### Task 7: Lista — nombre como link, toggle Activas/Archivadas y restaurar

**Files:**
- Modify: `components/company-table.tsx`
- Modify: `app/companies/page.tsx`

**Interfaces:**
- Consumes: `listCompanies(db, { archived })`, `restoreCompanyAction`, `Company`, `Link`.
- Produces: `/companies` con toggle `?archived=1`; `CompanyTable` acepta prop `archived?: boolean`.

- [ ] **Step 1: Actualizar `CompanyTable` (nombre como link + columna Restaurar en modo archivadas)**

Reemplazar el contenido de `components/company-table.tsx` por:

```tsx
"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Company } from "@/db/schema";
import { restoreCompanyAction } from "@/app/companies/[id]/actions";

const columnHelper = createColumnHelper<Company>();

function buildColumns(archived: boolean) {
  const base = [
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => (
        <Link
          href={`/companies/${info.row.original.id}`}
          className="font-medium underline"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("industry", {
      header: "Industria",
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("createdAt", {
      header: "Creada",
      cell: (info) => new Date(info.getValue()).toLocaleDateString("es-MX"),
    }),
  ];

  if (!archived) return base;

  return [
    ...base,
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => (
        <form action={restoreCompanyAction}>
          <input type="hidden" name="id" value={info.row.original.id} />
          <button className="text-sm underline">Restaurar</button>
        </form>
      ),
    }),
  ];
}

export function CompanyTable({
  data,
  archived = false,
}: {
  data: Company[];
  archived?: boolean;
}) {
  const table = useReactTable({
    data,
    columns: buildColumns(archived),
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <p className="mt-8 text-sm text-neutral-500">
        {archived ? "No hay empresas archivadas." : "Aún no hay empresas."}
      </p>
    );
  }

  return (
    <table className="mt-8 w-full text-left text-sm">
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
          <tr key={row.id} className="border-b">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="py-2">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Actualizar la página de lista (toggle + modo archivadas)**

Reemplazar el contenido de `app/companies/page.tsx` por:

```tsx
import Link from "next/link";
import { db } from "@/db/client";
import { listCompanies } from "@/db/companies";
import { CompanyTable } from "@/components/company-table";
import { NewCompanyForm } from "@/components/new-company-form";
import { signOut } from "@/app/login/actions";

// Always render at request time — this page reads live data from the DB and
// must not be statically prerendered (which would hit the DB during `next build`).
export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const companies = await listCompanies(db, { archived: showArchived });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">Empresas</h1>
        <form action={signOut}>
          <button className="font-semibold text-sm underline">Salir</button>
        </form>
      </div>

      <div className="mt-6 flex gap-4 text-sm">
        <Link
          href="/companies"
          className={showArchived ? "underline" : "font-semibold"}
        >
          Activas
        </Link>
        <Link
          href="/companies?archived=1"
          className={showArchived ? "font-semibold" : "underline"}
        >
          Archivadas
        </Link>
      </div>

      {!showArchived && <NewCompanyForm />}
      <CompanyTable data={companies} archived={showArchived} />
    </main>
  );
}
```

- [ ] **Step 3: Verificar suite completa, typecheck, lint y build**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: todo verde.

- [ ] **Step 4: Commit**

```bash
git add components/company-table.tsx app/companies/page.tsx
git commit -m "feat: companies list linking to detail with active/archived toggle"
```

---

## Verificación final (DoD)

Tras Task 7, además de la suite en verde, verificar manualmente (requiere `npm run dev` con DATABASE_URL apuntando a Supabase — esto lo hace el usuario en su entorno):

- Abrir una empresa desde la lista muestra su detalle con todos los campos poblados.
- Editar y guardar persiste los cambios y actualiza `updated_at`.
- Archivar (con confirmación) la saca de la vista "Activas".
- "Archivadas" la muestra; "Restaurar" la regresa a "Activas".
- Logout→/login, login→/companies siguen funcionando (sin regresión del gate).
