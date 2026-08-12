import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { projects, companies } from "./schema";
import type { Project } from "./schema";
import type { AnyDb } from "@/db/types";

export type NewProjectInput = {
  companyId: string;
  name: string;
  ownerUserId: string | null;
  stage: string;
  stageGroup: string;
  status: string;
  solutionType: string;
  estimatedValue: number | null;
  notes: string | null;
};

export type ProjectUpdateFields = {
  name: string;
  plantName: string | null;
  locationAddress: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  industrySubsegment: string | null;
  stage: string;
  stageGroup: string;
  status: string;
  solutionType: string;
  estimatedValue: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  source: string | null;
  lostReason: string | null;
  lostReasonNote: string | null;
  notes: string | null;
};

export type ProjectListRow = Project & { companyName: string };

export async function createProject(db: AnyDb, input: NewProjectInput): Promise<Project> {
  const [row] = await db.insert(projects).values(input).returning();
  return row;
}

export async function listProjects(
  db: AnyDb,
  companyId: string,
  opts: { archived?: boolean } = {}
): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.companyId, companyId),
        opts.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt)
      )
    )
    .orderBy(desc(projects.createdAt));
}

export async function listAllProjects(
  db: AnyDb,
  opts: { archived?: boolean } = {}
): Promise<ProjectListRow[]> {
  const rows = await db
    .select({ project: projects, companyName: companies.name })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(opts.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt))
    .orderBy(desc(projects.createdAt));
  return rows.map((r) => ({ ...r.project, companyName: r.companyName }));
}

export async function getProject(db: AnyDb, id: string): Promise<Project | undefined> {
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row;
}

export async function updateProject(
  db: AnyDb,
  id: string,
  fields: ProjectUpdateFields
): Promise<Project | undefined> {
  const [row] = await db.update(projects).set(fields).where(eq(projects.id, id)).returning();
  return row;
}

export async function archiveProject(db: AnyDb, id: string): Promise<Project | undefined> {
  const [row] = await db
    .update(projects)
    .set({ archivedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return row;
}

export async function restoreProject(db: AnyDb, id: string): Promise<Project | undefined> {
  const [row] = await db
    .update(projects)
    .set({ archivedAt: null })
    .where(eq(projects.id, id))
    .returning();
  return row;
}
