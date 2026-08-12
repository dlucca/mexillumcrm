import { describe, it, expect, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { listProjects, listAllProjects } from "@/db/projects";
import { runCreateProject, runUpdateProject } from "@/lib/project-mutations";
import { listActivitiesForProject } from "@/db/activities";
import * as activityLog from "@/lib/activity-log";

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
      "11111111-1111-1111-1111-111111111111"
    );
    expect(result).toEqual({ ok: true });
    const [row] = await listProjects(db, company.id);
    expect(row.name).toBe("Planta Norte");
    expect(row.stage).toBe("propuesta_enviada");
    expect(row.stageGroup).toBe("commercial");
    expect(row.status).toBe("open");
    expect(row.ownerUserId).toBe("11111111-1111-1111-1111-111111111111");
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

  it("registra una Activity 'system' al crear el proyecto", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    await runCreateProject(
      db,
      formOf({ companyId: company.id, name: "Planta", stage: "lead_sin_contactar" }),
      "33333333-3333-3333-3333-333333333333"
    );
    const [proj] = await listProjects(db, company.id);
    const acts = await listActivitiesForProject(db, proj.id);
    expect(acts).toHaveLength(1);
    expect(acts[0].type).toBe("system");
    expect(acts[0].source).toBe("system");
    expect(acts[0].companyId).toBe(company.id);
    expect(acts[0].userId).toBe("33333333-3333-3333-3333-333333333333");
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

  it("cambiar la etapa registra exactamente 1 stage_change con metadata y actor", async () => {
    const { db, company, id } = await seed();
    const res = await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P", stage: "outreach_enviado", status: "open", solutionType: "unknown" }),
      "44444444-4444-4444-4444-444444444444"
    );
    expect(res).toEqual({ ok: true });
    const acts = (await listActivitiesForProject(db, id)).filter((a) => a.type === "stage_change");
    expect(acts).toHaveLength(1);
    expect(acts[0].userId).toBe("44444444-4444-4444-4444-444444444444");
    expect(acts[0].metadata).toEqual({
      fromStage: "lead_sin_contactar",
      toStage: "outreach_enviado",
      fromGroup: "lead",
      toGroup: "qualification",
    });
  });

  it("no registra stage_change si la etapa no cambia", async () => {
    const { db, company, id } = await seed();
    await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "Nuevo nombre", stage: "lead_sin_contactar", status: "open", solutionType: "unknown" })
    );
    const acts = (await listActivitiesForProject(db, id)).filter((a) => a.type === "stage_change");
    expect(acts).toHaveLength(0);
  });

  it("rollback: si falla el registro de stage_change, el update se revierte", async () => {
    const { db, company, id } = await seed();
    const spy = vi.spyOn(activityLog, "stageChangeMetadata").mockImplementation(() => {
      throw new Error("boom");
    });
    const res = await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P", stage: "contrato_firmado", status: "open", solutionType: "unknown" })
    );
    expect(res.ok).toBe(false);
    const [row] = await listAllProjects(db);
    expect(row.stage).toBe("lead_sin_contactar"); // revertido
    spy.mockRestore();
  });
});
