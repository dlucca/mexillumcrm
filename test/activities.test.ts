import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { activities } from "@/db/schema";

describe("activities table", () => {
  it("inserta y recupera una activity con metadata jsonb", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [proj] = await db
      .insert((await import("@/db/schema")).projects)
      .values({ companyId: company.id, name: "P" })
      .returning();

    const [row] = await db
      .insert(activities)
      .values({
        companyId: company.id,
        projectId: proj.id,
        userId: null,
        type: "note",
        direction: "internal",
        subject: null,
        body: "hola",
        source: "manual",
        metadata: { k: "v" },
      })
      .returning();

    expect(row.id).toBeTruthy();
    expect(row.type).toBe("note");
    expect(row.body).toBe("hola");
    expect(row.metadata).toEqual({ k: "v" });
    expect(row.occurredAt).toBeInstanceOf(Date);

    const found = await db.select().from(activities).where(eq(activities.id, row.id));
    expect(found).toHaveLength(1);
  });
});
