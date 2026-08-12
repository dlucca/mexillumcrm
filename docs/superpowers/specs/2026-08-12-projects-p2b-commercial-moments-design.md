# Projects P2b — Momentos comerciales + automatización de status: Design

**Fecha:** 2026-08-12
**Slice:** Projects P2b (segundo sub-slice de P2 — sobre la base de Activities de P2a)
**PRD ancla:** §8.3 (reglas de etapa — momentos comerciales), §8.4 (status desacoplado, automatizaciones), §9.6 (flujo propuesta enviada)

## Contexto

P2a dejó la entidad Activity, la timeline en `/projects/[id]`, la nota manual y el
`stage_change` automático inmutable al cambiar la etapa (todo dentro de una transacción
en `runUpdateProject`). P2b completa las **reglas de etapa** que faltaban:

- **§8.3 momentos comerciales:** al entrar a ciertas etapas se crea —además del
  `stage_change`— una Activity con timestamp propio, para métricas de conversión/tiempo:
  `proposal` (enviada), `proposal` (aceptada), `contract` (enviado), `contract` (firmado).
- **§8.4 automatización de status:** al alcanzar *Contrato firmado* → `status = won`;
  al alcanzar *Cliente activo* → `status = active_customer`. (`lost`/`paused` siguen
  manuales; `status` sigue desacoplado de `stage`.)

Ambos mecanismos viven sobre el mismo path que ya existe (la transición de etapa dentro
de `runUpdateProject`). **No hay tabla ni migración nueva, ni componentes UI nuevos.**

### Decisiones de alcance (brainstorming)

- **Bundle:** ambos mecanismos en un solo slice P2b (comparten el path de transición).
- **Disparo:** en CADA transición que ENTRA a la etapa gatillo (`oldStage !== newStage`
  && nueva etapa es gatillo). Sin deduplicar por historial — consistente con
  `stage_change`. La deduplicación para métricas vive en el slice de reportes (§10.8).
- **Auto-status:** al entrar a la etapa gatillo, la automatización FUERZA el status
  (won/active_customer), pisando el status enviado en esa transición (normalmente el form
  manda `open`). Fuera de la transición de entrada, el status enviado se respeta (edición
  manual libre). Mover la etapa hacia atrás NO revierte el status.
- **Subtipo del momento:** el `type` de la Activity es `proposal`/`contract` (§7.4) y el
  subtipo va en `metadata.moment` (`sent`/`accepted`/`signed`). Así el filtro por tipo
  agrupa las dos propuestas juntas y los dos de contrato juntos.

## 1. Reglas puras nuevas (mapas stage→X)

### 1.1 `lib/project-pipeline.ts` — `autoStatusForStage`

Junto a `stageGroupFor` / `STAGE_TO_GROUP`:

```ts
const STAGE_TO_AUTO_STATUS: Record<string, string> = {
  contrato_firmado: "won",
  cliente_activo: "active_customer",
};

export function autoStatusForStage(stage: string): string | null {
  return STAGE_TO_AUTO_STATUS[stage] ?? null;
}
```

Los valores `won`/`active_customer` ya existen en `STATUSES` (P1). Sin cambios de enum.

### 1.2 `lib/activity-log.ts` — `commercialMomentForStage` + headline

```ts
export type CommercialMoment = { type: "proposal" | "contract"; moment: "sent" | "accepted" | "signed" };
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
```

Extender `activityHeadline` para `proposal`/`contract` (leyendo `metadata.moment`):

- `proposal` + `sent` → "Propuesta enviada"
- `proposal` + `accepted` → "Propuesta aceptada"
- `contract` + `sent` → "Contrato enviado"
- `contract` + `signed` → "Contrato firmado"

Fallback (metadata ausente/desconocida): el label del tipo (`activityTypeLabel`).
Implementación sugerida: un helper `commercialMomentLabel(type, moment)` puro, invocado
desde `activityHeadline` cuando `type` es `proposal`/`contract` y hay `metadata.moment`.

> Nota de independencia de los mapas: `contrato_firmado` aparece en AMBOS mapas (momento
> `contract`/`signed` **y** auto-status `won`). `cliente_activo` aparece solo en el mapa de
> status (sin momento). Son mapas independientes; no se derivan uno del otro.

## 2. Extensión de `runUpdateProject` (`lib/project-mutations.ts`)

Se modifica SOLO el bloque de la transición de entrada dentro de la transacción existente.
Estructura resultante (pseudo-diff sobre el código actual):

