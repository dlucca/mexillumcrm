import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import {
  createProject,
  listProjects,
  listAllProjects,
  getProject,
  updateProject,
  archiveProject,
  restoreProject,
  type NewProjectInput,
  type ProjectUpdateFields,
} from "@/db/projects";

function newInput(companyId: string, name = "Planta"): NewProjectInput {
  return {
    companyId,
    name,
    ownerUserId: null,
    stage: "lead_sin_contactar",
    stageGroup: "lead",
    status: "open",
    solutionType: "unknown",
    estimatedValue: null,
    notes: null,
  };
}

function updateFields(over: Partial<ProjectUpdateFields> = {}): ProjectUpdateFields {
  return {
    name: "Planta Norte",
    plantName: null,
    locationAddress: null,
    city: null,
    state: null,
    country: null,
    industrySubsegment: null,
    stage: "lead_sin_contactar",
    stageGroup: "lead",
    status: "open",
    solutionType: "unknown",
    estimatedValue: null,
    probability: null,
    expectedCloseDate: null,
    source: null,
    lostReason: null,
    lostReasonNote: null,
    notes: null,
    ...over,
  };
}

describe("createProject / listProjects", () => {
  it("crea un proyecto ligado a la company y lo lista", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const project = await createProject(db, newInput(company.id, "Planta Norte"));
    expect(project.companyId).toBe(company.id);
    expect(project.name).toBe("Planta Norte");
    const rows = await listProjects(db, company.id);
    expect(rows.map((r) => r.id)).toContain(project.id);
  });

  it("listProjects filtra por company y por archived", async () => {
    const db = await createTestDb();
    const a = await createCompany(db, { name: "A" });
    const b = await createCompany(db, { name: "B" });
    const pa = await createProject(db, newInput(a.id));
    await createProject(db, newInput(b.id));
    await archiveProject(db, pa.id);
    expect(await listProjects(db, a.id)).toHaveLength(0);
    expect(await listProjects(db, a.id, { archived: true })).toHaveLength(1);
    expect(await listProjects(db, b.id)).toHaveLength(1);
  });
});

describe("listAllProjects", () => {
  it("retorna todos con companyName y filtra archived", async () => {
    const db = await createTestDb();
    const a = await createCompany(db, { name: "Acme" });
    const p = await createProject(db, newInput(a.id, "Planta X"));
    const rows = await listAllProjects(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].companyName).toBe("Acme");
    await archiveProject(db, p.id);
    expect(await listAllProjects(db)).toHaveLength(0);
    expect(await listAllProjects(db, { archived: true })).toHaveLength(1);
  });
});

describe("getProject / updateProject / archive / restore", () => {
  it("getProject retorna la fila o undefined", async () => {
    const db = await createTestDb();
    const c = await createCompany(db, { name: "Acme" });
    const p = await createProject(db, newInput(c.id));
    expect((await getProject(db, p.id))?.id).toBe(p.id);
    expect(await getProject(db, "00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });

  it("updateProject actualiza campos y retorna la fila; undefined si no existe; updatedAt avanza", async () => {
    const db = await createTestDb();
    const c = await createCompany(db, { name: "Acme" });
    const p = await createProject(db, newInput(c.id));
    const updated = await updateProject(
      db,
      p.id,
      updateFields({ name: "Nueva", stage: "propuesta_enviada", stageGroup: "commercial", estimatedValue: 5000 })
    );
    expect(updated?.name).toBe("Nueva");
    expect(updated?.stage).toBe("propuesta_enviada");
    expect(updated?.stageGroup).toBe("commercial");
    expect(updated?.estimatedValue).toBe(5000);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(p.updatedAt.getTime());
    expect(await updateProject(db, "00000000-0000-0000-0000-000000000000", updateFields())).toBeUndefined();
  });

  it("archiveProject / restoreProject togglean archivedAt", async () => {
    const db = await createTestDb();
    const c = await createCompany(db, { name: "Acme" });
    const p = await createProject(db, newInput(c.id));
    expect((await archiveProject(db, p.id))?.archivedAt).not.toBeNull();
    expect((await restoreProject(db, p.id))?.archivedAt).toBeNull();
  });
});
