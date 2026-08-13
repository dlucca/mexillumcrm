# Editar / Eliminar (borrado permanente) en listas de Empresas y Proyectos — Design

Fecha: 2026-08-12
Rama: `feat/delete-company-project`
PRD: §10.1/§10.3 (CRUD Companies/Projects), §12.2 (auditoría — nota abajo), §15.1 (relaciones).

## Contexto y alcance

Pedido: en `/companies`, por fila, un botón **Editar** y un botón **Eliminar** empresa; eliminar
una empresa borra también sus proyectos. En `/projects`, por fila, **Editar** y **Eliminar** el
proyecto individualmente.

Decisiones (del brainstorming):
- **Archivar (soft-delete) se mantiene tal cual** — reversible, en el detalle + "Restaurar" en la
  vista de archivados. NO se toca.
- **Se agrega un borrado permanente (hard delete) en cascada**, botón "Eliminar" separado, con
  **confirmación por AlertDialog de shadcn** que **muestra el conteo real** de lo que se borrará.
  Irreversible.
- **"Editar" = link** a la página de detalle (que ya es editable). No es edición inline.

### Fuera de alcance
- Ownership/permisos sobre el borrado (misma postura del resto: scoping por id, sin verificación
  de owner; el slice de RLS/ownership es aparte).
- Restaurar en la lista de proyectos (hoy no existe; no se agrega acá).
- Papelera / undo del borrado permanente (es permanente por diseño).

### Nota §12.2 (auditoría)
El borrado permanente elimina también las `activities` (registro histórico append-only). Es una
consecuencia aceptada del hard delete que el usuario pidió explícitamente; cuando exista el
`audit_log` dedicado (slice futuro), el evento de borrado quedará ahí, fuera de la fila borrada.

## Arquitectura

Sin cambio de schema → **sin migración**. Los FKs (`contacts.companyId`, `projects.companyId`,
`activities.companyId`/`projectId`, `tasks.companyId`/`projectId`) NO tienen `ON DELETE CASCADE`,
así que la cascada es **a nivel app, transaccional**, borrando hijos antes que padres. Sigue el
patrón del repo (capa pura sobre `AnyDb` + `db.transaction`, rollback probado con spy).

### Mutaciones puras

`lib/company-mutations.ts` → `runDeleteCompany(db, id)`:
```ts
export async function runDeleteCompany(db: AnyDb, id: string): Promise<ActionResult>;
// transacción; si la empresa no existe → { ok:false, error:"No se encontró la empresa" }.
// Orden (hijos→padres, todo por companyId salvo la company por id):
//   delete tasks      where companyId = id
//   delete activities where companyId = id
//   delete contacts   where companyId = id
//   delete projects   where companyId = id
//   delete companies  where id = id
// throw dentro de la tx → rollback total (nada se borra) → { ok:false, error:"No se pudo eliminar la empresa" }.
```

`lib/project-mutations.ts` → `runDeleteProject(db, id)`:
```ts
export async function runDeleteProject(db: AnyDb, id: string): Promise<ActionResult>;
// transacción; si el proyecto no existe → { ok:false, error:"No se encontró el proyecto" }.
// Orden:
//   delete tasks      where projectId = id
//   delete activities where projectId = id
//   delete projects   where id = id
// (los contacts son de la empresa; NO se tocan). Rollback igual que arriba.
```

`activities` y `tasks` tienen `companyId` y `projectId` (ambos notNull), así que borrar por
`companyId` cubre todas las de la empresa, y por `projectId` todas las del proyecto.

### Server actions
- `app/companies/[id]/actions.ts` → `deleteCompanyAction(formData)`: lee `id`, `runDeleteCompany`,
  `revalidatePath("/companies")`, `revalidatePath("/dashboard")`, `revalidatePath("/pipeline")`.
- `app/projects/actions.ts` → `deleteProjectAction(formData)`: lee `id`, `runDeleteProject`,
  `revalidatePath("/projects")`, `revalidatePath("/dashboard")`, `revalidatePath("/pipeline")`.
- Firma `(formData: FormData) => Promise<void>` (como `archiveProjectAction`/`restoreCompanyAction`).

### Queries de lista con conteos (para el AlertDialog)

Solo para las páginas de lista; NO se toca `listAllProjects` (que usan pipeline/dashboard/my-actions
y deben quedar livianas).

`db/companies.ts` → `listCompaniesWithProjectCount(db, {archived})`:
```ts
export type CompanyListRow = Company & { projectCount: number };
// count de TODOS los proyectos de la empresa (incl. archivados — el hard delete los borra todos).
// leftJoin projects on projects.companyId = companies.id; groupBy(companies.id);
// projectCount = count(distinct projects.id) mapWith(Number). Filtro archived aplica a companies.
```

