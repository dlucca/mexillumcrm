import { describe, it, expect } from "vitest";
import { summarizeCompanyProjects } from "@/lib/companies";

describe("summarizeCompanyProjects", () => {
  it("agrega valor total, grupos y soluciones únicos en orden canónico, y estado por proyecto más avanzado", () => {
    const s = summarizeCompanyProjects([
      { stageGroup: "commercial", stage: "propuesta_enviada", solutionType: "solar_bess", estimatedValue: 3240000, status: "open" },
      { stageGroup: "solution", stage: "diagnostico_web", solutionType: "solar", estimatedValue: 3100000, status: "open" },
      { stageGroup: "lead", stage: "outreach_enviado", solutionType: "bess", estimatedValue: 2600000, status: "open" },
    ]);
    expect(s.count).toBe(3);
    expect(s.totalValue).toBe(8940000);
    expect(s.groups).toEqual(["lead", "solution", "commercial"]); // orden STAGE_GROUPS
    expect(s.solutions).toEqual(["solar", "bess", "solar_bess"]); // orden SOLUTION_TYPES, sin unknown
    expect(s.status.key).toBe("commercial"); // etapa abierta más avanzada (idx 7)
    expect(s.status.label).toBe("Commercial");
  });

  it("null en valor cuenta 0; unknown se excluye de soluciones", () => {
    const s = summarizeCompanyProjects([
      { stageGroup: "lead", stage: "lead_sin_contactar", solutionType: "unknown", estimatedValue: null, status: "open" },
    ]);
    expect(s.totalValue).toBe(0);
    expect(s.solutions).toEqual([]);
    expect(s.status.key).toBe("lead");
  });

  it("cliente activo domina el estado", () => {
    const s = summarizeCompanyProjects([
      { stageGroup: "active", stage: "cliente_activo", solutionType: "solar", estimatedValue: 100, status: "active_customer" },
      { stageGroup: "lead", stage: "lead_sin_contactar", solutionType: "solar", estimatedValue: 100, status: "open" },
    ]);
    expect(s.status.key).toBe("active");
    expect(s.status.label).toBe("Cliente activo");
  });

  it("sin proyectos → estado 'none'", () => {
    const s = summarizeCompanyProjects([]);
    expect(s.count).toBe(0);
    expect(s.status.key).toBe("none");
    expect(s.groups).toEqual([]);
  });

  it("sin abiertos ni activos (todos perdidos) → estado 'closed'", () => {
    const s = summarizeCompanyProjects([
      { stageGroup: "commercial", stage: "propuesta_enviada", solutionType: "solar", estimatedValue: 500, status: "lost" },
    ]);
    expect(s.status.key).toBe("closed");
  });
});
