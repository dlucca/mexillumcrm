import { describe, it, expect } from "vitest";
import { parsePipelineFilters, hasActiveFilters, matchesFilters, filterProjects } from "@/lib/pipeline-filters";

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

type P = Parameters<typeof matchesFilters>[0];
function proj(over: Partial<P> = {}): P {
  return {
    stage: "lead_sin_contactar",
    stageGroup: "lead",
    solutionType: "solar",
    status: "open",
    estimatedValue: 1000,
    expectedCloseDate: "2026-06-15",
    name: "Planta Norte",
    companyName: "Acme",
    plantName: "Nave 1",
    ...over,
  };
}
const none = parsePipelineFilters({});

describe("matchesFilters", () => {
  it("sin filtros matchea todo", () => {
    expect(matchesFilters(proj(), none)).toBe(true);
  });
  it("filtra por cada enum", () => {
    expect(matchesFilters(proj({ status: "won" }), parsePipelineFilters({ status: "won" }))).toBe(true);
    expect(matchesFilters(proj({ status: "open" }), parsePipelineFilters({ status: "won" }))).toBe(false);
    expect(matchesFilters(proj({ stageGroup: "commercial" }), parsePipelineFilters({ group: "commercial" }))).toBe(true);
    expect(matchesFilters(proj({ solutionType: "bess" }), parsePipelineFilters({ solution: "solar" }))).toBe(false);
  });
  it("rango de valor inclusivo; estimatedValue null con bound → excluye; sin bound pasa", () => {
    const f = parsePipelineFilters({ valueMin: "500", valueMax: "1500" });
    expect(matchesFilters(proj({ estimatedValue: 1000 }), f)).toBe(true);
    expect(matchesFilters(proj({ estimatedValue: 500 }), f)).toBe(true);
    expect(matchesFilters(proj({ estimatedValue: 1500 }), f)).toBe(true);
    expect(matchesFilters(proj({ estimatedValue: 2000 }), f)).toBe(false);
    expect(matchesFilters(proj({ estimatedValue: null }), f)).toBe(false);
    expect(matchesFilters(proj({ estimatedValue: null }), none)).toBe(true);
  });
  it("rango de fecha lexicográfico inclusivo; expectedCloseDate null con bound → excluye", () => {
    const f = parsePipelineFilters({ closeFrom: "2026-01-01", closeTo: "2026-12-31" });
    expect(matchesFilters(proj({ expectedCloseDate: "2026-06-15" }), f)).toBe(true);
    expect(matchesFilters(proj({ expectedCloseDate: "2026-01-01" }), f)).toBe(true);
    expect(matchesFilters(proj({ expectedCloseDate: "2025-12-31" }), f)).toBe(false);
    expect(matchesFilters(proj({ expectedCloseDate: null }), f)).toBe(false);
  });
  it("q: case-insensitive y sin acentos, sobre name/companyName/plantName", () => {
    expect(matchesFilters(proj({ name: "Planta México" }), parsePipelineFilters({ q: "mexico" }))).toBe(true);
    expect(matchesFilters(proj({ companyName: "Açaí SA" }), parsePipelineFilters({ q: "acai" }))).toBe(true);
    expect(matchesFilters(proj({ plantName: "Nave Sur" }), parsePipelineFilters({ q: "SUR" }))).toBe(true);
    expect(matchesFilters(proj({ name: "X", companyName: "Y", plantName: "Z" }), parsePipelineFilters({ q: "nada" }))).toBe(false);
    expect(matchesFilters(proj({ name: "X", companyName: "Y", plantName: null }), parsePipelineFilters({ q: "nave" }))).toBe(false);
  });
});

describe("filterProjects", () => {
  it("aplica AND entre dimensiones", () => {
    const rows = [
      proj({ name: "A", status: "won", solutionType: "solar" }),
      proj({ name: "B", status: "won", solutionType: "bess" }),
      proj({ name: "C", status: "open", solutionType: "solar" }),
    ];
    const out = filterProjects(rows, parsePipelineFilters({ status: "won", solution: "solar" }));
    expect(out.map((p) => p.name)).toEqual(["A"]);
  });
});
