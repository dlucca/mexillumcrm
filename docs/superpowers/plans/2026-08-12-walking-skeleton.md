# Mexillum CRM — Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the full stack end-to-end — Next.js App Router → Supabase Auth → Drizzle → Supabase Postgres → UI → Vercel — through a login-gated **list + create Companies** slice with a passing test suite.

**Architecture:** A single Next.js App Router application at the repo root. Data access is a thin, dependency-injected Drizzle layer (functions receive a `db`), so runtime code uses the Supabase-backed client while tests use an in-process PGlite database with the same migration applied. Auth is cookie-session Supabase Auth via `@supabase/ssr`, enforced in middleware. Server actions are the only write path and return typed results.

**Tech Stack:** Next.js 15 (App Router, React 19, TypeScript), Tailwind v4, shadcn/ui, TanStack Table, Drizzle ORM, `postgres` (postgres-js), Supabase Auth (`@supabase/ssr`), Zod, Vitest, PGlite (test DB), Vercel.

## Global Constraints

- **Next.js 15 App Router**, React 19, TypeScript. Package manager: **npm**. Node **20+**.
- **Tailwind v4** (CSS-based config in `app/globals.css`; there is no `tailwind.config.ts`). The kit's `docs/typography-kit/tailwind.config.v3.ts` is **unused** — ignore it.
- **Design system is wired from the first task.** Fonts and color come from `docs/typography-kit/` and `docs/color-kit/`. Font roles: `font-sans → Barlow`, `font-mono → JetBrains Mono`, `font-display → Barlow Condensed`.
- **Env vars (exact names):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (Supabase pooler, transaction mode, port **6543**), `DIRECT_URL` (Supabase direct, port **5432**).
- **Drizzle migrations are the source of truth** (`db/migrations/`). Generate with `drizzle-kit generate`; never hand-edit an applied migration.
- **All server actions return a typed result** `{ ok: true, ... } | { ok: false, error: string }` — never throw across the action boundary.
- **TDD, test-first** for all data-access and validation logic. Data functions are dependency-injected with `db` so they can run against PGlite.
- **Postgres conventions:** UUID primary keys, `timestamptz` timestamps, base timezone `America/Mexico_City`.
- **UI copy is in Spanish.**

---

## File Structure

- `app/layout.tsx`, `app/globals.css`, `app/fonts.ts`, `app/page.tsx`, `app/error.tsx` — shell + design system.
- `app/login/page.tsx`, `app/login/actions.ts` — login form + `login`/`signOut` actions.
- `app/companies/page.tsx`, `app/companies/actions.ts` — companies list page + `createCompanyAction`.
- `components/new-company-form.tsx`, `components/company-table.tsx` — client UI.
- `db/schema.ts` — Drizzle table definitions + inferred types.
- `db/client.ts` — runtime Drizzle client (postgres-js + Supabase pooler).
- `db/companies.ts` — dependency-injected data functions (`createCompany`, `listCompanies`).
- `db/migrations/` — generated SQL migrations.
- `lib/validation.ts` — Zod schemas.
- `lib/supabase/server.ts`, `lib/supabase/middleware.ts` — Supabase SSR helpers.
- `middleware.ts` — session refresh + route protection.
- `drizzle.config.ts` — drizzle-kit config.
- `vitest.config.ts` — test runner config.
- `test/db.ts` — `createTestDb()` PGlite helper.
- `test/schema.test.ts`, `test/companies.test.ts`, `test/validation.test.ts` — tests.
- `.github/workflows/ci.yml` — CI.
- `.env.example` — documented env var names.

---

## Task 1: Scaffold Next.js app + Mexillum design system

**Files:**
- Create: whole Next.js scaffold at repo root (`app/`, `package.json`, `tsconfig.json`, etc.)
- Create: `app/fonts.ts` (from kit), `app/error.tsx`
- Modify: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a running app with `font-display`/`font-sans`/`font-mono` utilities and Mexillum color tokens available to all later UI.

- [ ] **Step 1: Scaffold the app into the repo root**

Run (accept defaults; the `docs/` folder is preserved):

```bash
npx create-next-app@latest . --ts --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack
```

Expected: `package.json`, `app/`, `tsconfig.json` created. `tsconfig.json` contains `"paths": { "@/*": ["./*"] }`.

- [ ] **Step 2: Install the typography fonts and wire `app/fonts.ts`**

Copy the kit file:

```bash
cp docs/typography-kit/fonts.ts app/fonts.ts
```

