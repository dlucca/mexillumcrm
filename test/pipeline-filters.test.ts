import { describe, it, expect } from "vitest";
import { parsePipelineFilters, hasActiveFilters } from "@/lib/pipeline-filters";

describe("parsePipelineFilters", () => {
  it("mapea enums válidos y deja el resto null", () => {
    const f = parsePipelineFilters({ stage: "propuesta_enviada", solution: "solar" });
    expect(f.stage).toBe("propuesta_enviada");
    expect(f.solution).toBe("solar");
    expect(f.group).toBeNull();
    expect(f.status).toBeNull();
  });
  it("rechaza enums inválidos → null", () => {
    const f = parsePipelineFilters({ stage: "nope", group: "xx", solution: "yy", status: "zz" });
    expect(f.stage).toBeNull();
    expect(f.group).toBeNull();
    expect(f.solution).toBeNull();
    expect(f.status).toBeNull();
  });
  it("parsea ints de valor; no numérico → null", () => {
    const f = parsePipelineFilters({ valueMin: "1000", valueMax: "abc" });
    expect(f.valueMin).toBe(1000);
    expect(f.valueMax).toBeNull();
  });
  it("pasa fechas como string y trimea q; q vacío → null", () => {
    const f = parsePipelineFilters({ closeFrom: "2026-01-01", q: "  hola  " });
    expect(f.closeFrom).toBe("2026-01-01");
    expect(f.q).toBe("hola");
    expect(parsePipelineFilters({ q: "   " }).q).toBeNull();
  });
  it("toma el primer valor si viene array", () => {
    const f = parsePipelineFilters({ stage: ["propuesta_enviada", "otra"] });
    expect(f.stage).toBe("propuesta_enviada");
  });
});

describe("hasActiveFilters", () => {
  it("sin filtros → false", () => {
    expect(hasActiveFilters(parsePipelineFilters({}))).toBe(false);
  });
  it("con cualquier filtro → true", () => {
    expect(hasActiveFilters(parsePipelineFilters({ q: "x" }))).toBe(true);
  });
});
