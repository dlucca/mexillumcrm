import { describe, it, expect } from "vitest";
import { createTestDb } from "./db";
import { runDeleteProject } from "@/lib/project-mutations";
import { createCompany } from "@/db/companies";
import { createContact, listContacts } from "@/db/contacts";
import { createProject, listAllProjects } from "@/db/projects";
import { createActivity, listActivitiesForProject } from "@/db/activities";
import { createTask, listTasksForProject } from "@/db/tasks";
import type { AnyDb } from "@/db/types";

async function mkProject(db: AnyDb, companyId: string, name: string) {
  return createProject(db, {
    companyId, name, ownerUserId: null, stage: "lead_sin_contactar", stageGroup: "lead",
    status: "open", solutionType: "unknown", estimatedValue: null, notes: null,
  });
}

describe("runDeleteProject", () => {
  it("borra el proyecto y sus activities/tasks; no toca otros proyectos ni los contacts", async () => {
    const db = await createTestDb();
    const c = await createCompany(db, { name: "C" });
    const p1 = await mkProject(db, c.id, "P1");
    const p2 = await mkProject(db, c.id, "P2");
    await createActivity(db, { companyId: c.id, projectId: p1.id, userId: null, type: "note", direction: null, subject: null, body: "n", source: "user", metadata: null });
    await createTask(db, { projectId: p1.id, companyId: c.id, ownerUserId: null, title: "t1", dueDate: "2026-09-01" });
    await createActivity(db, { companyId: c.id, projectId: p2.id, userId: null, type: "note", direction: null, subject: null, body: "n", source: "user", metadata: null });
    await createTask(db, { projectId: p2.id, companyId: c.id, ownerUserId: null, title: "t2", dueDate: "2026-09-01" });
    await createContact(db, { companyId: c.id, name: "C1", email: null, phone: null, role: null, notes: null });

    const res = await runDeleteProject(db, p1.id);
    expect(res.ok).toBe(true);

    const projectIds = (await listAllProjects(db)).map((p) => p.id);
    expect(projectIds).not.toContain(p1.id);
    expect(projectIds).toContain(p2.id);
    expect(projectIds).toHaveLength(1);

    expect(await listActivitiesForProject(db, p1.id)).toHaveLength(0);
    expect(await listTasksForProject(db, p1.id)).toHaveLength(0);
    expect(await listActivitiesForProject(db, p2.id)).toHaveLength(1);
    expect(await listTasksForProject(db, p2.id)).toHaveLength(1);
    expect(await listContacts(db, c.id)).toHaveLength(1);
  });

  it("proyecto inexistente → error", async () => {
    const db = await createTestDb();
    const res = await runDeleteProject(db, "00000000-0000-0000-0000-000000000000");
    expect(res.ok).toBe(false);
  });
});