Open `app/fonts.ts` and confirm it exports a `fontVariables` string (or equivalent) loading Barlow Condensed, Barlow, and JetBrains Mono via `next/font`. If the export name differs, note the actual export for Step 4.

- [ ] **Step 3: Merge design-system CSS into `app/globals.css`**

Replace the contents of `app/globals.css` with the Tailwind v4 import plus the merged kit CSS: paste the full contents of `docs/typography-kit/globals.css` followed by the full contents of `docs/color-kit/globals.color.css`. Ensure there is exactly one `@import "tailwindcss";` at the top and the `@theme` blocks from both kits are present (merge them into a single `@theme` block if both define one).

- [ ] **Step 4: Apply font variables in `app/layout.tsx`**

Edit `app/layout.tsx` to apply the kit's font variables to `<html>`, following `docs/typography-kit/layout.snippet.tsx`. Example shape (adapt to the actual export from Step 2):

```tsx
import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "Mexillum CRM" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Put a design-system smoke marker on the home page**

Replace `app/page.tsx` with:

```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <p className="eyebrow">Mexillum CRM</p>
      <h1 className="font-display font-bold text-4xl tracking-display">Walking Skeleton</h1>
      <p className="mt-4 text-base">Sistema de diseño activo. <span className="data">$1,240,000</span></p>
    </main>
  );
}
```

- [ ] **Step 6: Add a route-level error boundary**

Create `app/error.tsx`:

```tsx
"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="font-display font-semibold text-2xl">Algo salió mal</h1>
      <button className="mt-4 font-semibold text-sm underline" onClick={() => reset()}>
        Reintentar
      </button>
    </main>
  );
}
```

- [ ] **Step 7: Initialize shadcn/ui with the font mapping**

Run:

```bash
npx shadcn@latest init -d
```

Then confirm shadcn's config maps `font-sans`/`font-mono` to the CSS variables from the kit (Barlow / JetBrains Mono). If `init` overwrote parts of `app/globals.css`, re-merge the kit CSS from Step 3 so the `@theme` tokens and `font-display` utility survive.

- [ ] **Step 8: Run the app and verify the design system renders**

Run:

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: the `<h1>` renders in **Barlow Condensed**, the `$1,240,000` in **JetBrains Mono** with tabular figures, and background/foreground use the Mexillum neutral palette (not default shadcn). Stop the dev server.

- [ ] **Step 9: Verify build and lint pass**

Run:

```bash
npm run build && npm run lint
```

Expected: both succeed with no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with Mexillum design system"
```

---

## Task 2: Drizzle schema, Supabase connection, migration, and Vitest+PGlite harness

**Files:**
- Create: `db/schema.ts`, `db/client.ts`, `drizzle.config.ts`, `vitest.config.ts`, `test/db.ts`, `test/schema.test.ts`, `.env.example`
- Create: `db/migrations/` (generated)
- Modify: `package.json` (scripts), `.gitignore` (ensure `.env*.local` ignored)

**Interfaces:**
- Consumes: nothing from prior tasks (independent infra).
- Produces:
  - `db/schema.ts` exports `companies` (Drizzle table), and types `Company = typeof companies.$inferSelect`, `NewCompany = typeof companies.$inferInsert`.
  - `db/client.ts` exports `db` (runtime Drizzle instance).
  - `test/db.ts` exports `async function createTestDb(): Promise<AnyDb>` — a PGlite-backed Drizzle instance with migrations applied.

- [ ] **Step 1: Install dependencies**

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit vitest vite-tsconfig-paths @electric-sql/pglite
```

- [ ] **Step 2: Define the `companies` schema**

Create `db/schema.ts` (fields per PRD §7.1; only `name` is NOT NULL):

```ts
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    industry: text("industry"),
    companyType: text("company_type"),
    website: text("website"),
    taxId: text("tax_id"),
    headquartersLocation: text("headquarters_location"),
    sizeSegment: text("size_segment"),
    notes: text("notes"),
    ownerUserId: uuid("owner_user_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("companies_owner_user_id_idx").on(t.ownerUserId),
    index("companies_archived_at_idx").on(t.archivedAt),
  ]
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
```

- [ ] **Step 3: Create the drizzle-kit config**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DIRECT_URL! },
});
```

- [ ] **Step 4: Create the runtime Drizzle client**

