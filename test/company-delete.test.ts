import { describe, it, expect } from "vitest";
import { createTestDb } from "./db";
import { runDeleteCompany } from "@/lib/company-mutations";
import { createCompany, listCompanies } from "@/db/companies";
import { createContact, listContacts } from "@/db/contacts";
import { createProject, listAllProjects } from "@/db/projects";
import { createActivity, listActivitiesForProject } from "@/db/activities";
import { createTask, listTasksForProject } from "@/db/tasks";
import type { AnyDb } from "@/db/types";

async function seedCompany(db: AnyDb, name: string) {
  const company = await createCompany(db, { name });
  const project = await createProject(db, {
    companyId: company.id, name: `${name}-P`, ownerUserId: null,
    stage: "lead_sin_contactar", stageGroup: "lead", status: "open",
    solutionType: "unknown", estimatedValue: null, notes: null,
  });
  await createActivity(db, {
    companyId: company.id, projectId: project.id, userId: null, type: "note",
    direction: null, subject: null, body: "n", source: "user", metadata: null,
  });
  await createTask(db, {
    projectId: project.id, companyId: company.id, ownerUserId: null,
    title: "t", dueDate: "2026-09-01",
  });
  await createContact(db, {
    companyId: company.id, name: `${name}-C`, email: null, phone: null, role: null, notes: null,
  });
  return { company, project };
}

describe("runDeleteCompany", () => {
  it("borra la empresa y toda su descendencia; deja intacta otra empresa", async () => {
    const db = await createTestDb();
    const a = await seedCompany(db, "A");
    const b = await seedCompany(db, "B");

    const res = await runDeleteCompany(db, a.company.id);
    expect(res.ok).toBe(true);

    const companyIds = (await listCompanies(db, {})).map((c) => c.id);
    expect(companyIds).not.toContain(a.company.id);
    expect(companyIds).toContain(b.company.id);

    const projectIds = (await listAllProjects(db)).map((p) => p.id);
    expect(projectIds).not.toContain(a.project.id);
    expect(projectIds).toContain(b.project.id);

    expect(await listActivitiesForProject(db, a.project.id)).toHaveLength(0);
    expect(await listTasksForProject(db, a.project.id)).toHaveLength(0);
    expect(await listContacts(db, a.company.id)).toHaveLength(0);

    expect(await listActivitiesForProject(db, b.project.id)).toHaveLength(1);
    expect(await listTasksForProject(db, b.project.id)).toHaveLength(1);
    expect(await listContacts(db, b.company.id)).toHaveLength(1);
  });

  it("empresa inexistente → error", async () => {
    const db = await createTestDb();
    const res = await runDeleteCompany(db, "00000000-0000-0000-0000-000000000000");
    expect(res.ok).toBe(false);
  });
});
