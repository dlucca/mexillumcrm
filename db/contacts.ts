import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { contacts } from "./schema";
import type { Contact } from "./schema";
import type { AnyDb } from "@/db/types";

export type NewContactInput = {
  companyId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  notes: string | null;
};

export async function createContact(
  db: AnyDb,
  input: NewContactInput
): Promise<Contact> {
  const [row] = await db.insert(contacts).values(input).returning();
  return row;
}

export async function listContacts(
  db: AnyDb,
  companyId: string,
  opts: { archived?: boolean } = {}
): Promise<Contact[]> {
  return db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.companyId, companyId),
        opts.archived ? isNotNull(contacts.archivedAt) : isNull(contacts.archivedAt)
      )
    )
    .orderBy(desc(contacts.createdAt));
}

export async function archiveContact(
  db: AnyDb,
  id: string
): Promise<Contact | undefined> {
  const [row] = await db
    .update(contacts)
    .set({ archivedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();
  return row;
}

export async function restoreContact(
  db: AnyDb,
  id: string
): Promise<Contact | undefined> {
  const [row] = await db
    .update(contacts)
    .set({ archivedAt: null })
    .where(eq(contacts.id, id))
    .returning();
  return row;
}

export type ContactUpdateFields = {
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  notes: string | null;
};

export async function updateContact(
  db: AnyDb,
  id: string,
  fields: ContactUpdateFields
): Promise<Contact | undefined> {
  const [row] = await db
    .update(contacts)
    .set(fields)
    .where(eq(contacts.id, id))
    .returning();
  return row;
}
