import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { companies } from "@/db/schema";

describe("schema", () => {
  it("migrates and exposes an empty companies table", async () => {
    const db = await createTestDb();
    const rows = await db.select().from(companies);
    expect(rows).toEqual([]);
  });
});
