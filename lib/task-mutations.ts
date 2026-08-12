import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { AnyDb } from "@/db/types";
import { taskCreateSchema } from "@/lib/validation";
import { createTask } from "@/db/tasks";
import { getProject } from "@/db/projects";
import { tasks, activities } from "@/db/schema";
import type { ActionResult } from "@/lib/company-mutations";

const taskIdSchema = z.string().uuid();

export async function runCreateTask(
  db: AnyDb,
  formData: FormData,
  ownerUserId: string | null
): Promise<ActionResult> {
  const parsed = taskCreateSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const project = await getProject(db, parsed.data.projectId);
  if (!project) {
    return { ok: false, error: "No se encontró el proyecto" };
  }
  try {
    await createTask(db, {
      projectId: project.id,
      companyId: project.companyId,
      ownerUserId,
      title: parsed.data.title,
      dueDate: parsed.data.dueDate,
    });
  } catch {
    return { ok: false, error: "No se pudo crear la tarea" };
  }
  return { ok: true };
}

export async function runCompleteTask(
  db: AnyDb,
  formData: FormData,
  actorUserId: string | null
): Promise<ActionResult> {
  const parsedId = taskIdSchema.safeParse(formData.get("taskId"));
  if (!parsedId.success) {
    return { ok: false, error: "Tarea inválida" };
  }
  const taskId = parsedId.data;
  try {
    return await db.transaction(async (tx): Promise<ActionResult> => {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (!task) {
        return { ok: false, error: "No se encontró la tarea" };
      }
      if (task.completedAt != null) {
        return { ok: true };
      }
      // Guard concurrente: solo completa la fila que sigue abierta. Si otra transacción
      // ya la completó (doble-submit), el UPDATE afecta 0 filas y no registramos Activity
      // duplicada (la idempotencia vale también bajo concurrencia, no solo secuencial).
      const updated = await tx
        .update(tasks)
        .set({ completedAt: new Date() })
        .where(and(eq(tasks.id, taskId), isNull(tasks.completedAt)))
        .returning({ id: tasks.id });
      if (updated.length === 0) {
        return { ok: true };
      }
      await tx.insert(activities).values({
        companyId: task.companyId,
        projectId: task.projectId,
        userId: actorUserId,
        type: "task",
        direction: "internal",
        subject: null,
        body: task.title,
        source: "system",
        metadata: { taskId: task.id, event: "completed" },
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "No se pudo completar la tarea" };
  }
}
