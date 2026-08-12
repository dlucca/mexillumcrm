import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { createCompany, listCompanies, getCompany, updateCompany } from "@/db/companies";
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

  it("orders non-archived companies newest first by createdAt", async () => {
    const db = await createTestDb();

    const [oldest] = await db
      .insert(companies)
      .values({ name: "Oldest", createdAt: new Date("2024-01-01T00:00:00Z") })
      .returning();
    const [middle] = await db
      .insert(companies)
      .values({ name: "Middle", createdAt: new Date("2024-06-01T00:00:00Z") })
      .returning();
    const [newest] = await db
      .insert(companies)
      .values({ name: "Newest", createdAt: new Date("2024-12-01T00:00:00Z") })
      .returning();

    const rows = await listCompanies(db);
    expect(rows.map((r) => r.id)).toEqual([newest.id, middle.id, oldest.id]);
    expect(rows.map((r) => r.name)).toEqual(["Newest", "Middle", "Oldest"]);
  });
});

describe("getCompany", () => {
  it("returns the row when it exists", async () => {
    const db = await createTestDb();
    const created = await createCompany(db, { name: "Naviera Cortés" });
    const found = await getCompany(db, created.id);
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe("Naviera Cortés");
  });

  it("returns undefined when it does not exist", async () => {
    const db = await createTestDb();
    const found = await getCompany(db, "00000000-0000-0000-0000-000000000000");
    expect(found).toBeUndefined();
  });
});

describe("updateCompany", () => {
  it("updates business fields and bumps updatedAt", async () => {
    const db = await createTestDb();
    const past = new Date("2020-01-01T00:00:00Z");
    const [row] = await db
      .insert(companies)
      .values({ name: "Antes", createdAt: past, updatedAt: past })
      .returning();

    const updated = await updateCompany(db, row.id, {
      name: "Después",
      legalName: "Después S.A. de C.V.",
      industry: "Acuicultura",
      companyType: null,
      website: null,
      taxId: null,
      headquartersLocation: null,
      sizeSegment: null,
      notes: null,
    });

    expect(updated.name).toBe("Después");
    expect(updated.legalName).toBe("Después S.A. de C.V.");
    expect(updated.industry).toBe("Acuicultura");
    expect(updated.updatedAt.getTime()).toBeGreaterThan(past.getTime());
  });
});
