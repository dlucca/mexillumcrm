import { desc, eq, isNull } from "drizzle-orm";
import { companies } from "./schema";
import type { Company } from "./schema";
import type { AnyDb } from "@/db/types";

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

export async function getCompany(
  db: AnyDb,
  id: string
): Promise<Company | undefined> {
  const [row] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);
  return row;
}

export type CompanyUpdateFields = {
  name: string;
  legalName: string | null;
  industry: string | null;
  companyType: string | null;
  website: string | null;
  taxId: string | null;
  headquartersLocation: string | null;
  sizeSegment: string | null;
  notes: string | null;
};

export async function updateCompany(
  db: AnyDb,
  id: string,
  fields: CompanyUpdateFields
): Promise<Company> {
  const [row] = await db
    .update(companies)
    .set(fields)
    .where(eq(companies.id, id))
    .returning();
  return row;
}
