import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    industry: text("industry"),
    companyType: text("company_type"),
    website: text("website"),
    taxId: text("tax_id"),
    headquartersLocation: text("headquarters_location"),
    sizeSegment: text("size_segment"),
    notes: text("notes"),
    ownerUserId: uuid("owner_user_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("companies_owner_user_id_idx").on(t.ownerUserId),
    index("companies_archived_at_idx").on(t.archivedAt),
  ]
).enableRLS();

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
