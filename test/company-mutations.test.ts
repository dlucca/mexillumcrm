import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { runCreateCompany, runUpdateCompany } from "@/lib/company-mutations";
import { createCompany, getCompany, listCompanies } from "@/db/companies";
import type { AnyDb } from "@/db/types";

function formOf(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("runCreateCompany", () => {
  it("creates a company from valid form data", async () => {
    const db = await createTestDb();
    const result = await runCreateCompany(db, formOf({ name: "Astilleros Sur" }));
    expect(result).toEqual({ ok: true });
    const rows = await listCompanies(db);
    expect(rows.map((r) => r.name)).toContain("Astilleros Sur");
  });

  it("returns a validation error when name is missing", async () => {
    const db = await createTestDb();
    const result = await runCreateCompany(db, formOf({}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("El nombre es obligatorio");
  });

  it("returns a friendly error when the insert throws", async () => {
    const throwingDb = {
      insert() {
        throw new Error("db down");
      },
    } as unknown as AnyDb;
    const result = await runCreateCompany(throwingDb, formOf({ name: "X" }));
    expect(result).toEqual({ ok: false, error: "No se pudo crear la empresa" });
  });
});

describe("runUpdateCompany", () => {
  it("updates fields and normalizes empty optionals to null", async () => {
    const db = await createTestDb();
    const created = await createCompany(db, { name: "Antes" });
    const result = await runUpdateCompany(
      db,
      formOf({ id: created.id, name: "Después", industry: "Pesca", website: "  " })
    );
    expect(result).toEqual({ ok: true });
    const row = await getCompany(db, created.id);
    expect(row?.name).toBe("Después");
    expect(row?.industry).toBe("Pesca");
    expect(row?.website).toBeNull();
  });

  it("returns an error when id is missing", async () => {
    const db = await createTestDb();
    const result = await runUpdateCompany(db, formOf({ name: "X" }));
    expect(result.ok).toBe(false);
  });
});
