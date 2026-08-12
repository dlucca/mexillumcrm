import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { createContact, listContacts } from "@/db/contacts";
import { runCreateContact, runUpdateContact } from "@/lib/contact-mutations";
import type { AnyDb } from "@/db/types";

function formOf(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("runCreateContact", () => {
  it("creates a contact from valid form data", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Empresa" });
    const result = await runCreateContact(
      db,
      formOf({ companyId: company.id, name: "Ana", email: "ana@example.com" })
    );
    expect(result).toEqual({ ok: true });
    const rows = await listContacts(db, company.id);
    expect(rows.map((r) => r.name)).toContain("Ana");
    expect(rows[0].email).toBe("ana@example.com");
  });

  it("returns a validation error when name is missing", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Empresa" });
    const result = await runCreateContact(db, formOf({ companyId: company.id }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("El nombre es obligatorio");
  });

  it("returns a validation error when companyId is not a uuid", async () => {
    const db = await createTestDb();
    const result = await runCreateContact(db, formOf({ companyId: "nope", name: "Ana" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Empresa inválida");
  });

  it("returns a friendly error when the insert throws", async () => {
    const throwingDb = {
      insert() {
        throw new Error("db down");
      },
    } as unknown as AnyDb;
    const result = await runCreateContact(
      throwingDb,
      formOf({ companyId: "00000000-0000-0000-0000-000000000000", name: "Ana" })
    );
    expect(result).toEqual({ ok: false, error: "No se pudo crear el contacto" });
  });
});

describe("runUpdateContact", () => {
  it("actualiza con datos válidos", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const contact = await createContact(db, {
      companyId: company.id,
      name: "Ana",
      email: null,
      phone: null,
      role: null,
      notes: null,
    });

    const result = await runUpdateContact(
      db,
      formOf({
        id: contact.id,
        companyId: company.id,
        name: "Ana Pérez",
        email: "ana@acme.mx",
        phone: "",
        role: "",
        notes: "",
      })
    );
    expect(result.ok).toBe(true);

    const [reloaded] = await listContacts(db, company.id);
    expect(reloaded.name).toBe("Ana Pérez");
    expect(reloaded.email).toBe("ana@acme.mx");
  });

  it("falla si falta id", async () => {
    const db = await createTestDb();
    const result = await runUpdateContact(db, formOf({ name: "Ana" }));
    expect(result).toEqual({ ok: false, error: "Falta el identificador del contacto" });
  });

  it("falla si name está vacío", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const contact = await createContact(db, {
      companyId: company.id,
      name: "Ana",
      email: null,
      phone: null,
      role: null,
      notes: null,
    });
    const result = await runUpdateContact(
      db,
      formOf({ id: contact.id, name: "   " })
    );
    expect(result.ok).toBe(false);
  });

  it("persiste email vacío como null", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const contact = await createContact(db, {
      companyId: company.id,
      name: "Ana",
      email: "old@acme.mx",
      phone: null,
      role: null,
      notes: null,
    });
    const result = await runUpdateContact(
      db,
      formOf({ id: contact.id, companyId: company.id, name: "Ana", email: "" })
    );
    expect(result.ok).toBe(true);

    const [reloaded] = await listContacts(db, company.id);
    expect(reloaded.email).toBeNull();
  });

  it("falla para id inexistente", async () => {
    const db = await createTestDb();
    const result = await runUpdateContact(
      db,
      formOf({ id: "00000000-0000-0000-0000-000000000000", name: "Ana" })
    );
    expect(result).toEqual({ ok: false, error: "No se encontró el contacto" });
  });
});
