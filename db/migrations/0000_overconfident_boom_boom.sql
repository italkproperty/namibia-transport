CREATE TYPE "public"."assignment_status" AS ENUM('offered', 'accepted', 'declined', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('draft', 'pending_payment', 'confirmed', 'assigned', 'en_route', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('pending', 'active', 'suspended', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pricing_rule_type" AS ENUM('base', 'per_km', 'multiplier', 'flat_surcharge');--> statement-breakpoint
CREATE TABLE "add_ons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"currency" char(3) DEFAULT 'NAD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_add_ons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"add_on_id" uuid NOT NULL,
	"quantity" smallint DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"currency" char(3) DEFAULT 'NAD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"route_id" uuid,
	"vehicle_class_id" uuid,
	"pickup_point" text NOT NULL,
	"dropoff_point" text NOT NULL,
	"pickup_notes" text,
	"dropoff_notes" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"flight_number" text,
	"passengers" smallint DEFAULT 1 NOT NULL,
	"luggage" smallint,
	"status" "booking_status" DEFAULT 'draft' NOT NULL,
	"distance_km" numeric(8, 2),
	"duration_min" integer,
	"fare_total" numeric(10, 2) NOT NULL,
	"currency" char(3) DEFAULT 'NAD' NOT NULL,
	"promo_code_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"whatsapp" text,
	"email" text,
	"phone" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"status" "assignment_status" DEFAULT 'offered' NOT NULL,
	"payout_amount" numeric(10, 2),
	"currency" char(3) DEFAULT 'NAD' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"whatsapp" text,
	"email" text,
	"phone" text,
	"license_number" text,
	"license_expires_at" timestamp with time zone,
	"status" "driver_status" DEFAULT 'pending' NOT NULL,
	"rating" numeric(2, 1),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flight_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"flight_number" text NOT NULL,
	"scheduled_arrival" timestamp with time zone,
	"estimated_arrival" timestamp with time zone,
	"actual_arrival" timestamp with time zone,
	"status" text,
	"source" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" char(3) DEFAULT 'NAD' NOT NULL,
	"raw" jsonb,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"route_id" uuid,
	"vehicle_class_id" uuid,
	"rule_type" "pricing_rule_type" NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"active_from" timestamp with time zone,
	"active_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_fare" numeric(10, 2),
	"max_redemptions" integer,
	"times_redeemed" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"origin_name" text NOT NULL,
	"origin_code" text,
	"destination_name" text NOT NULL,
	"destination_code" text,
	"distance_km" numeric(8, 2),
	"duration_min" integer,
	"fixed_price" numeric(10, 2),
	"currency" char(3) DEFAULT 'NAD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"hero_headline" text,
	"hero_subheadline" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"capacity_passengers" smallint NOT NULL,
	"capacity_luggage" smallint DEFAULT 2 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid,
	"vehicle_class_id" uuid NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" smallint,
	"colour" text,
	"registration" text NOT NULL,
	"seats" smallint,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_add_ons" ADD CONSTRAINT "booking_add_ons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_add_ons" ADD CONSTRAINT "booking_add_ons_add_on_id_add_ons_id_fk" FOREIGN KEY ("add_on_id") REFERENCES "public"."add_ons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_class_id_vehicle_classes_id_fk" FOREIGN KEY ("vehicle_class_id") REFERENCES "public"."vehicle_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_status_events" ADD CONSTRAINT "flight_status_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_vehicle_class_id_vehicle_classes_id_fk" FOREIGN KEY ("vehicle_class_id") REFERENCES "public"."vehicle_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_class_id_vehicle_classes_id_fk" FOREIGN KEY ("vehicle_class_id") REFERENCES "public"."vehicle_classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "add_ons_slug_key" ON "add_ons" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_add_ons_booking_add_on_key" ON "booking_add_ons" USING btree ("booking_id","add_on_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_ref_key" ON "bookings" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_scheduled_at_idx" ON "bookings" USING btree ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_whatsapp_key" ON "customers" USING btree ("whatsapp");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_key" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "dispatch_assignments_booking_idx" ON "dispatch_assignments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "dispatch_assignments_driver_idx" ON "dispatch_assignments" USING btree ("driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_whatsapp_key" ON "drivers" USING btree ("whatsapp");--> statement-breakpoint
CREATE INDEX "drivers_status_idx" ON "drivers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "flight_status_events_booking_idx" ON "flight_status_events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "flight_status_events_flight_number_idx" ON "flight_status_events" USING btree ("flight_number");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_provider_reference_idx" ON "payments" USING btree ("provider_reference");--> statement-breakpoint
CREATE INDEX "pricing_rules_route_idx" ON "pricing_rules" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "pricing_rules_vehicle_class_idx" ON "pricing_rules" USING btree ("vehicle_class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "routes_slug_key" ON "routes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "routes_is_active_idx" ON "routes" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_classes_slug_key" ON "vehicle_classes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_registration_key" ON "vehicles" USING btree ("registration");--> statement-breakpoint
CREATE INDEX "vehicles_driver_idx" ON "vehicles" USING btree ("driver_id");