import { describe, it, expect } from "vitest";
import {
  companyCreateSchema,
  companyUpdateSchema,
  contactCreateSchema,
  noteCreateSchema,
  taskCreateSchema,
} from "@/lib/validation";

describe("companyCreateSchema", () => {
  it("rejects an empty name", () => {
    const result = companyCreateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("trims and accepts a valid name", () => {
    const result = companyCreateSchema.safeParse({ name: "  Acme  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Acme");
  });
});

describe("companyUpdateSchema", () => {
  it("requires a non-empty name", () => {
    const r = companyUpdateSchema.safeParse({ name: "   " });
    expect(r.success).toBe(false);
  });

  it("normalizes empty and whitespace optionals to null and keeps real values", () => {
    const r = companyUpdateSchema.safeParse({
      name: "Acme",
      industry: "",
      website: "   ",
      notes: "  hola  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Acme");
      expect(r.data.industry).toBeNull();
      expect(r.data.website).toBeNull();
      expect(r.data.notes).toBe("hola");
      expect(r.data.legalName).toBeNull();
    }
  });
});

describe("contactCreateSchema", () => {
  const validId = "00000000-0000-0000-0000-000000000000";

  it("requires a non-empty name", () => {
    const r = contactCreateSchema.safeParse({ companyId: validId, name: "   " });
    expect(r.success).toBe(false);
  });

  it("rejects a non-uuid companyId", () => {
    const r = contactCreateSchema.safeParse({ companyId: "nope", name: "Ana" });
    expect(r.success).toBe(false);
  });

  it("normalizes empty optionals to null and keeps real values", () => {
    const r = contactCreateSchema.safeParse({
      companyId: validId,
      name: "Ana",
      email: "  ana@example.com  ",
      phone: "",
      role: "   ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("ana@example.com");
      expect(r.data.phone).toBeNull();
      expect(r.data.role).toBeNull();
      expect(r.data.notes).toBeNull();
    }
  });
});

describe("noteCreateSchema", () => {
  const pid = "11111111-1111-1111-8111-111111111111";

  it("acepta body válido y trimea", () => {
    const r = noteCreateSchema.safeParse({ projectId: pid, body: "  hola  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.body).toBe("hola");
  });

  it("rechaza body vacío/whitespace", () => {
    const r = noteCreateSchema.safeParse({ projectId: pid, body: "   " });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("La nota no puede estar vacía");
  });

  it("rechaza projectId no-uuid", () => {
    const r = noteCreateSchema.safeParse({ projectId: "nope", body: "hola" });
    expect(r.success).toBe(false);
  });
});

describe("taskCreateSchema", () => {
  const pid = "11111111-1111-1111-8111-111111111111";
  it("acepta y trima válidos", () => {
    const r = taskCreateSchema.safeParse({ projectId: pid, title: "  Llamar  ", dueDate: "2026-09-01" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.title).toBe("Llamar"); expect(r.data.dueDate).toBe("2026-09-01"); }
  });
  it("rechaza title vacío", () => {
    expect(taskCreateSchema.safeParse({ projectId: pid, title: "  ", dueDate: "2026-09-01" }).success).toBe(false);
  });
  it("rechaza dueDate ausente o mal formado", () => {
    expect(taskCreateSchema.safeParse({ projectId: pid, title: "T", dueDate: "" }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ projectId: pid, title: "T", dueDate: "01/09/2026" }).success).toBe(false);
  });
  it("rechaza projectId no-uuid", () => {
    expect(taskCreateSchema.safeParse({ projectId: "nope", title: "T", dueDate: "2026-09-01" }).success).toBe(false);
  });
});
