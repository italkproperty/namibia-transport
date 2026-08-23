CREATE TYPE "public"."enquiry_need" AS ENUM('airport_transfers', 'conference_event', 'employee_site_transport', 'other');--> statement-breakpoint
CREATE TYPE "public"."enquiry_status" AS ENUM('new', 'contacted', 'quoted', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "corporate_enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"whatsapp" text,
	"email" text,
	"need_type" "enquiry_need" NOT NULL,
	"approx_passengers" integer,
	"dates_note" text,
	"notes" text,
	"status" "enquiry_status" DEFAULT 'new' NOT NULL,
	"acquisition_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "corporate_enquiries_status_idx" ON "corporate_enquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "corporate_enquiries_created_at_idx" ON "corporate_enquiries" USING btree ("created_at");