import { describe, it, expect } from "vitest";
import { companyCreateSchema, companyUpdateSchema } from "@/lib/validation";

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