Create `db/client.ts` (`prepare: false` is required for the Supabase transaction pooler):

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema });
```

- [ ] **Step 5: Document env vars and add npm scripts**

Create `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Supabase pooler, transaction mode, port 6543
DATABASE_URL=
# Supabase direct connection, port 5432 (used only by drizzle-kit)
DIRECT_URL=
```

Add to the `"scripts"` block of `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"test": "vitest run",
"test:watch": "vitest"
```

Confirm `.gitignore` includes `.env*.local` (create-next-app adds this by default). Create a real `.env.local` with your Supabase values (this file is git-ignored).

- [ ] **Step 6: Generate the migration**

```bash
npm run db:generate
```

Expected: a `.sql` file appears in `db/migrations/` creating the `companies` table and both indexes.

- [ ] **Step 7: Apply the migration to Supabase**

```bash
npm run db:migrate
```

Expected: completes without error. Verify in the Supabase dashboard (Table editor) that a `companies` table now exists.

- [ ] **Step 8: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: "node" },
});
```

- [ ] **Step 9: Write the failing schema smoke test**

Create `test/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { companies } from "@/db/schema";

describe("schema", () => {
  it("migrates and exposes an empty companies table", async () => {
    const db = await createTestDb();
    const rows = await db.select().from(companies);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 10: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `@/test/db` (helper does not exist yet).

- [ ] **Step 11: Implement the PGlite test-db helper**

Create `test/db.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function createTestDb(): Promise<AnyDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "db/migrations" });
  return db as unknown as AnyDb;
}
```

- [ ] **Step 12: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — the PGlite database migrates and `companies` is empty.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: drizzle companies schema, supabase client, vitest+pglite harness"
```

---

## Task 3: Companies data layer (TDD)

**Files:**
- Create: `db/companies.ts`, `test/companies.test.ts`

**Interfaces:**
- Consumes: `companies`, `Company` from `db/schema.ts`; `createTestDb`, `AnyDb` from `test/db.ts`.
- Produces:
  - `createCompany(db: AnyDb, input: { name: string }): Promise<Company>`
  - `listCompanies(db: AnyDb): Promise<Company[]>` — returns non-archived companies, newest first.

- [ ] **Step 1: Write the failing tests**

Create `test/companies.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { createCompany, listCompanies } from "@/db/companies";
import { companies } from "@/db/schema";

describe("createCompany", () => {
  it("inserts a company and returns the row with an id", async () => {
    const db = await createTestDb();
    const row = await createCompany(db, { name: "Mariscos del Golfo" });
    expect(row.id).toBeTruthy();
    expect(row.name).toBe("Mariscos del Golfo");
    expect(row.archivedAt).toBeNull();
  });
});

describe("listCompanies", () => {
  it("returns only non-archived companies, newest first", async () => {
    const db = await createTestDb();
    const first = await createCompany(db, { name: "Primera" });
    const second = await createCompany(db, { name: "Segunda" });

    // Archive the first one directly.
    await db
      .update(companies)
      .set({ archivedAt: new Date() })
      .where(eq(companies.id, first.id));

    const rows = await listCompanies(db);
    expect(rows.map((r) => r.name)).toEqual(["Segunda"]);
    expect(rows[0].id).toBe(second.id);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test
```

Expected: FAIL — cannot resolve `@/db/companies`.

- [ ] **Step 3: Implement the data layer**

Create `db/companies.ts`:

```ts
import { desc, isNull } from "drizzle-orm";
import { companies } from "./schema";
import type { Company } from "./schema";
import type { AnyDb } from "@/test/db";

export async function createCompany(
  db: AnyDb,
  input: { name: string }
): Promise<Company> {
  const [row] = await db.insert(companies).values({ name: input.name }).returning();
  return row;
}

export async function listCompanies(db: AnyDb): Promise<Company[]> {
  return db
    .select()
    .from(companies)
    .where(isNull(companies.archivedAt))
    .orderBy(desc(companies.createdAt));
}
```

> Note: `AnyDb` is imported for its type only; it erases at compile time, so importing it from `test/db.ts` does not pull test code into the runtime bundle. If you prefer, move the `AnyDb` type alias into `db/schema.ts` and import it from there in both files.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS — both `createCompany` and `listCompanies` tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: companies data layer with archive-aware list (TDD)"
```

---

## Task 4: Validation schema + create server action

**Files:**
- Create: `lib/validation.ts`, `test/validation.test.ts`, `app/companies/actions.ts`

**Interfaces:**
- Consumes: `createCompany` from `db/companies.ts`; `db` from `db/client.ts`.
- Produces:
  - `companyCreateSchema` (Zod) and `CompanyCreateInput` type from `lib/validation.ts`.
  - `createCompanyAction(prev: ActionResult | null, formData: FormData): Promise<ActionResult>` from `app/companies/actions.ts`, where `ActionResult = { ok: true } | { ok: false; error: string }`.

- [ ] **Step 1: Install Zod**

```bash
npm install zod
```

- [ ] **Step 2: Write the failing validation test**

Create `test/validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { companyCreateSchema } from "@/lib/validation";

