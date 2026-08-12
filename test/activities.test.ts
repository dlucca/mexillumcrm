import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { activities, projects } from "@/db/schema";
import { createActivity, listActivitiesForProject } from "@/db/activities";

describe("activities table", () => {
  it("inserta y recupera una activity con metadata jsonb", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [proj] = await db
      .insert((await import("@/db/schema")).projects)
      .values({ companyId: company.id, name: "P" })
      .returning();

    const [row] = await db
      .insert(activities)
      .values({
        companyId: company.id,
        projectId: proj.id,
        userId: null,
        type: "note",
        direction: "internal",
        subject: null,
        body: "hola",
        source: "manual",
        metadata: { k: "v" },
      })
      .returning();

    expect(row.id).toBeTruthy();
    expect(row.type).toBe("note");
    expect(row.body).toBe("hola");
    expect(row.metadata).toEqual({ k: "v" });
    expect(row.occurredAt).toBeInstanceOf(Date);

    const found = await db.select().from(activities).where(eq(activities.id, row.id));
    expect(found).toHaveLength(1);
  });
});

describe("db/activities", () => {
  async function seed() {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const [proj] = await db
      .insert(projects)
      .values({ companyId: company.id, name: "P" })
      .returning();
    return { db, companyId: company.id, projectId: proj.id };
  }

  it("createActivity inserta y devuelve la fila", async () => {
    const { db, companyId, projectId } = await seed();
    const row = await createActivity(db, {
      companyId,
      projectId,
      userId: null,
      type: "note",
      direction: "internal",
      subject: null,
      body: "hola",
      source: "manual",
      metadata: null,
    });
    expect(row.id).toBeTruthy();
    expect(row.body).toBe("hola");
  });

  it("listActivitiesForProject ordena desc por occurred_at y filtra por type", async () => {
    const { db, companyId, projectId } = await seed();
    await createActivity(db, {
      companyId, projectId, userId: null, type: "system",
      direction: "none", subject: null, body: null, source: "system",
      metadata: null, occurredAt: new Date("2026-01-01T10:00:00Z"),
    });
    await createActivity(db, {
      companyId, projectId, userId: null, type: "note",
      direction: "internal", subject: null, body: "reciente", source: "manual",
      metadata: null, occurredAt: new Date("2026-02-01T10:00:00Z"),
    });

    const all = await listActivitiesForProject(db, projectId);
    expect(all).toHaveLength(2);
    expect(all[0].body).toBe("reciente"); // más reciente primero

    const notes = await listActivitiesForProject(db, projectId, { type: "note" });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe("note");
  });

  it("listActivitiesForProject scopea por projectId", async () => {
    const { db, companyId, projectId } = await seed();
    const [other] = await db
      .insert(projects)
      .values({ companyId, name: "Otro" })
      .returning();
    await createActivity(db, {
      companyId, projectId: other.id, userId: null, type: "note",
      direction: "internal", subject: null, body: "de otro", source: "manual", metadata: null,
    });
    const rows = await listActivitiesForProject(db, projectId);
    expect(rows).toHaveLength(0);
  });
});
