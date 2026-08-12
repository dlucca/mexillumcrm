import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { projects } from "@/db/schema";
import { listActivitiesForProject } from "@/db/activities";
import { runCreateNote } from "@/lib/activity-mutations";

function formOf(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

async function seed() {
  const db = await createTestDb();
  const company = await createCompany(db, { name: "Acme" });
  const [proj] = await db.insert(projects).values({ companyId: company.id, name: "P" }).returning();
  return { db, companyId: company.id, projectId: proj.id };
}

describe("runCreateNote", () => {
  it("crea una nota manual con companyId resuelto desde el project", async () => {
    const { db, companyId, projectId } = await seed();
    const res = await runCreateNote(
      db,
      formOf({ projectId, body: "  llamé al cliente  " }),
      "22222222-2222-2222-2222-222222222222"
    );
    expect(res).toEqual({ ok: true });

    const [row] = await listActivitiesForProject(db, projectId);
    expect(row.type).toBe("note");
    expect(row.direction).toBe("internal");
    expect(row.source).toBe("manual");
    expect(row.body).toBe("llamé al cliente");
    expect(row.companyId).toBe(companyId);
    expect(row.userId).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("rechaza body vacío", async () => {
    const { db, projectId } = await seed();
    const res = await runCreateNote(db, formOf({ projectId, body: "   " }), null);
    expect(res.ok).toBe(false);
  });

  it("rechaza project inexistente", async () => {
    const { db } = await seed();
    const res = await runCreateNote(
      db,
      formOf({ projectId: "00000000-0000-0000-0000-000000000000", body: "hola" }),
      null
    );
    expect(res).toEqual({ ok: false, error: "No se encontró el proyecto" });
  });
});
