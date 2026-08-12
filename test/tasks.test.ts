import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { tasks, projects } from "@/db/schema";

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
