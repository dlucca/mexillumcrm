import { describe, it, expect } from "vitest";
import { stageGroupFor, labelOf, formatMXN, STAGES, autoStatusForStage } from "@/lib/project-pipeline";

describe("stageGroupFor", () => {
  const cases: Array<[string, string]> = [
    ["lead_sin_contactar", "lead"],
    ["outreach_enviado", "qualification"],
    ["respondio_interesado", "qualification"],
    ["diagnostico_web", "solution"],
    ["webcall_discovery", "solution"],
    ["propuesta_preparacion", "solution"],
    ["propuesta_enviada", "commercial"],
    ["negociacion_objeciones", "commercial"],
    ["propuesta_aceptada", "commercial"],
    ["contrato_enviado", "delivery"],
    ["contrato_firmado", "delivery"],
    ["onboarding_kickoff", "delivery"],
    ["cliente_activo", "active"],
  ];
  it.each(cases)("%s -> %s", (stage, group) => {
    expect(stageGroupFor(stage)).toBe(group);
  });
  it("cubre las 13 etapas", () => {
    expect(cases.map((c) => c[0]).sort()).toEqual(STAGES.map((s) => s.value).sort());
  });
  it("stage desconocido cae a lead", () => {
    expect(stageGroupFor("no_existe")).toBe("lead");
  });
});

describe("labelOf / formatMXN", () => {
  it("labelOf devuelve el label o — para null", () => {
    expect(labelOf(STAGES, "cliente_activo")).toBe("Cliente activo");
    expect(labelOf(STAGES, null)).toBe("—");
  });
  it("formatMXN formatea o devuelve —", () => {
    expect(formatMXN(null)).toBe("—");
    expect(formatMXN(1500000)).toContain("1,500,000");
  });
});

describe("autoStatusForStage", () => {
  it("contrato_firmado → won", () => {
    expect(autoStatusForStage("contrato_firmado")).toBe("won");
  });
  it("cliente_activo → active_customer", () => {
    expect(autoStatusForStage("cliente_activo")).toBe("active_customer");
  });
  it("otras etapas → null", () => {
    expect(autoStatusForStage("lead_sin_contactar")).toBeNull();
    expect(autoStatusForStage("propuesta_enviada")).toBeNull();
    expect(autoStatusForStage("contrato_enviado")).toBeNull();
  });
});
