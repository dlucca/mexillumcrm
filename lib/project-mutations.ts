import type { AnyDb } from "@/db/types";
import {
  updateProject,
  type NewProjectInput,
  type ProjectUpdateFields,
} from "@/db/projects";
import { projects, activities } from "@/db/schema";
import { projectCreateSchema, projectUpdateSchema } from "@/lib/validation";
import { stageGroupFor } from "@/lib/project-pipeline";
import type { ActionResult } from "@/lib/company-mutations";

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
  formData: FormData
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
    const row = await updateProject(db, id, fields);
    if (!row) {
      return { ok: false, error: "No se encontró el proyecto" };
    }
  } catch {
    return { ok: false, error: "No se pudo actualizar el proyecto" };
  }
  return { ok: true };
}
