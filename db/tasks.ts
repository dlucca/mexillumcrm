import { and, asc, eq, isNull } from "drizzle-orm";
import { tasks, projects, companies } from "./schema";
import type { Task } from "./schema";
import type { AnyDb } from "@/db/types";

export type NewTaskInput = {
  projectId: string;
  companyId: string;
  ownerUserId: string | null;
  title: string;
  dueDate: string;
};

export async function createTask(db: AnyDb, input: NewTaskInput): Promise<Task> {
  const [row] = await db.insert(tasks).values(input).returning();
  return row;
}

export async function getTask(db: AnyDb, id: string): Promise<Task | undefined> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row;
}

export async function listTasksForProject(db: AnyDb, projectId: string): Promise<Task[]> {
  return db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(asc(tasks.dueDate));
}

export type OpenTaskRow = Task & {
  projectName: string;
  companyName: string;
  stage: string;
  stageGroup: string;
  solutionType: string;
};

export async function listOpenTasksWithContext(db: AnyDb): Promise<OpenTaskRow[]> {
  const rows = await db
    .select({
      task: tasks,
      projectName: projects.name,
      companyName: companies.name,
      stage: projects.stage,
      stageGroup: projects.stageGroup,
      solutionType: projects.solutionType,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(companies, eq(tasks.companyId, companies.id))
    .where(and(isNull(tasks.completedAt), isNull(projects.archivedAt)))
    .orderBy(asc(tasks.dueDate));
  return rows.map((r) => ({
    ...r.task,
    projectName: r.projectName,
    companyName: r.companyName,
    stage: r.stage,
    stageGroup: r.stageGroup,
    solutionType: r.solutionType,
  }));
}
