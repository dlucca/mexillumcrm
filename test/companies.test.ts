import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { createCompany, listCompanies } from "@/db/companies";
import { companies } from "@/db/schema";

describe("createCompany", () => {
  it("inserts a company and returns the row with an id", async () => {
    const db = await createTestDb();
    const row = await createCompany(db, { name: "Mariscos del Golfo" });
    expect(row.id).toBeTruthy();
    expect(row.name).toBe("Mariscos del Golfo");
    expect(row.archivedAt).toBeNull();
  });
});

describe("listCompanies", () => {
  it("returns only non-archived companies, newest first", async () => {
    const db = await createTestDb();
    const first = await createCompany(db, { name: "Primera" });
    const second = await createCompany(db, { name: "Segunda" });

    // Archive the first one directly.
    await db
      .update(companies)
      .set({ archivedAt: new Date() })
      .where(eq(companies.id, first.id));

    const rows = await listCompanies(db);
    expect(rows.map((r) => r.name)).toEqual(["Segunda"]);
    expect(rows[0].id).toBe(second.id);
  });
});
