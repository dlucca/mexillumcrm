import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { companies, contacts } from "@/db/schema";

describe("schema", () => {
  it("migrates and exposes an empty companies table", async () => {
    const db = await createTestDb();
    const rows = await db.select().from(companies);
    expect(rows).toEqual([]);
  });

  it("links a contact to its company", async () => {
    const db = await createTestDb();
    const [company] = await db.insert(companies).values({ name: "Naviera" }).returning();
    const [contact] = await db
      .insert(contacts)
      .values({ companyId: company.id, name: "Ana" })
      .returning();
    expect(contact.companyId).toBe(company.id);
    expect(contact.name).toBe("Ana");
    expect(contact.archivedAt).toBeNull();
    expect(contact.createdAt).toBeInstanceOf(Date);
  });
});
