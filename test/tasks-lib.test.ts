import { describe, it, expect } from "vitest";
import type { Task } from "@/db/schema";
import { nextActionTask, formatDueDate } from "@/lib/tasks";

function mk(dueDate: string, completedAt: Date | null): Task {
  return { dueDate, completedAt } as unknown as Task;
}

describe("nextActionTask", () => {
  it("elige la task abierta con due_date más próxima", () => {
    const t = nextActionTask([mk("2026-12-01", null), mk("2026-09-01", null), mk("2026-10-01", null)]);
    expect(t?.dueDate).toBe("2026-09-01");
  });
  it("ignora las completadas", () => {
    const t = nextActionTask([mk("2026-08-01", new Date()), mk("2026-11-01", null)]);
    expect(t?.dueDate).toBe("2026-11-01");
  });
  it("null si no hay abiertas", () => {
    expect(nextActionTask([mk("2026-08-01", new Date())])).toBeNull();
    expect(nextActionTask([])).toBeNull();
  });
});

describe("formatDueDate", () => {
  it("formatea YYYY-MM-DD sin corrimiento de zona", () => {
    const s = formatDueDate("2026-09-01");
    expect(s).toContain("2026");
    expect(typeof s).toBe("string");
  });
});
