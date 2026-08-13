import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { createActivity } from "@/db/activities";
import { projects } from "@/db/schema";
import { lastActivityByProject } from "@/db/activities";

describe("lastActivityByProject", () => {
  it("devuelve el max(occurred_at) por proyecto; proyectos sin actividad no aparecen", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [a] = await db
      .insert(projects)
      .values({ companyId: company.id, name: "A" })
      .returning();
    const [b] = await db
      .insert(projects)
      .values({ companyId: company.id, name: "B" })
      .returning();
    await db.insert(projects).values({ companyId: company.id, name: "SinActividad" }).returning();

    const base = {
      companyId: company.id,
      userId: null,
      type: "note",
      direction: null,
      subject: null,
      body: null,
      source: "manual",
      metadata: null,
    };
    await createActivity(db, { ...base, projectId: a.id, occurredAt: new Date("2026-08-01T10:00:00Z") });
    await createActivity(db, { ...base, projectId: a.id, occurredAt: new Date("2026-08-10T10:00:00Z") });
    await createActivity(db, { ...base, projectId: b.id, occurredAt: new Date("2026-07-20T10:00:00Z") });

    const map = await lastActivityByProject(db);
    expect(map.get(a.id)?.toISOString()).toBe("2026-08-10T10:00:00.000Z");
    expect(map.get(b.id)?.toISOString()).toBe("2026-07-20T10:00:00.000Z");
    expect(map.size).toBe(2); // el proyecto sin actividad no aparece
  });
});
