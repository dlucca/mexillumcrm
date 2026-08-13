import { describe, it, expect } from "vitest";
import { pipelineByStage, dashboardTotals, GROUP_COLORS } from "@/lib/dashboard";

describe("pipelineByStage", () => {
  it("13 etapas en orden, con grupo, conteo y suma; null→0; vacías presentes", () => {
    const rows = pipelineByStage([
      { stage: "lead_sin_contactar", estimatedValue: 100 },
      { stage: "lead_sin_contactar", estimatedValue: null },
      { stage: "propuesta_enviada", estimatedValue: 500 },
    ]);
    expect(rows).toHaveLength(13);
    expect(rows[0].stage).toBe("lead_sin_contactar");
    expect(rows[0].label).toBe("Lead / sin contactar");
    expect(rows[0].group).toBe("lead");
    expect(rows[0].count).toBe(2);
    expect(rows[0].totalValue).toBe(100); // null cuenta 0
    const prop = rows.find((r) => r.stage === "propuesta_enviada")!;
    expect(prop.group).toBe("commercial");
    expect(prop.count).toBe(1);
    expect(prop.totalValue).toBe(500);
    const empty = rows.find((r) => r.stage === "diagnostico_web")!;
    expect(empty.count).toBe(0);
    expect(empty.totalValue).toBe(0);
  });
});

describe("dashboardTotals", () => {
  const today = "2026-08-12";
  it("openCount/openValue solo status open; null→0", () => {
    const t = dashboardTotals(
      [
        { id: "a", status: "open", estimatedValue: 100 },
        { id: "b", status: "open", estimatedValue: null },
        { id: "c", status: "won", estimatedValue: 999 },
      ],
      [],
      today
    );
    expect(t.openCount).toBe(2);
    expect(t.openValue).toBe(100);
  });
  it("missingNextAction: projects open sin task abierta", () => {
    const t = dashboardTotals(
      [
        { id: "a", status: "open", estimatedValue: 0 },
        { id: "b", status: "open", estimatedValue: 0 },
      ],
      [{ projectId: "a", dueDate: "2026-09-01" }],
      today
    );
    expect(t.missingNextAction).toBe(1);
  });
  it("overdueTasks: due_date < today", () => {
    const t = dashboardTotals(
      [],
      [
        { projectId: "x", dueDate: "2026-08-01" },
        { projectId: "y", dueDate: "2026-08-12" },
        { projectId: "z", dueDate: "2026-08-20" },
      ],
      today
    );
    expect(t.overdueTasks).toBe(1);
  });
});

describe("GROUP_COLORS", () => {
  it("cubre los 6 grupos con var(--pipe-N)", () => {
    for (const g of ["lead", "qualification", "solution", "commercial", "delivery", "active"]) {
      expect(GROUP_COLORS[g]).toMatch(/^var\(--pipe-\d\)$/);
    }
  });
});
