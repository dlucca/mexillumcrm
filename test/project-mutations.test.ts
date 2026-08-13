import { describe, it, expect, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { createCompany } from "@/db/companies";
import { listProjects, listAllProjects } from "@/db/projects";
import { runCreateProject, runUpdateProject, runMoveProjectStage } from "@/lib/project-mutations";
import { listActivitiesForProject } from "@/db/activities";
import * as activityLog from "@/lib/activity-log";
import type { AnyDb as AnyDbT } from "@/db/types";

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

  it("persiste city, state, probability y status", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const result = await runCreateProject(
      db,
      formOf({
        companyId: company.id,
        name: "Ramos Arizpe — Nave 2",
        city: "Ramos Arizpe",
        state: "Coahuila",
        solutionType: "solar_bess",
        estimatedValue: "3100000",
        probability: "70",
        status: "paused",
      }),
      null
    );
    expect(result).toEqual({ ok: true });
    const [row] = await listProjects(db, company.id);
    expect(row.city).toBe("Ramos Arizpe");
    expect(row.state).toBe("Coahuila");
    expect(row.solutionType).toBe("solar_bess");
    expect(row.estimatedValue).toBe(3100000);
    expect(row.probability).toBe(70);
    expect(row.status).toBe("paused");
  });

  it("status default open y probability/city null cuando se omiten", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    await runCreateProject(db, formOf({ companyId: company.id, name: "P" }), null);
    const [row] = await listProjects(db, company.id);
    expect(row.status).toBe("open");
    expect(row.probability).toBeNull();
    expect(row.city).toBeNull();
    expect(row.state).toBeNull();
  });

  it("rechaza probability fuera de rango", async () => {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    const result = await runCreateProject(
      db,
      formOf({ companyId: company.id, name: "P", probability: "150" }),
      null
    );
    expect(result.ok).toBe(false);
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

  async function moveTo(db: AnyDbT, company: { id: string }, id: string, stage: string, status = "open") {
    return runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P", stage, status, solutionType: "unknown" })
    );
  }

  it("entrar a propuesta_enviada crea stage_change + proposal/sent, status queda open", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "propuesta_enviada");
    const acts = await listActivitiesForProject(db, id);
    const moments = acts.filter((a) => a.type === "proposal");
    expect(acts.filter((a) => a.type === "stage_change")).toHaveLength(1);
    expect(moments).toHaveLength(1);
    expect(moments[0].metadata).toEqual({ moment: "sent" });
    expect(moments[0].source).toBe("system");
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("open");
  });

  it("entrar a propuesta_aceptada crea proposal/accepted", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "propuesta_aceptada");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "proposal");
    expect(moments).toHaveLength(1);
    expect(moments[0].metadata).toEqual({ moment: "accepted" });
  });

  it("entrar a contrato_enviado crea contract/sent, status queda open", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "contrato_enviado");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "contract");
    expect(moments).toHaveLength(1);
    expect(moments[0].metadata).toEqual({ moment: "sent" });
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("open");
  });

  it("entrar a contrato_firmado crea contract/signed y fuerza status=won (form manda open)", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "contrato_firmado", "open");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "contract");
    expect(moments).toHaveLength(1);
    expect(moments[0].metadata).toEqual({ moment: "signed" });
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("won");
  });

  it("entrar a cliente_activo fuerza status=active_customer y NO crea momento", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "cliente_activo", "open");
    const acts = await listActivitiesForProject(db, id);
    expect(acts.filter((a) => a.type === "proposal" || a.type === "contract")).toHaveLength(0);
    expect(acts.filter((a) => a.type === "stage_change")).toHaveLength(1);
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("active_customer");
  });

  it("entrar a etapa no-gatillo → solo stage_change, sin momento, status respetado", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "webcall_discovery", "paused");
    const acts = await listActivitiesForProject(db, id);
    expect(acts.filter((a) => a.type === "proposal" || a.type === "contract")).toHaveLength(0);
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("paused");
  });

  it("guardar sin cambio de etapa no re-fuerza ni crea momento; status enviado respetado", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "contrato_firmado", "open"); // ahora won
    // segundo guardado: misma etapa, status manual paused
    await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P", stage: "contrato_firmado", status: "paused", solutionType: "unknown" })
    );
    const contracts = (await listActivitiesForProject(db, id)).filter((a) => a.type === "contract");
    expect(contracts).toHaveLength(1); // no se duplicó
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("paused"); // no re-forzado a won
  });

  it("re-entrar a propuesta_enviada dispara el momento otra vez", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "propuesta_enviada");
    await moveTo(db, company, id, "negociacion_objeciones");
    await moveTo(db, company, id, "propuesta_enviada");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "proposal");
    expect(moments).toHaveLength(2);
  });

  it("mover hacia atrás desde won no revierte el status", async () => {
    const { db, company, id } = await seed();
    await moveTo(db, company, id, "contrato_firmado", "open"); // won
    // el form mandaría el status actual (won) al mover la etapa
    await moveTo(db, company, id, "negociacion_objeciones", "won");
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("won");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "proposal" || a.type === "contract");
    expect(moments).toHaveLength(1); // solo el contract/signed original
  });

  it("forzar won limpia un lostReason viejo", async () => {
    const { db, company, id } = await seed();
    // marcar como perdido con motivo en una etapa cualquiera
    await runUpdateProject(
      db,
      formOf({ id, companyId: company.id, name: "P", stage: "negociacion_objeciones", status: "lost", lostReason: "precio", solutionType: "unknown" })
    );
    // entrar a contrato_firmado → won automático debe limpiar el motivo de pérdida
    await moveTo(db, company, id, "contrato_firmado", "open");
    const [row] = await listAllProjects(db);
    expect(row.status).toBe("won");
    expect(row.lostReason).toBeNull();
    expect(row.lostReasonNote).toBeNull();
  });
});

