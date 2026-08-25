CREATE TYPE "public"."pricing_unit" AS ENUM('per_vehicle', 'per_person');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'quoted', 'sent', 'negotiating', 'accepted', 'rejected', 'expired', 'fulfilled');--> statement-breakpoint
CREATE TABLE "corporate_quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2),
	"line_total" numeric(10, 2),
	"currency" char(3) DEFAULT 'NAD' NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_number" text NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_position" text,
	"email" text,
	"whatsapp" text,
	"industry" text,
	"company_registration" text,
	"billing_address" text,
	"services" jsonb NOT NULL,
	"passengers" integer,
	"vehicles" smallint DEFAULT 1 NOT NULL,
	"dates_note" text,
	"frequency" text,
	"trips_count" integer DEFAULT 1 NOT NULL,
	"include_return" boolean DEFAULT false NOT NULL,
	"notes" text,
	"subtotal" numeric(10, 2) NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"currency" char(3) DEFAULT 'NAD' NOT NULL,
	"is_estimate" boolean DEFAULT true NOT NULL,
	"status" "quote_status" DEFAULT 'quoted' NOT NULL,
	"valid_until" timestamp with time zone,
	"acquisition_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"author_name" text NOT NULL,
	"author_context" text,
	"rating" smallint NOT NULL,
	"body" text NOT NULL,
	"source" text DEFAULT 'direct' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "pricing_unit" "pricing_unit" DEFAULT 'per_vehicle' NOT NULL;--> statement-breakpoint
ALTER TABLE "corporate_quote_items" ADD CONSTRAINT "corporate_quote_items_quote_id_corporate_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."corporate_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "corporate_quote_items_quote_idx" ON "corporate_quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "corporate_quotes_number_key" ON "corporate_quotes" USING btree ("quote_number");--> statement-breakpoint
CREATE INDEX "corporate_quotes_status_idx" ON "corporate_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "corporate_quotes_created_at_idx" ON "corporate_quotes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reviews_published_idx" ON "reviews" USING btree ("is_published");