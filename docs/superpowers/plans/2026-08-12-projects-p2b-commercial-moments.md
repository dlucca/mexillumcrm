# Projects P2b — Momentos comerciales + automatización de status: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al entrar a etapas gatillo, `runUpdateProject` registra —además del `stage_change`— una Activity de momento comercial (`proposal`/`contract` con subtipo en `metadata.moment`) y fuerza el `status` (won/active_customer) cuando corresponde, todo en la misma transacción.

**Architecture:** Extensión pura del path existente. Dos mapas puros nuevos (stage→auto-status en `project-pipeline.ts`, stage→momento comercial en `activity-log.ts`), extensión de `activityHeadline`, y ampliación del bloque de transición dentro de `runUpdateProject`. Sin tabla, sin migración, sin componentes UI nuevos.

**Tech Stack:** Drizzle ORM (Postgres/Supabase, PGlite in-process en tests), Zod, Vitest, Next.js 15 App Router, TypeScript.

## Global Constraints

- **TDD siempre**: test primero, verlo fallar, implementar mínimo, verlo pasar, commit.
- **Enums = constantes + columnas `text`** (NO pgEnum). Los valores `won`/`active_customer` ya existen en `STATUSES`; `proposal`/`contract` ya existen en `ACTIVITY_TYPES`. No se agregan enums.
- **Inmutabilidad**: las Activities siguen append-only; no se agrega update/delete.
- **Disparo en cada entrada**: los momentos y el auto-status disparan cuando `current.stage !== fields.stage` && la nueva etapa es gatillo. Sin deduplicar por historial.
- **Auto-status**: al ENTRAR a la etapa gatillo, la automatización pisa el status enviado (won/active_customer). Fuera de la transición de entrada, el status enviado se respeta. NO se revierte al mover hacia atrás.
- **Subtipo del momento** en `metadata.moment` (`sent`/`accepted`/`signed`); el `type` de la Activity es `proposal`/`contract`.
- **Transacción**: toda la lógica vive dentro de la `db.transaction` ya existente en `runUpdateProject`; el outer try/catch (→ "No se pudo actualizar el proyecto") no cambia.
- **Sin migración, sin schema change, sin componentes UI nuevos.**
- **UI copy en español.**
- **Tests**: `npm test -- <patrón>` para focalizados (fiable). La suite completa `npm test` es flaky en esta máquina por PGlite file-parallelism (pre-existente/ambiental); si se necesita la suite entera, correr `npm test -- --no-file-parallelism`.

---

### Task 1: `autoStatusForStage` (`lib/project-pipeline.ts`)

**Files:**
- Modify: `lib/project-pipeline.ts` (añadir mapa + función al final)
- Test: `test/project-pipeline.test.ts` (añadir describe)

**Interfaces:**
- Produces: `autoStatusForStage(stage: string): string | null`.

- [ ] **Step 1: Write the failing test**

Añadir a `test/project-pipeline.test.ts`:

```ts
import { autoStatusForStage } from "@/lib/project-pipeline";

describe("autoStatusForStage", () => {
  it("contrato_firmado → won", () => {
    expect(autoStatusForStage("contrato_firmado")).toBe("won");
  });
  it("cliente_activo → active_customer", () => {
    expect(autoStatusForStage("cliente_activo")).toBe("active_customer");
  });
  it("otras etapas → null", () => {
    expect(autoStatusForStage("lead_sin_contactar")).toBeNull();
    expect(autoStatusForStage("propuesta_enviada")).toBeNull();
    expect(autoStatusForStage("contrato_enviado")).toBeNull();
  });
});
```

Si `test/project-pipeline.test.ts` ya importa desde `@/lib/project-pipeline`, mergear el named import `autoStatusForStage` sin duplicar la línea de import.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- project-pipeline`
Expected: FAIL (no export `autoStatusForStage`).

- [ ] **Step 3: Implement en `lib/project-pipeline.ts`**

Añadir después de `stageGroupFor` (después de la línea que cierra esa función):

```ts
const STAGE_TO_AUTO_STATUS: Record<string, string> = {
  contrato_firmado: "won",
  cliente_activo: "active_customer",
};