describe("companyCreateSchema", () => {
  it("rejects an empty name", () => {
    const result = companyCreateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("trims and accepts a valid name", () => {
    const result = companyCreateSchema.safeParse({ name: "  Acme  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Acme");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `@/lib/validation`.

- [ ] **Step 4: Implement the validation schema**

Create `lib/validation.ts`:

```ts
import { z } from "zod";

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
});

export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — both validation tests green.

- [ ] **Step 6: Implement the create server action**

Create `app/companies/actions.ts` (glue over the tested data + validation layers; returns a typed result, never throws):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { createCompany } from "@/db/companies";
import { companyCreateSchema } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCompanyAction(
  _prev: ActionResult | null,
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

  revalidatePath("/companies");
  return { ok: true };
}
```

- [ ] **Step 7: Verify typecheck and tests**

```bash
npx tsc --noEmit && npm test
```

Expected: no type errors; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: company create validation (TDD) and server action"
```

---

## Task 5: Supabase Auth — login gate, middleware, sign-out

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, `app/login/page.tsx`, `app/login/actions.ts`

**Interfaces:**
- Consumes: env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Produces:
  - `createClient()` from `lib/supabase/server.ts` (async, returns a Supabase server client).
  - `login(prev, formData)` and `signOut()` from `app/login/actions.ts`.
  - Middleware that redirects unauthenticated requests (except `/login`) to `/login`.

- [ ] **Step 1: Install the Supabase SSR package**

```bash
npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Create the Supabase server client helper**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; safe to ignore when middleware refreshes sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create the middleware session helper**

Create `lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Create the root middleware**

Create `middleware.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Create the login actions**

Create `app/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) return { error: "Credenciales inválidas" };
  redirect("/companies");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 6: Create the login page**

Create `app/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">Mexillum CRM</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-sm">Correo</span>
          <input name="email" type="email" required className="rounded-md border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-sm">Contraseña</span>
          <input name="password" type="password" required className="rounded-md border px-3 py-2" />
        </label>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Verify the gate manually**

Create a test user in the Supabase dashboard (Authentication → Users → Add user, with a password). Then:

```bash
npm run dev
```

- Visit `http://localhost:3000/companies` while logged out → Expected: redirected to `/login`.
- Log in with the test user → Expected: redirected to `/companies` (this route renders in the next task; a 404/empty is fine here, the point is you were *not* bounced to `/login`).
- Stop the dev server.

- [ ] **Step 8: Verify build, typecheck, tests**

```bash
npm run build && npx tsc --noEmit && npm test
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: supabase auth login gate with middleware protection"
```

---

## Task 6: Companies page UI — list + create form

**Files:**
- Create: `components/company-table.tsx`, `components/new-company-form.tsx`, `app/companies/page.tsx`

**Interfaces:**
- Consumes: `listCompanies` from `db/companies.ts`, `db` from `db/client.ts`, `createCompanyAction`/`ActionResult` from `app/companies/actions.ts`, `signOut` from `app/login/actions.ts`, `Company` from `db/schema.ts`.
- Produces: the `/companies` route (server component) rendering the create form + table, gated by the Task 5 middleware.

- [ ] **Step 1: Install TanStack Table**

```bash
npm install @tanstack/react-table
```

- [ ] **Step 2: Build the create form (client component)**

Create `components/new-company-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCompanyAction, type ActionResult } from "@/app/companies/actions";

export function NewCompanyForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createCompanyAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-6 flex items-end gap-3">
      <label className="flex flex-1 flex-col gap-1">
        <span className="font-medium text-sm">Nueva empresa</span>
        <input name="name" required className="rounded-md border px-3 py-2" placeholder="Nombre" />
      </label>
      <button type="submit" disabled={pending} className="rounded-md bg-black px-4 py-2 font-semibold text-sm text-white disabled:opacity-50">
        {pending ? "Guardando…" : "Agregar"}
      </button>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Build the table (client component, TanStack Table)**

Create `components/company-table.tsx`:

```tsx
"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Company } from "@/db/schema";

const columnHelper = createColumnHelper<Company>();

const columns = [
  columnHelper.accessor("name", { header: "Nombre" }),
  columnHelper.accessor("industry", {
    header: "Industria",
    cell: (info) => info.getValue() ?? "—",
  }),
  columnHelper.accessor("createdAt", {
    header: "Creada",
    cell: (info) => new Date(info.getValue()).toLocaleDateString("es-MX"),
  }),
];

export function CompanyTable({ data }: { data: Company[] }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  if (data.length === 0) {
    return <p className="mt-8 text-sm text-neutral-500">Aún no hay empresas.</p>;
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

- [ ] **Step 4: Build the companies page (server component)**

Create `app/companies/page.tsx`:

```tsx
import { db } from "@/db/client";
import { listCompanies } from "@/db/companies";
import { CompanyTable } from "@/components/company-table";
import { NewCompanyForm } from "@/components/new-company-form";
import { signOut } from "@/app/login/actions";

export default async function CompaniesPage() {
  const companies = await listCompanies(db);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">Empresas</h1>
        <form action={signOut}>
          <button className="font-semibold text-sm underline">Salir</button>
        </form>
      </div>
      <NewCompanyForm />
      <CompanyTable data={companies} />
    </main>
  );
}
```

- [ ] **Step 5: Verify the full loop locally**

```bash
npm run dev
```

Log in → land on `/companies` → add "Mariscos del Golfo" via the form → Expected: the row appears in the table without a full reload; refreshing keeps it (persisted in Supabase); confirm the row exists in the Supabase Table editor. Click "Salir" → redirected to `/login`. Stop the dev server.

- [ ] **Step 6: Verify build, typecheck, tests**

```bash
npm run build && npx tsc --noEmit && npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: companies page with create form and TanStack table"
```

---

## Task 7: CI + Vercel deploy

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the whole app.
- Produces: green CI on push + a deployed Vercel URL meeting the Definition of Done.

- [ ] **Step 1: Add the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-anon-key
          DATABASE_URL: postgres://user:pass@localhost:6543/postgres
          DIRECT_URL: postgres://user:pass@localhost:5432/postgres
```

> The build env vars are dummy placeholders so `next build` can statically compile; nothing in the build connects to the DB. Tests use PGlite and need no env vars.

- [ ] **Step 2: Verify CI passes locally (same commands)**

```bash
npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build
```

Expected: all succeed.

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "ci: lint, typecheck, test, build on push"
git push
```

Confirm the GitHub Actions run is green.

- [ ] **Step 4: Provision Vercel and connect the repo**

In the Vercel dashboard: create a new project from this Git repository (framework auto-detected as Next.js). Do **not** deploy yet — set env vars first.

- [ ] **Step 5: Set Vercel environment variables**

Add to the Vercel project (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (pooler, port 6543), `DIRECT_URL` (direct, port 5432) — the real Supabase values from your `.env.local`.

- [ ] **Step 6: Deploy**

Trigger the deploy (push to the default branch or click Deploy). Expected: build succeeds and a production URL is issued.

- [ ] **Step 7: Verify the Definition of Done on the live URL**

On the deployed Vercel URL:

1. Visit `/companies` logged out → redirected to `/login`.
2. Log in with the Supabase test user → land on `/companies`.
3. Create a company → it appears in the list and persists (visible in Supabase Table editor).
4. GitHub Actions for this commit is green.

If all four hold, the walking skeleton is complete.

- [ ] **Step 8: Final commit (if any config changed)**

```bash
git add -A
git commit -m "chore: vercel deploy config" --allow-empty
git push
```

---

## Self-Review Notes

- **Spec coverage:** §4 scaffold+design system → Task 1. §5 schema/connections/migrations → Task 2. §7 data flow (create+list) → Tasks 3, 4, 6. §6 auth → Task 5. §8 error handling → Task 1 (`error.tsx`) + Task 4 (typed action results). §9 testing (PGlite, create+list tests) → Tasks 2–4. §10 deploy + CI → Task 7. §11 Definition of Done → Task 7 Step 7.
- **Type consistency:** `AnyDb` defined in `test/db.ts` and consumed by `db/companies.ts` (Task 3) with a note offering to relocate it to `db/schema.ts`. `ActionResult` defined in `app/companies/actions.ts` (Task 4) and consumed by `components/new-company-form.tsx` (Task 6). `Company` from `db/schema.ts` used by the data layer and table. `createCompany(db, { name })` / `listCompanies(db)` signatures identical across Tasks 3, 4, 6.
- **Deferred-then-resolved:** the spec's open "test DB" choice is resolved to PGlite in Task 2.
```
