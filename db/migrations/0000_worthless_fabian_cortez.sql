CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"industry" text,
	"company_type" text,
	"website" text,
	"tax_id" text,
	"headquarters_location" text,
	"size_segment" text,
	"notes" text,
	"owner_user_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "companies_owner_user_id_idx" ON "companies" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "companies_archived_at_idx" ON "companies" USING btree ("archived_at");