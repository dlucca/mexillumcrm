import { asc, eq } from "drizzle-orm";
import { tasks } from "./schema";
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
