import { describe, it, expect } from "vitest";
import {
  todayInMexicoCity,
  addDays,
  bucketTasksByDueDate,
  projectsMissingNextAction,
} from "@/lib/my-actions";

describe("todayInMexicoCity", () => {
  it("usa la fecha local de America/Mexico_City", () => {
    // 04:00 UTC = 22:00 del día anterior en Mexico_City (UTC-6)
    expect(todayInMexicoCity(new Date("2026-09-01T04:00:00Z"))).toBe("2026-08-31");
    expect(todayInMexicoCity(new Date("2026-09-01T12:00:00Z"))).toBe("2026-09-01");
  });
});

describe("addDays", () => {
  it("suma días sin corrimiento de zona", () => {
    expect(addDays("2026-09-01", 7)).toBe("2026-09-08");
    expect(addDays("2026-08-28", 7)).toBe("2026-09-04"); // rollover de mes
  });
});

describe("bucketTasksByDueDate", () => {
  it("clasifica overdue/hoy/upcoming y excluye fuera de ventana", () => {
    const mk = (dueDate: string) => ({ dueDate });
    const r = bucketTasksByDueDate(
      [mk("2026-09-01"), mk("2026-09-08"), mk("2026-09-10"), mk("2026-09-15"), mk("2026-09-16")],
      "2026-09-08",
      7
    );
    expect(r.overdue.map((t) => t.dueDate)).toEqual(["2026-09-01"]);
    expect(r.dueToday.map((t) => t.dueDate)).toEqual(["2026-09-08"]);
    expect(r.upcoming.map((t) => t.dueDate)).toEqual(["2026-09-10", "2026-09-15"]); // día 7 incluido, 16 excluido
  });
});

describe("projectsMissingNextAction", () => {
  it("devuelve projects open sin task abierta", () => {
    const projects = [
      { id: "p1", status: "open" },
      { id: "p2", status: "open" },
      { id: "p3", status: "won" },
    ];
    const openTasks = [{ projectId: "p1" }];
    const missing = projectsMissingNextAction(projects, openTasks);
    expect(missing.map((p) => p.id)).toEqual(["p2"]); // p1 tiene task, p3 no es open
  });
});
