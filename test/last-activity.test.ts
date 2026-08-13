import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { createActivity } from "@/db/activities";
import { projects } from "@/db/schema";
import { lastActivityByProject, lastActivityByCompany, listActivitiesForCompany } from "@/db/activities";

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

describe("lastActivityByCompany / listActivitiesForCompany", () => {
  it("max(occurred_at) por empresa y actividades de la empresa en orden desc", async () => {
    const db = await createTestDb();
    const c1 = await createCompany(db, { name: "Uno" });
    const c2 = await createCompany(db, { name: "Dos" });
    const [p1] = await db.insert(projects).values({ companyId: c1.id, name: "P1" }).returning();
    const [p2] = await db.insert(projects).values({ companyId: c1.id, name: "P2" }).returning();
    const [p3] = await db.insert(projects).values({ companyId: c2.id, name: "P3" }).returning();

    const base = { userId: null, type: "note", direction: null, subject: null, body: null, source: "manual", metadata: null };
    await createActivity(db, { ...base, companyId: c1.id, projectId: p1.id, occurredAt: new Date("2026-08-01T10:00:00Z") });
    await createActivity(db, { ...base, companyId: c1.id, projectId: p2.id, occurredAt: new Date("2026-08-09T10:00:00Z") });
    await createActivity(db, { ...base, companyId: c2.id, projectId: p3.id, occurredAt: new Date("2026-07-15T10:00:00Z") });

    const byCo = await lastActivityByCompany(db);
    expect(byCo.get(c1.id)?.toISOString()).toBe("2026-08-09T10:00:00.000Z");
    expect(byCo.get(c2.id)?.toISOString()).toBe("2026-07-15T10:00:00.000Z");

    const acts = await listActivitiesForCompany(db, c1.id);
    expect(acts).toHaveLength(2);
    expect(acts[0].occurredAt.toISOString()).toBe("2026-08-09T10:00:00.000Z"); // más reciente primero
  });
});
