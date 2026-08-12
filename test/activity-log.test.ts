import { describe, it, expect } from "vitest";
import {
  ACTIVITY_TYPE_VALUES,
  stageChangeMetadata,
  describeStageChange,
  activityTypeLabel,
  activityHeadline,
  commercialMomentForStage,
  commercialMomentLabel,
} from "@/lib/activity-log";

describe("activity-log helpers", () => {
  it("ACTIVITY_TYPE_VALUES tiene los 12 tipos del PRD", () => {
    expect(ACTIVITY_TYPE_VALUES).toContain("stage_change");
    expect(ACTIVITY_TYPE_VALUES).toContain("note");
    expect(ACTIVITY_TYPE_VALUES).toContain("system");
    expect(ACTIVITY_TYPE_VALUES).toHaveLength(12);
  });

  it("stageChangeMetadata deriva los grupos", () => {
    expect(stageChangeMetadata("lead_sin_contactar", "outreach_enviado")).toEqual({
      fromStage: "lead_sin_contactar",
      toStage: "outreach_enviado",
      fromGroup: "lead",
      toGroup: "qualification",
    });
  });

  it("describeStageChange usa labels legibles", () => {
    const md = stageChangeMetadata("lead_sin_contactar", "outreach_enviado");
    expect(describeStageChange(md)).toBe("Lead / sin contactar → Outreach enviado");
  });

  it("activityTypeLabel devuelve label español", () => {
    expect(activityTypeLabel("note")).toBe("Nota");
    expect(activityTypeLabel("stage_change")).toBe("Cambio de etapa");
  });

  it("activityHeadline por tipo", () => {
    expect(
      activityHeadline({
        type: "stage_change",
        body: null,
        metadata: stageChangeMetadata("lead_sin_contactar", "outreach_enviado"),
      })
    ).toBe("Lead / sin contactar → Outreach enviado");
    expect(activityHeadline({ type: "system", body: null, metadata: null })).toBe("Proyecto creado");
    expect(activityHeadline({ type: "note", body: "una nota", metadata: null })).toBe("una nota");
  });

  it("activityHeadline para momentos comerciales", () => {
    expect(activityHeadline({ type: "proposal", body: null, metadata: { moment: "sent" } })).toBe("Propuesta enviada");
    expect(activityHeadline({ type: "contract", body: null, metadata: { moment: "signed" } })).toBe("Contrato firmado");
  });

  it("activityHeadline sin metadata cae al label del tipo", () => {
    expect(activityHeadline({ type: "proposal", body: null, metadata: null })).toBe("Propuesta");
  });
});

describe("commercialMomentForStage", () => {
  it("mapea las 4 etapas gatillo", () => {
    expect(commercialMomentForStage("propuesta_enviada")).toEqual({ type: "proposal", moment: "sent" });
    expect(commercialMomentForStage("propuesta_aceptada")).toEqual({ type: "proposal", moment: "accepted" });
    expect(commercialMomentForStage("contrato_enviado")).toEqual({ type: "contract", moment: "sent" });
    expect(commercialMomentForStage("contrato_firmado")).toEqual({ type: "contract", moment: "signed" });
  });
  it("otras etapas → null", () => {
    expect(commercialMomentForStage("lead_sin_contactar")).toBeNull();
    expect(commercialMomentForStage("cliente_activo")).toBeNull();
  });
});

describe("commercialMomentLabel", () => {
  it("labels español por (type, moment)", () => {
    expect(commercialMomentLabel("proposal", "sent")).toBe("Propuesta enviada");
    expect(commercialMomentLabel("proposal", "accepted")).toBe("Propuesta aceptada");
    expect(commercialMomentLabel("contract", "sent")).toBe("Contrato enviado");
    expect(commercialMomentLabel("contract", "signed")).toBe("Contrato firmado");
  });
  it("combinación desconocida → label del tipo", () => {
    expect(commercialMomentLabel("proposal", "signed")).toBe("Propuesta");
  });
});
