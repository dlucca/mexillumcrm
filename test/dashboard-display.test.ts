import { describe, it, expect } from "vitest";
import {
  stageIndex,
  STAGE_COUNT,
  potentialBand,
  POT_COLOR,
  groupStageRange,
  pipelineStepper,
} from "@/lib/dashboard-display";

describe("stageIndex", () => {
  it("primera etapa = 1, última = STAGE_COUNT", () => {
    expect(stageIndex("lead_sin_contactar")).toBe(1);
    expect(stageIndex("cliente_activo")).toBe(STAGE_COUNT);
    expect(STAGE_COUNT).toBe(13);
  });
  it("etapa intermedia conocida", () => {
    expect(stageIndex("propuesta_enviada")).toBe(7);
  });
  it("etapa desconocida → 0", () => {
    expect(stageIndex("no_existe")).toBe(0);
  });
});

describe("potentialBand", () => {
  it("null → null", () => {
    expect(potentialBand(null)).toBeNull();
  });
  it("bandas por umbral: <50 bajo, 50–69 medio, 70–84 alto, ≥85 muyalto", () => {
    expect(potentialBand(42)).toBe("bajo");
    expect(potentialBand(49)).toBe("bajo");
    expect(potentialBand(50)).toBe("medio");
    expect(potentialBand(69)).toBe("medio");
    expect(potentialBand(70)).toBe("alto");
    expect(potentialBand(84)).toBe("alto");
    expect(potentialBand(85)).toBe("muyalto");
    expect(potentialBand(100)).toBe("muyalto");
  });
  it("POT_COLOR cubre las 4 bandas con var(--pot-*)", () => {
    for (const b of ["bajo", "medio", "alto", "muyalto"]) {
      expect(POT_COLOR[b]).toMatch(/^var\(--pot-[a-z]+\)$/);
    }
  });
});

describe("groupStageRange", () => {
  it("rango 1-based de etapas por grupo según el mapeo real", () => {
    expect(groupStageRange("lead")).toEqual([1, 1]);
    expect(groupStageRange("qualification")).toEqual([2, 3]);
    expect(groupStageRange("solution")).toEqual([4, 6]);
    expect(groupStageRange("commercial")).toEqual([7, 9]);
    expect(groupStageRange("delivery")).toEqual([10, 12]);
    expect(groupStageRange("active")).toEqual([13, 13]);
  });
});

describe("pipelineStepper", () => {
  it("6 grupos en orden con label", () => {
    const segs = pipelineStepper("diagnostico_web");
    expect(segs.map((s) => s.group)).toEqual([
      "lead",
      "qualification",
      "solution",
      "commercial",
      "delivery",
      "active",
    ]);
    expect(segs[0].label).toBe("Lead");
  });
  it("grupos previos done (100), actual con fill parcial, siguientes upcoming (0)", () => {
    const segs = pipelineStepper("diagnostico_web"); // etapa 4, grupo solution [4,6]
    const by = Object.fromEntries(segs.map((s) => [s.group, s]));
    expect(by.lead.state).toBe("done");
    expect(by.lead.fill).toBe(100);
    expect(by.qualification.state).toBe("done");
    expect(by.solution.state).toBe("current");
    expect(by.solution.fill).toBeCloseTo(33.333, 2); // (4-4+1)/3
    expect(by.commercial.state).toBe("upcoming");
    expect(by.commercial.fill).toBe(0);
    expect(by.active.state).toBe("upcoming");
  });
  it("última etapa del grupo actual → fill 100", () => {
    const segs = pipelineStepper("propuesta_preparacion"); // etapa 6, fin de solution
    const sol = segs.find((s) => s.group === "solution")!;
    expect(sol.state).toBe("current");
    expect(sol.fill).toBe(100);
  });
  it("cliente_activo → todos done salvo active current al 100", () => {
    const segs = pipelineStepper("cliente_activo");
    const by = Object.fromEntries(segs.map((s) => [s.group, s]));
    expect(by.commercial.state).toBe("done");
    expect(by.active.state).toBe("current");
    expect(by.active.fill).toBe(100);
  });
});
