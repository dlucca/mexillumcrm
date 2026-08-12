import type { AnyDb } from "@/db/types";
import { noteCreateSchema } from "@/lib/validation";
import { createActivity } from "@/db/activities";
import { getProject } from "@/db/projects";
import type { ActionResult } from "@/lib/company-mutations";

export async function runCreateNote(
  db: AnyDb,
  formData: FormData,
  actorUserId: string | null
): Promise<ActionResult> {
  const parsed = noteCreateSchema.safeParse({
    projectId: formData.get("projectId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const project = await getProject(db, parsed.data.projectId);
  if (!project) {
    return { ok: false, error: "No se encontró el proyecto" };
  }
  try {
    await createActivity(db, {
      companyId: project.companyId,
      projectId: project.id,
      userId: actorUserId,
      type: "note",
      direction: "internal",
      subject: null,
      body: parsed.data.body,
      source: "manual",
      metadata: null,
    });
  } catch {
    return { ok: false, error: "No se pudo guardar la nota" };
  }
  return { ok: true };
}
