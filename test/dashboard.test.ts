import { describe, it, expect } from "vitest";
import {
  pipelineByStage,
  dashboardTotals,
  GROUP_COLORS,
  solutionMix,
  conversionRate,
  pipelineHealth,
} from "@/lib/dashboard";

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

describe("solutionMix", () => {
  it("agrupa valor por solution_type en orden canónico, con share y count; null→0", () => {
    const rows = solutionMix([
      { solutionType: "solar", estimatedValue: 100 },
      { solutionType: "solar", estimatedValue: null },
      { solutionType: "bess", estimatedValue: 300 },
      { solutionType: "solar_bess", estimatedValue: 100 },
    ]);
    // orden canónico solar, bess, solar_bess, unknown
    expect(rows.map((r) => r.type)).toEqual(["solar", "bess", "solar_bess", "unknown"]);
    const solar = rows.find((r) => r.type === "solar")!;
    expect(solar.label).toBe("Solar");
    expect(solar.value).toBe(100);
    expect(solar.count).toBe(2);
    expect(solar.share).toBeCloseTo(0.2, 5); // 100 / 500
    expect(rows.find((r) => r.type === "bess")!.share).toBeCloseTo(0.6, 5);
    expect(rows.find((r) => r.type === "unknown")!.value).toBe(0);
    expect(rows.find((r) => r.type === "unknown")!.share).toBe(0);
  });
  it("sin valor total → shares 0 (sin dividir por cero)", () => {
    const rows = solutionMix([{ solutionType: "solar", estimatedValue: null }]);
    expect(rows.every((r) => r.share === 0)).toBe(true);
  });
});

describe("conversionRate", () => {
  it("won/(won+lost); active_customer cuenta como won; ignora abiertos/pausados", () => {
    const r = conversionRate([
      { status: "won" },
      { status: "active_customer" },
      { status: "won" },
      { status: "lost" },
      { status: "open" },
      { status: "paused" },
    ]);
    expect(r.won).toBe(3);
    expect(r.lost).toBe(1);
    expect(r.rate).toBeCloseTo(0.75, 5);
  });
  it("sin proyectos cerrados → rate null", () => {
    const r = conversionRate([{ status: "open" }]);
    expect(r.won).toBe(0);
    expect(r.lost).toBe(0);
    expect(r.rate).toBeNull();
  });
});

describe("pipelineHealth", () => {
  const today = "2026-08-13"; // umbral stale (7d) = 2026-08-06
  it("atRisk por task vencida; momentum por actividad reciente; stale por inactividad o sin actividad", () => {
    const projects = [
      { id: "p1", status: "open" }, // vencida → atRisk aunque tenga actividad reciente
      { id: "p2", status: "open" }, // actividad 08-10 → momentum
      { id: "p3", status: "open" }, // actividad 07-30 → stale
      { id: "p4", status: "open" }, // sin actividad → stale
      { id: "p5", status: "won" }, // cerrado → excluido
    ];
    const lastActivity = new Map<string, string>([
      ["p1", "2026-08-12"],
      ["p2", "2026-08-10"],
      ["p3", "2026-07-30"],
    ]);
    const openTasks = [
      { projectId: "p1", dueDate: "2026-08-01" },
      { projectId: "p2", dueDate: "2026-08-20" },
    ];
    const h = pipelineHealth(projects, lastActivity, openTasks, today);
    expect(h.total).toBe(4);
    expect(h.atRisk).toBe(1);
    expect(h.momentum).toBe(1);
    expect(h.stale).toBe(2);
  });
});
