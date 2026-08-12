# Spec: Housekeeping (higiene post-walking-skeleton)

**Fecha:** 2026-08-12
**Slice:** limpieza de pendientes diferidos del skeleton
**Estado:** Aprobado (brainstorming)

## Objetivo

Dejar una base limpia antes de crecer con Contacts/Projects: eliminar la página
dev, encaminar `/` a la app real, evitar que usuarios autenticados vean `/login`,
y quitar código muerto.

## Cambios

### 1. `/` → `/companies`
Reemplazar `app/page.tsx` (hoy la página dev "Walking Skeleton") por un
`redirect("/companies")` server-side. Los no-autenticados igual caen en `/login`
porque el middleware los gatea antes de renderizar la página.

### 2. Sacar usuarios autenticados de `/login`
Hoy un usuario logueado que va a `/login` ve el formulario. Añadir al middleware:
autenticado + en `/login` → redirect a `/companies`.

Para hacerlo **testeable (TDD)**, extraer la decisión de ruteo a una función pura
en `lib/supabase/auth-redirect.ts`:

```ts
export function authRedirectTarget(pathname: string, isAuthed: boolean): string | null
```

Reglas:
- `!isAuthed` y NO en `/login` → `"/login"`
- `isAuthed` y en `/login` → `"/companies"`
- en cualquier otro caso → `null`

El middleware usa esta función y, al redirigir, **preserva las cookies de sesión
refrescadas** copiándolas de `supabaseResponse` a la respuesta de redirect (cierra
el pendiente diferido de preservación de cookies en redirects autenticados).

### 3. Borrar código muerto
Eliminar `components/ui/button.tsx` (cero imports, confirmado) y el directorio
`components/ui/` si queda vacío.

## Tests (TDD)

`test/auth-redirect.test.ts` cubre `authRedirectTarget`:
- no-auth en `/companies` → `/login`
- no-auth en `/login` → `null`
- auth en `/login` → `/companies`
- auth en `/companies` → `null`
- no-auth en `/` → `/login`
- auth en `/` → `null` (la raíz la maneja el redirect de la página)

## Verificación

Suite verde, `tsc`/`lint`/`build` limpios. El comportamiento del middleware
(redirects en vivo, preservación de sesión) lo verifica el usuario en prod.

## Fuera de alcance

Cualquier cambio de auth más allá de estos redirects (roles, RLS por-usuario).
