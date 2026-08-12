import { describe, it, expect } from "vitest";
import { companyCreateSchema } from "@/lib/validation";

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
