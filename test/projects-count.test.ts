import { describe, it, expect } from "vitest";
import { createTestDb } from "./db";
import { createCompany } from "@/db/companies";
import { createProject, listAllProjectsWithCounts } from "@/db/projects";
import { createActivity } from "@/db/activities";
import { createTask } from "@/db/tasks";
import type { AnyDb } from "@/db/types";

async function mkProject(db: AnyDb, companyId: string, name: string) {
  return createProject(db, {
    companyId, name, ownerUserId: null, stage: "lead_sin_contactar", stageGroup: "lead",
    status: "open", solutionType: "unknown", estimatedValue: null, notes: null,
  });
}

describe("listAllProjectsWithCounts", () => {
  it("cuenta activities y tasks por proyecto sin inflar por el doble join; 0 si no tiene", async () => {
    const db = await createTestDb();
    const c = await createCompany(db, { name: "C" });
    const p = await mkProject(db, c.id, "P");
    const q = await mkProject(db, c.id, "Q");
    for (const i of [1, 2]) {
      await createActivity(db, { companyId: c.id, projectId: p.id, userId: null, type: "note", direction: null, subject: null, body: `n${i}`, source: "user", metadata: null });
    }
    for (const i of [1, 2, 3]) {
      await createTask(db, { projectId: p.id, companyId: c.id, ownerUserId: null, title: `t${i}`, dueDate: "2026-09-01" });
    }

    const rows = await listAllProjectsWithCounts(db, { archived: false });
    const rp = rows.find((r) => r.id === p.id)!;
    const rq = rows.find((r) => r.id === q.id)!;
    expect(rp.activityCount).toBe(2); // no 6 (2 activities × 3 tasks) → count(distinct) correcto
    expect(rp.taskCount).toBe(3);
    expect(rp.companyName).toBe("C");
    expect(rq.activityCount).toBe(0);
    expect(rq.taskCount).toBe(0);
  });
});
