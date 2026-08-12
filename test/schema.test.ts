import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { companies, contacts, projects } from "@/db/schema";

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

  it("projects: inserta un proyecto ligado a una company con defaults", async () => {
    const db = await createTestDb();
    const [company] = await db.insert(companies).values({ name: "Acme" }).returning();
    const [project] = await db
      .insert(projects)
      .values({ companyId: company.id, name: "Planta Norte" })
      .returning();
    expect(project.id).toBeTruthy();
    expect(project.companyId).toBe(company.id);
    expect(project.stage).toBe("lead_sin_contactar");
    expect(project.stageGroup).toBe("lead");
    expect(project.status).toBe("open");
    expect(project.solutionType).toBe("unknown");
    expect(project.archivedAt).toBeNull();
  });
});
