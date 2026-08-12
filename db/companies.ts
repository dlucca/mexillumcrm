import { desc, isNull } from "drizzle-orm";
import { companies } from "./schema";
import type { Company } from "./schema";
import type { AnyDb } from "@/test/db";

export async function createCompany(
  db: AnyDb,
  input: { name: string }
): Promise<Company> {
  const [row] = await db.insert(companies).values({ name: input.name }).returning();
  return row;
}

export async function listCompanies(db: AnyDb): Promise<Company[]> {
  return db
    .select()
    .from(companies)
    .where(isNull(companies.archivedAt))
    .orderBy(desc(companies.createdAt));
}
