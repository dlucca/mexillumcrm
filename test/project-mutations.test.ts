import { describe, it, expect } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { listProjects, listAllProjects } from "@/db/projects";
import { runCreateProject, runUpdateProject } from "@/lib/project-mutations";

function formOf(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("runCreateProject", () => {
  it("crea con defaults y deriva stage_group", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const result = await runCreateProject(
      db,
      formOf({ companyId: company.id, name: "Planta Norte", stage: "propuesta_enviada" }),
      "user-123"
    );
    expect(result).toEqual({ ok: true });
    const [row] = await listProjects(db, company.id);
    expect(row.name).toBe("Planta Norte");
    expect(row.stage).toBe("propuesta_enviada");
    expect(row.stageGroup).toBe("commercial");
    expect(row.status).toBe("open");
    expect(row.ownerUserId).toBe("user-123");
  });

  it("aplica defaults cuando faltan stage/solution", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    await runCreateProject(db, formOf({ companyId: company.id, name: "P" }), null);
    const [row] = await listProjects(db, company.id);
    expect(row.stage).toBe("lead_sin_contactar");
    expect(row.stageGroup).toBe("lead");
    expect(row.solutionType).toBe("unknown");
  });

  it("falla con name vacío", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const result = await runCreateProject(db, formOf({ companyId: company.id, name: "  " }), null);
    expect(result.ok).toBe(false);
  });

  it("falla con companyId no-uuid", async () => {
    const db = await createTestDb();
    const result = await runCreateProject(db, formOf({ companyId: "nope", name: "P" }), null);
    expect(result).toEqual({ ok: false, error: "Empresa inválida" });
  });
});

describe("runUpdateProject", () => {
  async function seed() {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    await runCreateProject(db, formOf({ companyId: company.id, name: "P" }), null);
    const [row] = await listProjects(db, company.id);
    return { db, company, id: row.id };
  }

  it("actualiza y re-deriva stage_group", async () => {
    const { db, company, id } = await seed();
    const result = await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P2", stage: "contrato_enviado", status: "open", solutionType: "solar" })
    );
    expect(result).toEqual({ ok: true });
    const [row] = await listAllProjects(db);
    expect(row.name).toBe("P2");
    expect(row.stage).toBe("contrato_enviado");
    expect(row.stageGroup).toBe("delivery");
    expect(row.solutionType).toBe("solar");
  });

  it("falla si falta id", async () => {
    const { db } = await seed();
    const result = await runUpdateProject(db, formOf({ name: "P" }));
    expect(result).toEqual({ ok: false, error: "Falta el identificador del proyecto" });
  });

  it("status=lost sin lostReason falla; con lostReason ok", async () => {
    const { db, company, id } = await seed();
    const base = { id, companyId: company.id, name: "P", stage: "negociacion_objeciones", solutionType: "unknown" };
    const bad = await runUpdateProject(db, formOf({ ...base, status: "lost" }));
    expect(bad).toEqual({ ok: false, error: "Falta el motivo de pérdida" });
    const good = await runUpdateProject(db, formOf({ ...base, status: "lost", lostReason: "precio" }));
    expect(good).toEqual({ ok: true });
  });

  it("id inexistente → No se encontró el proyecto", async () => {
    const { db, company } = await seed();
    const result = await runUpdateProject(
      db,
      formOf({
        id: "00000000-0000-0000-0000-000000000000",
        companyId: company.id,
        name: "P",
        stage: "lead_sin_contactar",
        status: "open",
        solutionType: "unknown",
      })
    );
    expect(result).toEqual({ ok: false, error: "No se encontró el proyecto" });
  });
});
