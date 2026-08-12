import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { projects } from "@/db/schema";
import { createTask, listTasksForProject } from "@/db/tasks";
import { listActivitiesForProject } from "@/db/activities";
import { runCreateTask, runCompleteTask } from "@/lib/task-mutations";

function formOf(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

async function seed() {
  const db = await createTestDb();
  const company = await createCompany(db, { name: "Acme" });
  const [proj] = await db.insert(projects).values({ companyId: company.id, name: "P" }).returning();
  return { db, companyId: company.id, projectId: proj.id };
}

describe("runCreateTask", () => {
  it("crea la task con company_id del project, owner y due_date", async () => {
    const { db, companyId, projectId } = await seed();
    const res = await runCreateTask(
      db,
      formOf({ projectId, title: "  Llamar  ", dueDate: "2026-09-01" }),
      "22222222-2222-2222-2222-222222222222"
    );
    expect(res).toEqual({ ok: true });
    const [t] = await listTasksForProject(db, projectId);
    expect(t.title).toBe("Llamar");
    expect(t.dueDate).toBe("2026-09-01");
    expect(t.companyId).toBe(companyId);
    expect(t.ownerUserId).toBe("22222222-2222-2222-2222-222222222222");
    expect(t.completedAt).toBeNull();
  });

  it("rechaza title vacío", async () => {
    const { db, projectId } = await seed();
    const res = await runCreateTask(db, formOf({ projectId, title: "  ", dueDate: "2026-09-01" }), null);
    expect(res.ok).toBe(false);
  });

  it("rechaza project inexistente", async () => {
    const { db } = await seed();
    const res = await runCreateTask(
      db,
      formOf({ projectId: "00000000-0000-0000-0000-000000000000", title: "T", dueDate: "2026-09-01" }),
      null
    );
    expect(res).toEqual({ ok: false, error: "No se encontró el proyecto" });
  });
});

describe("runCompleteTask", () => {
  it("setea completed_at y registra 1 Activity task con body=title y metadata.taskId", async () => {
    const { db, companyId, projectId } = await seed();
    const task = await createTask(db, { projectId, companyId, ownerUserId: null, title: "Llamar", dueDate: "2026-09-01" });
    const res = await runCompleteTask(db, formOf({ taskId: task.id }), "33333333-3333-3333-3333-333333333333");
    expect(res).toEqual({ ok: true });

    const [t] = await listTasksForProject(db, projectId);
    expect(t.completedAt).not.toBeNull();

    const acts = (await listActivitiesForProject(db, projectId)).filter((a) => a.type === "task");
    expect(acts).toHaveLength(1);
    expect(acts[0].body).toBe("Llamar");
    expect(acts[0].source).toBe("system");
    expect(acts[0].userId).toBe("33333333-3333-3333-3333-333333333333");
    expect(acts[0].metadata).toMatchObject({ taskId: task.id, event: "completed" });
  });

  it("es idempotente: completar una ya completada no duplica la Activity", async () => {
    const { db, companyId, projectId } = await seed();
    const task = await createTask(db, { projectId, companyId, ownerUserId: null, title: "Llamar", dueDate: "2026-09-01" });
    await runCompleteTask(db, formOf({ taskId: task.id }), null);
    const res2 = await runCompleteTask(db, formOf({ taskId: task.id }), null);
    expect(res2).toEqual({ ok: true });
    const acts = (await listActivitiesForProject(db, projectId)).filter((a) => a.type === "task");
    expect(acts).toHaveLength(1);
  });

  it("task inexistente → error", async () => {
    const { db } = await seed();
    const res = await runCompleteTask(db, formOf({ taskId: "00000000-0000-0000-0000-000000000000" }), null);
    expect(res).toEqual({ ok: false, error: "No se encontró la tarea" });
  });
});
