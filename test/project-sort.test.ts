import { describe, it, expect } from "vitest";
import { sortProjects, PROJECT_SORTS } from "@/lib/project-sort";

const ps = [
  { name: "B", estimatedValue: 100, probability: 50, stage: "propuesta_enviada" }, // etapa 7
  { name: "A", estimatedValue: null, probability: 90, stage: "lead_sin_contactar" }, // etapa 1
  { name: "C", estimatedValue: 300, probability: null, stage: "cliente_activo" }, // etapa 13
];
const names = (arr: { name: string }[]) => arr.map((p) => p.name);

describe("sortProjects", () => {
  it("value (default): valor desc, nulls al final", () => {
    expect(names(sortProjects(ps, "value"))).toEqual(["C", "B", "A"]);
    expect(names(sortProjects(ps, "cualquier_cosa"))).toEqual(["C", "B", "A"]);
  });
  it("value_asc: valor asc, nulls al final", () => {
    expect(names(sortProjects(ps, "value_asc"))).toEqual(["B", "C", "A"]);
  });
  it("potential: probabilidad desc, nulls al final", () => {
    expect(names(sortProjects(ps, "potential"))).toEqual(["A", "B", "C"]);
  });
  it("stage: por índice de etapa desc", () => {
    expect(names(sortProjects(ps, "stage"))).toEqual(["C", "B", "A"]);
  });
  it("name: alfabético", () => {
    expect(names(sortProjects(ps, "name"))).toEqual(["A", "B", "C"]);
  });
  it("no muta el arreglo original", () => {
    const copy = [...ps];
    sortProjects(ps, "name");
    expect(ps).toEqual(copy);
  });
  it("PROJECT_SORTS expone las opciones con label", () => {
    expect(PROJECT_SORTS.map((o) => o.value)).toContain("value");
    for (const o of PROJECT_SORTS) expect(typeof o.label).toBe("string");
  });
});
