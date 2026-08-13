import { describe, it, expect } from "vitest";
import { createTestDb } from "./db";
import { createCompany, listCompaniesWithProjectCount } from "@/db/companies";
import { createProject, archiveProject } from "@/db/projects";
import type { AnyDb } from "@/db/types";

async function mkProject(db: AnyDb, companyId: string, name: string) {
  return createProject(db, {
    companyId, name, ownerUserId: null, stage: "lead_sin_contactar", stageGroup: "lead",
    status: "open", solutionType: "unknown", estimatedValue: null, notes: null,
  });
}

describe("listCompaniesWithProjectCount", () => {
  it("cuenta todos los proyectos de la empresa (incl. archivados); 0 si no tiene", async () => {
    const db = await createTestDb();
    const a = await createCompany(db, { name: "A" });
    const b = await createCompany(db, { name: "B" });
    const p1 = await mkProject(db, a.id, "P1");
    await mkProject(db, a.id, "P2");
    await archiveProject(db, p1.id); // archivado igual cuenta (el hard delete lo borra)

    const rows = await listCompaniesWithProjectCount(db, { archived: false });
    expect(rows.find((r) => r.id === a.id)!.projectCount).toBe(2);
    expect(rows.find((r) => r.id === b.id)!.projectCount).toBe(0);
  });
});
