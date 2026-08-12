import { describe, it, expect } from "vitest";
import {
  ACTIVITY_TYPE_VALUES,
  stageChangeMetadata,
  describeStageChange,
  activityTypeLabel,
  activityHeadline,
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
});
