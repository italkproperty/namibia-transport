CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'void');--> statement-breakpoint
CREATE TABLE "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_number" text,
  "public_token" text,
  "status" "invoice_status" DEFAULT 'draft' NOT NULL,
  "customer_id" uuid NOT NULL,
  "booking_id" uuid,
  "corporate_quote_id" uuid,
  "charter_quote_id" uuid,
  "billing_name" text NOT NULL,
  "billing_email" text,
  "billing_whatsapp" text,
  "billing_address" text,
  "description" text NOT NULL,
  "currency" char(3) DEFAULT 'NAD' NOT NULL,
  "subtotal" numeric(10, 2) NOT NULL,
  "discount_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
  "total" numeric(10, 2) NOT NULL,
  "issued_at" timestamp with time zone,
  "due_at" timestamp with time zone,
  "terms" text,
  "internal_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_corporate_quote_id_corporate_quotes_id_fk" FOREIGN KEY ("corporate_quote_id") REFERENCES "public"."corporate_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_charter_quote_id_charter_quotes_id_fk" FOREIGN KEY ("charter_quote_id") REFERENCES "public"."charter_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_public_token_key" ON "invoices" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "invoices_customer_created_idx" ON "invoices" USING btree ("customer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoices_status_due_idx" ON "invoices" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "invoices_booking_idx" ON "invoices" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "invoices_corporate_quote_idx" ON "invoices" USING btree ("corporate_quote_id");--> statement-breakpoint
CREATE INDEX "invoices_charter_quote_idx" ON "invoices" USING btree ("charter_quote_id");--> statement-breakpoint
CREATE TABLE "invoice_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "description" text NOT NULL,
  "quantity" numeric(10, 2) DEFAULT '1.00' NOT NULL,
  "unit_price" numeric(10, 2) NOT NULL,
  "line_total" numeric(10, 2) NOT NULL,
  "currency" char(3) DEFAULT 'NAD' NOT NULL,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_sort_idx" ON "invoice_lines" USING btree ("invoice_id","sort_order");--> statement-breakpoint
CREATE TABLE "invoice_sequences" (
  "year" integer PRIMARY KEY NOT NULL,
  "last_number" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
