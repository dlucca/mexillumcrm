import { describe, it, expect } from "vitest";
import { groupProjectsByStageGroup, nextActionByProject } from "@/lib/pipeline";

describe("groupProjectsByStageGroup", () => {
  it("devuelve 6 columnas en orden, con counts y totals; incluye vacías", () => {
    const projects = [
      { stageGroup: "lead", estimatedValue: 100 },
      { stageGroup: "lead", estimatedValue: null },
      { stageGroup: "commercial", estimatedValue: 500 },
    ];
    const cols = groupProjectsByStageGroup(projects);
    expect(cols.map((c) => c.group)).toEqual(["lead", "qualification", "solution", "commercial", "delivery", "active"]);
    const lead = cols.find((c) => c.group === "lead")!;
    expect(lead.count).toBe(2);
    expect(lead.totalValue).toBe(100); // null cuenta como 0
    const commercial = cols.find((c) => c.group === "commercial")!;
    expect(commercial.count).toBe(1);
    expect(commercial.totalValue).toBe(500);
    const qualification = cols.find((c) => c.group === "qualification")!;
    expect(qualification.count).toBe(0); // vacía presente
  });
});

describe("nextActionByProject", () => {
  it("toma la primera task abierta por projectId (orden de entrada)", () => {
    const map = nextActionByProject([
      { projectId: "p1", title: "a" },
      { projectId: "p1", title: "b" },
      { projectId: "p2", title: "c" },
    ]);
    expect(map.get("p1")?.title).toBe("a");
    expect(map.get("p2")?.title).toBe("c");
    expect(map.has("p3")).toBe(false);
  });
});