```ts
const result = await db.transaction(async (tx): Promise<ActionResult> => {
  const [current] = await tx
    .select({ stage: projects.stage, companyId: projects.companyId })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!current) return { ok: false, error: "No se encontró el proyecto" };

  const isEntry = current.stage !== fields.stage;
  const autoStatus = isEntry ? autoStatusForStage(fields.stage) : null;
  const effectiveFields = autoStatus ? { ...fields, status: autoStatus } : fields;

  await tx.update(projects).set(effectiveFields).where(eq(projects.id, id));

  if (isEntry) {
    await tx.insert(activities).values({
      companyId: current.companyId, projectId: id, userId: actorUserId,
      type: "stage_change", direction: "none", subject: null, body: null,
      source: "system", metadata: activityLog.stageChangeMetadata(current.stage, fields.stage),
    });
    const moment = activityLog.commercialMomentForStage(fields.stage);
    if (moment) {
      await tx.insert(activities).values({
        companyId: current.companyId, projectId: id, userId: actorUserId,
        type: moment.type, direction: "none", subject: null, body: null,
        source: "system", metadata: { moment: moment.moment },
      });
    }
  }
  return { ok: true };
});
```

- `autoStatusForStage` se importa desde `@/lib/project-pipeline` (junto a `stageGroupFor`).
- `commercialMomentForStage` se usa vía el namespace `activityLog` ya importado.
- El outer `try/catch` (rollback → "No se pudo actualizar el proyecto") no cambia.
- Sin cambio de etapa → `isEntry=false` → ni auto-status ni momentos; `effectiveFields=fields`
  (status enviado respetado).
- Mover hacia atrás → `isEntry=true` pero `autoStatusForStage` devuelve null para etapas
  anteriores → sin revert.

> Interacción con `projectUpdateSchema.refine` (status=lost exige lostReason): la
> automatización solo produce `won`/`active_customer`, nunca `lost`, así que no colisiona.
> El form normalmente manda `status="open"` al mover la etapa, que valida OK antes de que
> la automatización lo pise.

## 3. UI

Ninguna pieza nueva:
- La timeline (`components/activity-timeline.tsx`) ya renderiza cualquier Activity vía
  `activityHeadline`, que extendemos para `proposal`/`contract`.
- El filtro (`components/activity-filter.tsx`) ya lista los 12 tipos, incluidos
  `proposal`/`contract`.
- El `status=won`/`active_customer` auto-seteado se refleja en `ProjectDetailForm` porque
  ese form hace `router.refresh()` en cada guardado (patrón P2a).

## 4. Tests (Vitest + PGlite, TDD — test primero)

**Puros:**
- `autoStatusForStage`: `contrato_firmado→won`, `cliente_activo→active_customer`, otras→null.
- `commercialMomentForStage`: las 4 etapas gatillo → el `{type,moment}` correcto; otras→null.
- `activityHeadline`: las 4 combinaciones (proposal sent/accepted, contract sent/signed) →
  label español correcto; fallback sin metadata → label del tipo.

**Glue `runUpdateProject` (PGlite):**
- Entrar a `propuesta_enviada` → 1 `stage_change` + 1 `proposal` con `metadata.moment="sent"`;
  status = el enviado (p.ej. open).
- Entrar a `propuesta_aceptada` → `proposal` con `moment="accepted"`.
- Entrar a `contrato_enviado` → `contract` con `moment="sent"`; status enviado respetado.
- Entrar a `contrato_firmado` (form manda `status="open"`) → `contract`/`signed` **y**
  el proyecto queda `status="won"`.
- Entrar a `cliente_activo` → proyecto queda `status="active_customer"` y **NO** hay
  Activity de momento (solo `stage_change`).
- Entrar a una etapa no-gatillo → solo `stage_change`, sin momento, status enviado respetado.
- Guardar SIN cambio de etapa (p.ej. cambiar `estimatedValue` y mandar `status="paused"`
  en un proyecto ya `won`) → sin momento, sin auto-status; `status="paused"` respetado.
- Re-entrar a `propuesta_enviada` (entrar, salir a otra etapa, volver a entrar) → se crea
  un segundo `proposal`/`sent` (disparo en cada entrada).
- Mover de `contrato_firmado` (won) a una etapa anterior con `status="won"` enviado →
  status queda `won` (sin revert), sin nuevo momento.

## 5. Postura de seguridad (sin cambios)

No toca RLS ni ownership. `runUpdateProject` sigue scopeando por `id`. Todo se cierra en
el slice de RLS.

## Fuera de alcance (después)

- Datos técnicos mínimos + compuerta que impide avanzar a "Propuesta en preparación"
  sin ellos (§8.3, §10.7).
- Gate a "Propuesta enviada" sin Contact principal (§8.3, depende de ProjectContacts §7.5).
- Deduplicación de momentos para métricas (vive en reportes §10.8).
- P3 Tasks + Next Action, P4 Kanban, RLS/ownership.
