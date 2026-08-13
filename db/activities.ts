import { and, desc, eq, sql } from "drizzle-orm";
import { activities } from "./schema";
import type { Activity } from "./schema";
import type { AnyDb } from "@/db/types";

export type NewActivityInput = {
  companyId: string;
  projectId: string;
  userId: string | null;
  type: string;
  direction: string | null;
  subject: string | null;
  body: string | null;
  occurredAt?: Date;
  source: string;
  metadata: unknown;
};

export async function createActivity(db: AnyDb, input: NewActivityInput): Promise<Activity> {
  const [row] = await db.insert(activities).values(input).returning();
  return row;
}

export async function listActivitiesForProject(
  db: AnyDb,
  projectId: string,
  opts: { type?: string } = {}
): Promise<Activity[]> {
  return db
    .select()
    .from(activities)
    .where(
      opts.type
        ? and(eq(activities.projectId, projectId), eq(activities.type, opts.type))
        : eq(activities.projectId, projectId)
    )
    .orderBy(desc(activities.occurredAt), desc(activities.createdAt));
}

// Última actividad (max occurred_at) por proyecto. Proyectos sin actividad no aparecen.
// Usado por el dashboard para clasificar la salud del pipeline.
export async function lastActivityByProject(db: AnyDb): Promise<Map<string, Date>> {
  const rows = await db
    .select({
      projectId: activities.projectId,
      last: sql<Date>`max(${activities.occurredAt})`,
    })
    .from(activities)
    .groupBy(activities.projectId);
  const map = new Map<string, Date>();
  for (const r of rows) map.set(r.projectId, new Date(r.last));
  return map;
}
