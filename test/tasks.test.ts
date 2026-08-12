import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { tasks, projects } from "@/db/schema";
import { createTask, getTask, listTasksForProject } from "@/db/tasks";

describe("tasks table", () => {
  it("inserta y recupera una task con due_date string y completed_at null", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [proj] = await db.insert(projects).values({ companyId: company.id, name: "P" }).returning();

    const [row] = await db
      .insert(tasks)
      .values({
        projectId: proj.id,
        companyId: company.id,
        ownerUserId: null,
        title: "Llamar al cliente",
        dueDate: "2026-09-01",
      })
      .returning();

    expect(row.id).toBeTruthy();
    expect(row.title).toBe("Llamar al cliente");
    expect(row.dueDate).toBe("2026-09-01");
    expect(row.completedAt).toBeNull();

    const found = await db.select().from(tasks).where(eq(tasks.id, row.id));
    expect(found).toHaveLength(1);
  });
});

describe("db/tasks", () => {
  async function seed() {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [proj] = await db.insert(projects).values({ companyId: company.id, name: "P" }).returning();
    return { db, companyId: company.id, projectId: proj.id };
  }

  it("createTask inserta y getTask lo recupera", async () => {
    const { db, companyId, projectId } = await seed();
    const row = await createTask(db, {
      projectId, companyId, ownerUserId: null, title: "T1", dueDate: "2026-09-01",
    });
    expect(row.id).toBeTruthy();
    const found = await getTask(db, row.id);
    expect(found?.title).toBe("T1");
  });

  it("listTasksForProject ordena due_date asc y scopea por projectId", async () => {
    const { db, companyId, projectId } = await seed();
    await createTask(db, { projectId, companyId, ownerUserId: null, title: "tarde", dueDate: "2026-12-01" });
    await createTask(db, { projectId, companyId, ownerUserId: null, title: "pronto", dueDate: "2026-09-01" });
    const [other] = await db.insert(projects).values({ companyId, name: "Otro" }).returning();
    await createTask(db, { projectId: other.id, companyId, ownerUserId: null, title: "de otro", dueDate: "2026-08-01" });

    const rows = await listTasksForProject(db, projectId);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe("pronto"); // due_date más temprano primero
    expect(rows.every((t) => t.projectId === projectId)).toBe(true);
  });
});
