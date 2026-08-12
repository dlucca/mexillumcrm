import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { contacts } from "@/db/schema";
import {
  createContact,
  listContacts,
  archiveContact,
  restoreContact,
  type NewContactInput,
} from "@/db/contacts";

function contactInput(companyId: string, name: string): NewContactInput {
  return { companyId, name, email: null, phone: null, role: null, notes: null };
}

describe("createContact", () => {
  it("links a contact to its company", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Naviera" });
    const contact = await createContact(db, contactInput(company.id, "Ana López"));
    expect(contact.id).toBeTruthy();
    expect(contact.companyId).toBe(company.id);
    expect(contact.name).toBe("Ana López");
    expect(contact.archivedAt).toBeNull();
  });
});

describe("listContacts", () => {
  it("returns only the given company's active contacts, newest first", async () => {
    const db = await createTestDb();
    const a = await createCompany(db, { name: "Empresa A" });
    const b = await createCompany(db, { name: "Empresa B" });
    await db
      .insert(contacts)
      .values({ companyId: a.id, name: "Primero", createdAt: new Date("2024-01-01T00:00:00Z") })
      .returning();
    const [segundo] = await db
      .insert(contacts)
      .values({ companyId: a.id, name: "Segundo", createdAt: new Date("2024-06-01T00:00:00Z") })
      .returning();
    await db
      .insert(contacts)
      .values({ companyId: b.id, name: "De otra empresa" });

    const rows = await listContacts(db, a.id);
    expect(rows.map((r) => r.name)).toEqual(["Segundo", "Primero"]);
    expect(rows[0].id).toBe(segundo.id);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.companyId === a.id)).toBe(true);
  });

  it("separates active and archived contacts", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Empresa" });
    const active = await createContact(db, contactInput(company.id, "Activo"));
    const gone = await createContact(db, contactInput(company.id, "Archivado"));
    await archiveContact(db, gone.id);

    const activos = await listContacts(db, company.id);
    expect(activos.map((r) => r.name)).toEqual(["Activo"]);
    expect(activos.map((r) => r.id)).toContain(active.id);

    const archivados = await listContacts(db, company.id, { archived: true });
    expect(archivados.map((r) => r.name)).toEqual(["Archivado"]);
  });
});

describe("archiveContact / restoreContact", () => {
  it("sets and clears archivedAt", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Empresa" });
    const contact = await createContact(db, contactInput(company.id, "Beto"));

    const archived = await archiveContact(db, contact.id);
    expect(archived!.archivedAt).not.toBeNull();

    const restored = await restoreContact(db, contact.id);
    expect(restored!.archivedAt).toBeNull();
  });

  it("returns undefined when archiving a nonexistent id", async () => {
    const db = await createTestDb();
    const result = await archiveContact(db, "00000000-0000-0000-0000-000000000000");
    expect(result).toBeUndefined();
  });
});
