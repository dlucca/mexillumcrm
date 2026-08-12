CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid,
	"plant_name" text,
	"location_address" text,
	"city" text,
	"state" text,
	"country" text,
	"industry_subsegment" text,
	"stage" text DEFAULT 'lead_sin_contactar' NOT NULL,
	"stage_group" text DEFAULT 'lead' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"solution_type" text DEFAULT 'unknown' NOT NULL,
	"estimated_value" integer,
	"probability" integer,
	"expected_close_date" date,
	"source" text,
	"lost_reason" text,
	"lost_reason_note" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_company_id_idx" ON "projects" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "projects_archived_at_idx" ON "projects" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "projects_stage_group_idx" ON "projects" USING btree ("stage_group");