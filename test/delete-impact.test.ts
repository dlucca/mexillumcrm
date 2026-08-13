import { describe, it, expect } from "vitest";
import { buildImpactRows, matchesConfirmation } from "@/lib/delete-impact";

describe("buildImpactRows", () => {
  it("ordena las filas: proyectos, contactos, actividades, tareas, pipeline", () => {
    const rows = buildImpactRows({
      pipelineValueMxn: 18_000_000,
      tasks: 2,
      activities: 24,
      contacts: 3,
      projects: 3,
    });
    expect(rows.map((r) => r.key)).toEqual([
      "projects",
      "contacts",
      "activities",
      "tasks",
      "pipeline",
    ]);
  });

  it("omite filas con conteo 0 o indefinido", () => {
    const rows = buildImpactRows({ projects: 1, contacts: 0, activities: 5 });
    expect(rows.map((r) => r.key)).toEqual(["projects", "activities"]);
  });

  it("omite el pipeline cuando es 0, nulo o indefinido", () => {
    expect(buildImpactRows({ pipelineValueMxn: 0 })).toHaveLength(0);
    expect(buildImpactRows({ pipelineValueMxn: null })).toHaveLength(0);
    expect(buildImpactRows({})).toHaveLength(0);
  });

  it("usa singular con conteo 1 y plural con más", () => {
    const one = buildImpactRows({ projects: 1, contacts: 1, activities: 1, tasks: 1 });
    expect(one.map((r) => r.label)).toEqual([
      "proyecto (planta)",
      "contacto",
      "actividad registrada",
      "tarea",
    ]);
    const many = buildImpactRows({ projects: 2, contacts: 2, activities: 2, tasks: 2 });
    expect(many.map((r) => r.label)).toEqual([
      "proyectos (plantas)",
      "contactos",
      "actividades registradas",
      "tareas",
    ]);
  });

  it("muestra el conteo como texto y el pipeline como USD compacto", () => {
    const rows = buildImpactRows({ projects: 3, pipelineValueMxn: 18_000_000 });
    expect(rows[0]).toMatchObject({ key: "projects", value: "3" });
    // 18M MXN / 18 = 1M USD
    expect(rows[1]).toMatchObject({ key: "pipeline", value: "$1M", label: "en pipeline asociado" });
  });
});

describe("matchesConfirmation", () => {
  it("acepta el nombre exacto", () => {
    expect(matchesConfirmation("Grupo Alcázar", "Grupo Alcázar")).toBe(true);
  });

  it("ignora espacios sobrantes al inicio y final", () => {
    expect(matchesConfirmation("  Grupo Alcázar  ", "Grupo Alcázar")).toBe(true);
  });

  it("rechaza un nombre parcial o distinto", () => {
    expect(matchesConfirmation("Grupo", "Grupo Alcázar")).toBe(false);
    expect(matchesConfirmation("", "Grupo Alcázar")).toBe(false);
  });

  it("distingue mayúsculas de minúsculas", () => {
    expect(matchesConfirmation("grupo alcázar", "Grupo Alcázar")).toBe(false);
  });
});