`db/projects.ts` → `listAllProjectsWithCounts(db, {archived})`:
```ts
export type ProjectCountRow = ProjectListRow & { activityCount: number; taskCount: number };
// innerJoin companies (companyName) + leftJoin activities + leftJoin tasks;
// count(distinct activities.id) / count(distinct tasks.id) mapWith(Number) (distinct evita el fan-out
// del doble leftJoin). groupBy(projects.id, companies.name). Filtro archived aplica a projects.
```

## UI

### shadcn AlertDialog
- `npx shadcn@latest add alert-dialog` → genera `components/ui/alert-dialog.tsx` (instala
  `@radix-ui/react-alert-dialog`).

### Componente reutilizable `components/delete-entity-dialog.tsx` (client)
```ts
export function DeleteEntityDialog(props: {
  id: string;
  action: (formData: FormData) => Promise<void>; // server action
  title: string;
  description: string; // incluye el conteo, lo arma el caller
}): JSX.Element;
```
Estructura: `AlertDialogTrigger` = botón "Eliminar" (`text-danger`, tokens del design system) →
`AlertDialogContent` con `title` + `description`, `AlertDialogCancel` ("Cancelar") y, dentro de un
`<form action={action}>` con `<input type="hidden" name="id">`, un `AlertDialogAction type="submit"`
("Eliminar"). Cancelar cierra sin efecto; Eliminar dispara la server action.

### Tablas (columna de acciones)
- **`CompanyTable`** (`data: CompanyListRow[]`): agrega columna de acciones.
  - Fila activa: **Editar** (`<Link href="/companies/{id}">`) + `DeleteEntityDialog`.
  - Fila archivada: **Restaurar** (existente) + `DeleteEntityDialog` (purga permanente).
  - Description empresa: `Se eliminará permanentemente «{name}» y sus {projectCount} proyecto(s),
    con sus contactos, actividades y tareas. Esta acción no se puede deshacer.` (pluraliza
    proyecto/proyectos).
- **`ProjectTable`** (`data: ProjectCountRow[]`): agrega columna de acciones.
  - Fila activa: **Editar** (`<Link href="/projects/{id}">`) + `DeleteEntityDialog`.
  - Fila archivada: `DeleteEntityDialog` (sin Editar).
  - Description proyecto: `Se eliminará permanentemente «{name}» y sus {activityCount} actividad(es)
    y {taskCount} tarea(s). Esta acción no se puede deshacer.` (pluraliza).

### Páginas
- `app/companies/page.tsx`: usa `listCompaniesWithProjectCount` (en vez de `listCompanies`).
- `app/projects/page.tsx`: usa `listAllProjectsWithCounts` (en vez de `listAllProjects`).

Tokens del design system en todo lo nuevo/tocado (botón Eliminar en `text-danger`; el resto de la
tabla ya usa sus estilos). Copy en español.

## Manejo de errores / bordes
- Borrar algo inexistente (id ya borrado) → `{ ok:false }` con mensaje; la action revalida igual
  (la lista se refresca y la fila desaparece). No 500.
- Falla en medio de la cascada → rollback total (transacción); nada queda a medias.
- Doble click / doble submit → la segunda corrida no encuentra la fila → no-op seguro.
- Conteos = 0 → copy "…y sus 0 proyectos…" es válido (o pluralización a "proyectos").

## Testing (TDD — Vitest + PGlite in-process)
- `runDeleteCompany`: borra la empresa + sus proyectos + activities + tasks + contacts; **scoping**
  (una segunda empresa con sus datos queda intacta); empresa inexistente → error.
- `runDeleteProject`: borra el proyecto + sus activities + tasks; NO toca otros proyectos ni los
  contacts de la empresa; inexistente → error.
- Atomicidad: garantizada por `db.transaction` (patrón ya probado en el repo). No se testea con un
  seam artificial porque el borrado sólo hace `tx.delete(...)` sin helper puro intermedio que
  espiar; completitud + scoping cubren que no queden huérfanos.
- `listCompaniesWithProjectCount`: projectCount correcto (incl. proyectos archivados); empresa sin
  proyectos → 0.
- `listAllProjectsWithCounts`: activityCount/taskCount correctos; sin hijos → 0; el doble join no
  infla los conteos (verifica un proyecto con varias activities y varias tasks a la vez).
- Dialog/tablas/páginas: sin unit test (client/SSR presentacional); gate = build + lint + suite
  completa `npm test -- --no-file-parallelism`.

## Entrega
- Rama `feat/delete-company-project`, merge `--no-ff` a `main` + push.
- **Sin migración** (borrado a nivel app; no cambia schema). Se agrega `@radix-ui/react-alert-dialog`
  a `package.json` (Vercel lo instala en build).
- Ledger en `.superpowers/sdd/progress.md`.
- Ejecución: subagent-driven-development.

## Gaps conocidos que quedan
- `audit_log` del borrado (§12.2) → con el slice de audit/settings.
- Ownership sobre el borrado → con el slice de RLS.
