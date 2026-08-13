import { describe, it, expect } from "vitest";
import { createTestDb } from "./db";
import { companyRelationCounts } from "@/db/delete-counts";
import { createCompany } from "@/db/companies";
import { createProject } from "@/db/projects";
import { createContact } from "@/db/contacts";
import { createActivity } from "@/db/activities";
import { createTask } from "@/db/tasks";
import type { AnyDb } from "@/db/types";

async function mkProject(db: AnyDb, companyId: string, name: string) {
  return createProject(db, {
    companyId, name, ownerUserId: null, stage: "lead_sin_contactar", stageGroup: "lead",
    status: "open", solutionType: "unknown", estimatedValue: null, notes: null,
  });
}
async function mkActivity(db: AnyDb, companyId: string, projectId: string) {
  return createActivity(db, {
    companyId, projectId, userId: null, type: "note", direction: null,
    subject: null, body: "n", source: "user", metadata: null,
  });
}
async function mkTask(db: AnyDb, companyId: string, projectId: string) {
  return createTask(db, { projectId, companyId, ownerUserId: null, title: "t", dueDate: "2026-09-01" });
}

describe("companyRelationCounts", () => {
  it("cuenta contactos, actividades y tareas por empresa; ausente si no tiene", async () => {
    const db = await createTestDb();
    const a = await createCompany(db, { name: "A" });
    const b = await createCompany(db, { name: "B" });
    const pa = await mkProject(db, a.id, "PA");
    await mkProject(db, a.id, "PA2");
    await createContact(db, { companyId: a.id, name: "c1", email: null, phone: null, role: null, notes: null });
    await createContact(db, { companyId: a.id, name: "c2", email: null, phone: null, role: null, notes: null });
    await mkActivity(db, a.id, pa.id);
    await mkActivity(db, a.id, pa.id);
    await mkActivity(db, a.id, pa.id);
    await mkTask(db, a.id, pa.id);

    const map = await companyRelationCounts(db);
    expect(map.get(a.id)).toEqual({ contacts: 2, activities: 3, tasks: 1 });
    // B no tiene relaciones → sin entrada en el mapa
    expect(map.get(b.id)).toBeUndefined();
  });
});