export function autoStatusForStage(stage: string): string | null {
  return STAGE_TO_AUTO_STATUS[stage] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- project-pipeline`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/project-pipeline.ts test/project-pipeline.test.ts
git commit -m "feat: autoStatusForStage (stage→won/active_customer)"
```

---

### Task 2: Momentos comerciales en `lib/activity-log.ts`

**Files:**
- Modify: `lib/activity-log.ts` (añadir tipos/mapa/funciones + extender `activityHeadline`)
- Test: `test/activity-log.test.ts` (añadir casos)

**Interfaces:**
- Produces:
  - `type CommercialMoment = { type: "proposal" | "contract"; moment: "sent" | "accepted" | "signed" }`
  - `type CommercialMomentMetadata = { moment: "sent" | "accepted" | "signed" }`
  - `commercialMomentForStage(stage: string): CommercialMoment | null`
  - `commercialMomentLabel(type: string, moment: string): string`
  - `activityHeadline` ahora resuelve `proposal`/`contract` (leyendo `metadata.moment`).

- [ ] **Step 1: Write the failing test**

Añadir a `test/activity-log.test.ts`:

```ts
import {
  commercialMomentForStage,
  commercialMomentLabel,
} from "@/lib/activity-log";

describe("commercialMomentForStage", () => {
  it("mapea las 4 etapas gatillo", () => {
    expect(commercialMomentForStage("propuesta_enviada")).toEqual({ type: "proposal", moment: "sent" });
    expect(commercialMomentForStage("propuesta_aceptada")).toEqual({ type: "proposal", moment: "accepted" });
    expect(commercialMomentForStage("contrato_enviado")).toEqual({ type: "contract", moment: "sent" });
    expect(commercialMomentForStage("contrato_firmado")).toEqual({ type: "contract", moment: "signed" });
  });
  it("otras etapas → null", () => {
    expect(commercialMomentForStage("lead_sin_contactar")).toBeNull();
    expect(commercialMomentForStage("cliente_activo")).toBeNull();
  });
});

describe("commercialMomentLabel", () => {
  it("labels español por (type, moment)", () => {
    expect(commercialMomentLabel("proposal", "sent")).toBe("Propuesta enviada");
    expect(commercialMomentLabel("proposal", "accepted")).toBe("Propuesta aceptada");
    expect(commercialMomentLabel("contract", "sent")).toBe("Contrato enviado");
    expect(commercialMomentLabel("contract", "signed")).toBe("Contrato firmado");
  });
  it("combinación desconocida → label del tipo", () => {
    expect(commercialMomentLabel("proposal", "signed")).toBe("Propuesta");
  });
});
```

Y añadir a los casos de `activityHeadline` (dentro del `describe("activity-log helpers")` existente, o un nuevo `it`):

```ts
  it("activityHeadline para momentos comerciales", () => {
    expect(activityHeadline({ type: "proposal", body: null, metadata: { moment: "sent" } })).toBe("Propuesta enviada");
    expect(activityHeadline({ type: "contract", body: null, metadata: { moment: "signed" } })).toBe("Contrato firmado");
  });
  it("activityHeadline sin metadata cae al label del tipo", () => {
    expect(activityHeadline({ type: "proposal", body: null, metadata: null })).toBe("Propuesta");
  });
```

(Asegurarse de que `activityHeadline` esté importado en el archivo de test — ya lo está por los tests de P2a.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- activity-log`
Expected: FAIL (no exports `commercialMomentForStage`/`commercialMomentLabel`; `activityHeadline` devuelve "Propuesta" en vez de "Propuesta enviada").

- [ ] **Step 3: Implement en `lib/activity-log.ts`**

Añadir después de `describeStageChange` (y antes de `activityTypeLabel`, o en cualquier punto del módulo tras `activityTypeLabel`; el orden no importa mientras estén definidas):

```ts
export type CommercialMoment = {
  type: "proposal" | "contract";
  moment: "sent" | "accepted" | "signed";
};

export type CommercialMomentMetadata = { moment: "sent" | "accepted" | "signed" };

const STAGE_TO_COMMERCIAL_MOMENT: Record<string, CommercialMoment> = {
  propuesta_enviada: { type: "proposal", moment: "sent" },
  propuesta_aceptada: { type: "proposal", moment: "accepted" },
  contrato_enviado: { type: "contract", moment: "sent" },
  contrato_firmado: { type: "contract", moment: "signed" },
};

export function commercialMomentForStage(stage: string): CommercialMoment | null {
  return STAGE_TO_COMMERCIAL_MOMENT[stage] ?? null;
}

const COMMERCIAL_MOMENT_LABELS: Record<string, string> = {
  "proposal:sent": "Propuesta enviada",
  "proposal:accepted": "Propuesta aceptada",
  "contract:sent": "Contrato enviado",
  "contract:signed": "Contrato firmado",
};

export function commercialMomentLabel(type: string, moment: string): string {
  return COMMERCIAL_MOMENT_LABELS[`${type}:${moment}`] ?? activityTypeLabel(type);
}
```

Extender `activityHeadline` agregando esta rama ANTES del `return activityTypeLabel(activity.type)` final:

```ts
  if (
    (activity.type === "proposal" || activity.type === "contract") &&
    activity.metadata
  ) {
    return commercialMomentLabel(
      activity.type,
      (activity.metadata as CommercialMomentMetadata).moment
    );
  }
```

Nota: `commercialMomentLabel` referencia `activityTypeLabel`; ambos viven en el mismo módulo, así que definí `commercialMomentLabel` después de `activityTypeLabel` (o dejá la referencia — al ser function declarations, el hoisting lo permite).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- activity-log`
Expected: PASS (nuevos + los de P2a).

- [ ] **Step 5: Commit**

```bash
git add lib/activity-log.ts test/activity-log.test.ts
git commit -m "feat: momentos comerciales en activity-log (map + labels + headline)"
```

---

### Task 3: `runUpdateProject` registra momentos comerciales + fuerza status

**Files:**
- Modify: `lib/project-mutations.ts` (`runUpdateProject`)
- Test: `test/project-mutations.test.ts` (añadir casos dentro de `describe("runUpdateProject")`)

**Interfaces:**
- Consumes: `autoStatusForStage` de `@/lib/project-pipeline`; `activityLog.commercialMomentForStage` (namespace `* as activityLog`, ya importado); `projects`/`activities`/`eq` (ya importados).
- Produces: `runUpdateProject` sin cambio de firma; en la transición de entrada, además del `stage_change`, inserta el momento comercial cuando aplica y fuerza el status vía `effectiveFields`.

- [ ] **Step 1: Write the failing tests**

Añadir a `test/project-mutations.test.ts` dentro del `describe("runUpdateProject")` (usa el `seed()` existente que crea un proyecto en `lead_sin_contactar`, status `open`). Al tope del archivo ya están importados `listActivitiesForProject`, `listAllProjects` y `formOf`.

```ts
  async function moveTo(db: AnyDbT, company: { id: string }, id: string, stage: string, status = "open") {
    return runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P", stage, status, solutionType: "unknown" })
    );
  }

  it("entrar a propuesta_enviada crea stage_change + proposal/sent, status queda open", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "propuesta_enviada");
    const acts = await listActivitiesForProject(db, id);
    const moments = acts.filter((a) => a.type === "proposal");
    expect(acts.filter((a) => a.type === "stage_change")).toHaveLength(1);
    expect(moments).toHaveLength(1);
    expect(moments[0].metadata).toEqual({ moment: "sent" });
    expect(moments[0].source).toBe("system");
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("open");
  });

  it("entrar a propuesta_aceptada crea proposal/accepted", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "propuesta_aceptada");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "proposal");
    expect(moments).toHaveLength(1);
    expect(moments[0].metadata).toEqual({ moment: "accepted" });
  });

  it("entrar a contrato_enviado crea contract/sent, status queda open", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "contrato_enviado");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "contract");
    expect(moments).toHaveLength(1);
    expect(moments[0].metadata).toEqual({ moment: "sent" });
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("open");
  });

  it("entrar a contrato_firmado crea contract/signed y fuerza status=won (form manda open)", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "contrato_firmado", "open");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "contract");
    expect(moments).toHaveLength(1);
    expect(moments[0].metadata).toEqual({ moment: "signed" });
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("won");
  });

  it("entrar a cliente_activo fuerza status=active_customer y NO crea momento", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "cliente_activo", "open");
    const acts = await listActivitiesForProject(db, id);
    expect(acts.filter((a) => a.type === "proposal" || a.type === "contract")).toHaveLength(0);
    expect(acts.filter((a) => a.type === "stage_change")).toHaveLength(1);
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("active_customer");
  });

  it("entrar a etapa no-gatillo → solo stage_change, sin momento, status respetado", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "webcall_discovery", "paused");
    const acts = await listActivitiesForProject(db, id);
    expect(acts.filter((a) => a.type === "proposal" || a.type === "contract")).toHaveLength(0);
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("paused");
  });

  it("guardar sin cambio de etapa no re-fuerza ni crea momento; status enviado respetado", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "contrato_firmado", "open"); // ahora won
    // segundo guardado: misma etapa, status manual paused
    await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P", stage: "contrato_firmado", status: "paused", solutionType: "unknown" })
    );
    const contracts = (await listActivitiesForProject(db, id)).filter((a) => a.type === "contract");
    expect(contracts).toHaveLength(1); // no se duplicó
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("paused"); // no re-forzado a won
  });

  it("re-entrar a propuesta_enviada dispara el momento otra vez", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "propuesta_enviada");
    await moveTo(db, company, id, "negociacion_objeciones");
    await moveTo(db, company, id, "propuesta_enviada");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "proposal");
    expect(moments).toHaveLength(2);
  });

  it("mover hacia atrás desde won no revierte el status", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "contrato_firmado", "open"); // won
    // el form mandaría el status actual (won) al mover la etapa
    await moveTo(db, company, id, "negociacion_objeciones", "won");
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("won");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "proposal" || a.type === "contract");
    expect(moments).toHaveLength(1); // solo el contract/signed original
  });
```

Al tope del archivo de test, añadir el tipo para el helper `moveTo` (importar `AnyDb` como `AnyDbT`):

```ts
import type { AnyDb as AnyDbT } from "@/db/types";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- project-mutations`
Expected: FAIL (no se crean momentos; status no se fuerza a won/active_customer).

- [ ] **Step 3: Implement en `lib/project-mutations.ts`**

Cambiar el import de `project-pipeline` para incluir `autoStatusForStage`:

```ts
import { stageGroupFor, autoStatusForStage } from "@/lib/project-pipeline";
```

Reemplazar el bloque de la transacción de `runUpdateProject` (desde `const [current] = ...` hasta `return { ok: true };`) por:

```ts
      const [current] = await tx
        .select({ stage: projects.stage, companyId: projects.companyId })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      if (!current) {
        return { ok: false, error: "No se encontró el proyecto" };
      }
      const isEntry = current.stage !== fields.stage;
      const autoStatus = isEntry ? autoStatusForStage(fields.stage) : null;
      const effectiveFields = autoStatus ? { ...fields, status: autoStatus } : fields;
      await tx.update(projects).set(effectiveFields).where(eq(projects.id, id));
      if (isEntry) {
        await tx.insert(activities).values({
          companyId: current.companyId,
          projectId: id,
          userId: actorUserId,
          type: "stage_change",
          direction: "none",
          subject: null,
          body: null,
          source: "system",
          metadata: activityLog.stageChangeMetadata(current.stage, fields.stage),
        });
        const moment = activityLog.commercialMomentForStage(fields.stage);
        if (moment) {
          await tx.insert(activities).values({
            companyId: current.companyId,
            projectId: id,
            userId: actorUserId,
            type: moment.type,
            direction: "none",
            subject: null,
            body: null,
            source: "system",
            metadata: { moment: moment.moment },
          });
        }
      }
      return { ok: true };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- project-mutations`
Expected: PASS (los 9 casos nuevos + los 12 existentes de P2a, incluidos "id inexistente", "status=lost", rollback y stage_change).

- [ ] **Step 5: Commit**

```bash
git add lib/project-mutations.ts test/project-mutations.test.ts
git commit -m "feat: runUpdateProject registra momentos comerciales y fuerza status won/active_customer"
```

---

### Task 4: Verificación final de rama

**Files:** ninguno (verificación).

- [ ] **Step 1: Suite completa + build + lint**

Run: `npm test -- --no-file-parallelism && npm run build && npm run lint`
Expected: todo verde (la suite completa serial evita la flakiness de PGlite file-parallelism).

- [ ] **Step 2: Confirmar sin drift de schema**

Run: `npm run db:generate`
Expected: "No schema changes, nothing to migrate" (P2b no toca el schema; NO debe generar una migración 0005). Si generara algo, es un bug — revisar.

---

## Self-Review

**Spec coverage (spec §→task):**
- §1.1 `autoStatusForStage` → Task 1. ✓
- §1.2 `commercialMomentForStage` + `CommercialMoment(Metadata)` + `activityHeadline` extendido + `commercialMomentLabel` → Task 2. ✓
- §2 extensión de `runUpdateProject` (isEntry, effectiveFields con auto-status, insert de momento) → Task 3. ✓
- §3 UI (sin piezas nuevas; headline extendido cubre el render; filtro ya soporta los tipos) → cubierto por Task 2 (headline) + verificación Task 4. ✓
- §4 tests → puros en Tasks 1/2, glue (9 casos) en Task 3. ✓
- §5 postura de seguridad (sin cambios) → ninguna task la toca; Task 4 confirma sin drift. ✓

**Placeholder scan:** sin TBD/TODO; todos los pasos con código o comando exacto. ✓

**Type consistency:** `CommercialMoment`/`CommercialMomentMetadata` (Task 2) consumidos por el insert en Task 3 (`metadata: { moment: moment.moment }`) y por `activityHeadline`; `autoStatusForStage` firma única (Task 1) usada en Task 3; `commercialMomentForStage` devuelve `{type, moment}` usado como `moment.type`/`moment.moment` en Task 3. ✓

**Scope:** un solo path (`runUpdateProject`) + dos helpers puros; enfocado para un solo plan. ✓

**Nota:** no hay migración ni componentes UI nuevos; el riesgo se concentra en el glue (Task 3), cubierto por 9 tests de comportamiento incluyendo re-entrada, no-revert y respeto del status en guardados sin transición.
