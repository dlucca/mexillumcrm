import { describe, it, expect } from "vitest";
import { stageIndex, STAGE_COUNT } from "@/lib/dashboard-display";

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
