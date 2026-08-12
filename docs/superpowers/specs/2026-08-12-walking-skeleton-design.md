# Design: Mexillum CRM — Walking Skeleton

**Date:** 2026-08-12
**Status:** Approved, ready for implementation planning
**Source of truth for product scope:** [`docs/mexillum-crm-prd-final.md`](../../mexillum-crm-prd-final.md)

## 1. Goal

Prove the entire chosen stack end-to-end through the thinnest possible feature: **list + create Companies**, behind a login gate, deployed to Vercel, with a passing test.

The stack path this de-risks:

```
Next.js App Router → Supabase Auth session → Drizzle → Supabase Postgres → UI → Vercel deploy → passing CI test
```

The skeleton exists to make every later feature slice ride on proven rails: DB connection, auth session handling in the App Router, migrations, the design system, the test harness, and the deploy pipeline are all working before any real feature is built.

## 2. Non-goals (deferred to later slices)

- Roles / permissions (Admin, Manager, Sales, Engineering)
- Contacts, Projects, ProjectContacts, Activities, Tasks, pipeline / Kanban
- Company **edit** and **archive** UI
- `owner_user_id` population and a `public.users` table
- Supabase Storage, documents
- Any integration (Gmail, cal.com, diagnostics)

## 3. Anchoring decisions (settled during brainstorming)

| Decision | Choice |
|---|---|
| First-slice outcome | Thinnest end-to-end walking skeleton |
| Anchor entity | **Companies** (zero outbound required FKs) |
| CRUD depth | **List + Create** only |
| Auth | **Real** Supabase Auth, minimal (login gate, **no roles**) |
| Infra state | Supabase project **exists** (keys provided); **Vercel set up** in this slice |
| Testing | Test harness included; **TDD always** (test-first) |
| Tailwind | **v4** (kit is v4-first; matches `create-next-app` default). `tailwind.config.v3.ts` becomes moot. |

## 4. Architecture & scaffold

- `create-next-app` (TypeScript, Tailwind v4, App Router, ESLint) into the repo root, alongside existing `docs/`.
- shadcn/ui initialized. Font mapping per the typography kit: `font-sans → Barlow`, `font-mono → JetBrains Mono`, `font-display → Barlow Condensed`.
- Design system wired from day one:
  - `app/fonts.ts` from `docs/typography-kit/fonts.ts`.
  - `app/globals.css` = merge of `docs/typography-kit/globals.css` + `docs/color-kit/globals.color.css`.
  - Font variables applied to `<html>` per `docs/typography-kit/layout.snippet.tsx`.
  - Result: the skeleton already looks like Mexillum, not default shadcn.
- Directory shape:
  - `app/` — routes (`/login`, `/companies`), `layout.tsx`, `globals.css`, `fonts.ts`, `error.tsx`.
  - `db/` — Drizzle schema, client, `migrations/`.
  - `lib/` — Supabase server/client helpers.
  - `components/` — UI (table, form, shadcn primitives).

## 5. Data & schema (Drizzle → Supabase Postgres)

One migration creating the **real** `companies` table per PRD §7.1 (not a throwaway):

| Column | Notes |
|---|---|
| `id` | uuid, default generated, PK |
| `name` | **NOT NULL** |
| `legal_name` | nullable |
| `industry` | nullable |
| `company_type` | nullable |
| `website` | nullable |
| `tax_id` | nullable (RFC) |
| `headquarters_location` | nullable |
| `size_segment` | nullable |
| `notes` | nullable |
| `owner_user_id` | nullable, **unused this slice** |
| `archived_at` | nullable (soft delete) |
| `created_at` | timestamptz, default now |
| `updated_at` | timestamptz, default now |

- Indexes on `owner_user_id` and `archived_at` (per PRD §15.2).
- Timestamps `timestamptz`, base `America/Mexico_City`.

**Connections** (standard Supabase + serverless pattern):

- **Pooler**, transaction mode (`:6543`) — runtime queries from server actions.
- **Direct** (`:5432`) — `drizzle-kit` migrations.
- Both supplied via env vars.

Drizzle migrations are the source of truth: `drizzle-kit generate` + `migrate`, versioned in `db/migrations/`.

## 6. Auth

- `@supabase/ssr` — cookie-based sessions that work in server components.
- `middleware.ts` refreshes the session and protects app routes; unauthenticated requests redirect to `/login`.
- `/login` — email + password via Supabase Auth. A logged-in user reaches `/companies`; a logged-out one cannot.
- Sign-out server action closes the loop.
- No roles, no `public.users` table in this slice.

## 7. Companies slice + data flow

- `/companies` (server component) → reads non-archived companies via Drizzle → renders with **TanStack Table**, styled with the design system.
- "New company" → form → **server action** → **Zod**-validate (`name` required) → Drizzle insert → `revalidatePath('/companies')` → new row appears.

**TDD order (test-first, per standing rule):**

1. Failing test for the create-company server action (Zod validation + insert against a test database). Watch it fail.
2. Implement the action until green.
3. Failing test for the list query (returns non-archived companies). Implement until green.
4. Wire the UI (table + form) after the write/read paths are green.

## 8. Error handling

- Server actions return a typed result `{ ok: true, data } | { ok: false, error }` — no throwing across the action boundary.
- The form renders validation errors and a submit-failure state.
- Route-level `app/error.tsx` for unexpected render/data errors.

## 9. Testing

- **Vitest** harness.
- Tests run against a **real Postgres** (local throwaway DB or a dedicated Supabase test schema — final choice made in the plan).
- Minimum coverage this slice: one create-path test + one list-path test.
- CI runs `vitest` + `tsc --noEmit` + `lint` on push.

## 10. Deploy

- Push to Vercel; set env vars: Supabase URL, anon key, pooler DB URL, direct DB URL.
- Confirm the deployed app gates login and creates/lists a company against Supabase.
- CI (GitHub) green before merge.

## 11. Definition of done

On the deployed Vercel URL:

1. `/companies` is **not** reachable when logged out (redirects to `/login`).
2. You can log in with a Supabase Auth user.
3. You can create a company; it persists in Supabase.
4. The company appears in the list.
5. `vitest` + typecheck + lint are green in CI.

## 12. What the next slice inherits

Proven and reusable: DB connection + migration workflow, App Router auth session, the Mexillum design system, the Vitest/TDD harness, and the Vercel deploy pipeline. The next natural slice is **full Companies CRUD** (edit + archive) or the **Contacts/Projects** data spine, built on these rails.