describe("runMoveProjectStage", () => {
  async function seed() {
    const db = await createTestDb();
    const company = await createCompany(db, { name: "Acme" });
    await runCreateProject(db, formOf({ companyId: company.id, name: "P" }), null);
    const [row] = await listProjects(db, company.id);
    return { db, company, id: row.id }; // arranca en lead_sin_contactar
  }

  it("cambia stage + stageGroup y registra 1 stage_change", async () => {
    const { db, id } = await seed();
    const res = await runMoveProjectStage(db, formOf({ projectId: id, stage: "outreach_enviado" }), "22222222-2222-2222-2222-222222222222");
    expect(res).toEqual({ ok: true });
    const [p] = await listAllProjects(db);
    expect(p.stage).toBe("outreach_enviado");
    expect(p.stageGroup).toBe("qualification");
    const acts = (await listActivitiesForProject(db, id)).filter((a) => a.type === "stage_change");
    expect(acts).toHaveLength(1);
    expect(acts[0].userId).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("entrar a propuesta_enviada registra el momento proposal/sent", async () => {
    const { db, id } = await seed();
    await runMoveProjectStage(db, formOf({ projectId: id, stage: "propuesta_enviada" }), null);
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "proposal");
    expect(moments).toHaveLength(1);
    expect(moments[0].metadata).toEqual({ moment: "sent" });
  });

  it("entrar a contrato_firmado fuerza won + momento contract/signed", async () => {
    const { db, id } = await seed();
    await runMoveProjectStage(db, formOf({ projectId: id, stage: "contrato_firmado" }), null);
    const [p] = await listAllProjects(db);
    expect(p.status).toBe("won");
    const moments = (await listActivitiesForProject(db, id)).filter((a) => a.type === "contract");
    expect(moments[0].metadata).toEqual({ moment: "signed" });
  });

  it("misma etapa → no-op sin activities de transición", async () => {
    const { db, id } = await seed();
    await runMoveProjectStage(db, formOf({ projectId: id, stage: "lead_sin_contactar" }), null);
    const acts = (await listActivitiesForProject(db, id)).filter((a) => a.type === "stage_change");
    expect(acts).toHaveLength(0);
  });

  it("project inexistente → error", async () => {
    const { db } = await seed();
    const res = await runMoveProjectStage(db, formOf({ projectId: "00000000-0000-0000-0000-000000000000", stage: "outreach_enviado" }), null);
    expect(res).toEqual({ ok: false, error: "No se encontró el proyecto" });
  });

  it("stage inválida → error", async () => {
    const { db, id } = await seed();
    const res = await runMoveProjectStage(db, formOf({ projectId: id, stage: "nope" }), null);
    expect(res.ok).toBe(false);
  });
});
