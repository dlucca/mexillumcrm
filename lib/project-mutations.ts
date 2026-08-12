import type { AnyDb } from "@/db/types";
import {
  type NewProjectInput,
  type ProjectUpdateFields,
} from "@/db/projects";
import { projects, activities } from "@/db/schema";
import { projectCreateSchema, projectUpdateSchema } from "@/lib/validation";
import { stageGroupFor, autoStatusForStage } from "@/lib/project-pipeline";
import type { ActionResult } from "@/lib/company-mutations";
import { eq } from "drizzle-orm";
import * as activityLog from "@/lib/activity-log";

export async function runCreateProject(
  db: AnyDb,
  formData: FormData,
  ownerUserId: string | null
): Promise<ActionResult> {
  const parsed = projectCreateSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    stage: formData.get("stage"),
    solutionType: formData.get("solutionType"),
    estimatedValue: formData.get("estimatedValue"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input: NewProjectInput = {
    companyId: parsed.data.companyId,
    name: parsed.data.name,
    ownerUserId,
    stage: parsed.data.stage,
    stageGroup: stageGroupFor(parsed.data.stage),
    status: "open",
    solutionType: parsed.data.solutionType,
    estimatedValue: parsed.data.estimatedValue,
    notes: parsed.data.notes,
  };
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(projects).values(input).returning();
      await tx.insert(activities).values({
        companyId: created.companyId,
        projectId: created.id,
        userId: ownerUserId,
        type: "system",
        direction: "none",
        subject: null,
        body: null,
        source: "system",
        metadata: null,
      });
    });
  } catch {
    return { ok: false, error: "No se pudo crear el proyecto" };
  }
  return { ok: true };
}

export async function runUpdateProject(
  db: AnyDb,
  formData: FormData,
  actorUserId: string | null = null
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Falta el identificador del proyecto" };
  }
  const parsed = projectUpdateSchema.safeParse({
    name: formData.get("name"),
    plantName: formData.get("plantName"),
    locationAddress: formData.get("locationAddress"),
    city: formData.get("city"),
    state: formData.get("state"),
    country: formData.get("country"),
    industrySubsegment: formData.get("industrySubsegment"),
    stage: formData.get("stage"),
    status: formData.get("status"),
    solutionType: formData.get("solutionType"),
    estimatedValue: formData.get("estimatedValue"),
    probability: formData.get("probability"),
    expectedCloseDate: formData.get("expectedCloseDate"),
    source: formData.get("source"),
    lostReason: formData.get("lostReason"),
    lostReasonNote: formData.get("lostReasonNote"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const fields: ProjectUpdateFields = {
    ...parsed.data,
    stageGroup: stageGroupFor(parsed.data.stage),
  };
  try {
    const result = await db.transaction(async (tx): Promise<ActionResult> => {
      const [current] = await tx
        .select({ stage: projects.stage, companyId: projects.companyId })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      if (!current) {
        return { ok: false, error: "No se encontró el proyecto" };
      }
      const isEntry = current.stage !== fields.stage;
      // Auto-status (§8.4): al ENTRAR a una etapa gatillo forzamos won/active_customer,
      // pisando el status enviado SOLO en esa transición (nunca revierte hacia atrás).
      // Asume que el status forzado no tiene invariantes cross-field (won/active_customer
      // no exigen nada, a diferencia de 'lost'). Al ganar/activar limpiamos cualquier
      // motivo de pérdida viejo para no dejar el row inconsistente.
      const autoStatus = isEntry ? autoStatusForStage(fields.stage) : null;
      const effectiveFields = autoStatus
        ? { ...fields, status: autoStatus, lostReason: null, lostReasonNote: null }
        : fields;
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
    });
    return result;
  } catch {
    return { ok: false, error: "No se pudo actualizar el proyecto" };
  }
}
