import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function createTestDb(): Promise<AnyDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "db/migrations" });
  return db as unknown as AnyDb;
}
