import { pgTable, uuid, text, timestamp, integer, date, index, jsonb } from "drizzle-orm/pg-core";

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
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("companies_owner_user_id_idx").on(t.ownerUserId),
    index("companies_archived_at_idx").on(t.archivedAt),
  ]
).enableRLS();

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: text("role"),
    notes: text("notes"),
    ownerUserId: uuid("owner_user_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("contacts_company_id_idx").on(t.companyId),
    index("contacts_archived_at_idx").on(t.archivedAt),
  ]
).enableRLS();

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    ownerUserId: uuid("owner_user_id"),
    plantName: text("plant_name"),
    locationAddress: text("location_address"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    industrySubsegment: text("industry_subsegment"),
    stage: text("stage").notNull().default("lead_sin_contactar"),
    stageGroup: text("stage_group").notNull().default("lead"),
    status: text("status").notNull().default("open"),
    solutionType: text("solution_type").notNull().default("unknown"),
    estimatedValue: integer("estimated_value"),
    probability: integer("probability"),
    expectedCloseDate: date("expected_close_date", { mode: "string" }),
    source: text("source"),
    lostReason: text("lost_reason"),
    lostReasonNote: text("lost_reason_note"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("projects_company_id_idx").on(t.companyId),
    index("projects_archived_at_idx").on(t.archivedAt),
    index("projects_stage_group_idx").on(t.stageGroup),
  ]
).enableRLS();

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    userId: uuid("user_id"),
    type: text("type").notNull(),
    direction: text("direction"),
    subject: text("subject"),
    body: text("body"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Las activities son append-only (sin update/delete); updated_at queda por
    // uniformidad de schema y el $onUpdate nunca dispara en la práctica.
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("activities_project_id_idx").on(t.projectId),
    index("activities_project_id_occurred_at_idx").on(t.projectId, t.occurredAt),
    index("activities_company_id_idx").on(t.companyId),
  ]
).enableRLS();

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    ownerUserId: uuid("owner_user_id"),
    title: text("title").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("tasks_project_id_idx").on(t.projectId),
    index("tasks_project_id_completed_at_idx").on(t.projectId, t.completedAt),
    index("tasks_due_date_idx").on(t.dueDate),
    index("tasks_company_id_idx").on(t.companyId),
  ]
).enableRLS();

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
