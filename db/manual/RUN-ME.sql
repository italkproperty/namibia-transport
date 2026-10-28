/*
 * Everything this database needs, in one block.
 *
 * Paste the whole thing into the Supabase SQL editor and run it. It is
 * cumulative and idempotent: it contains every hand-applied change to date,
 * running it twice does nothing the second time, and running it against a
 * database that already has some of the changes applies only the rest.
 *
 * The whole script is one transaction, so if anything fails the database is
 * left exactly as it was.
 *
 * Keep this file as the single thing to run. When a new change is needed, add
 * it to the bottom rather than starting another file — an operator should
 * never have to work out which of several scripts they are missing.
 */
BEGIN;

/* ---------------------------------------------- 6 September 2026 ---------- */

-- Modelled journeys on bookings. Until this exists, every booking insert
-- fails on production.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "journey_slug" text;
CREATE INDEX IF NOT EXISTS "bookings_journey_idx" ON "bookings" USING btree ("journey_slug");

-- Where each driver is based, so the dispatch calendar can cost a
-- repositioning drive.
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "base_node" text;

-- Per-vehicle pricing everywhere. The code already ignores per_person, so
-- this is data hygiene rather than a behaviour switch.
UPDATE "routes" SET "pricing_unit" = 'per_vehicle' WHERE "pricing_unit" <> 'per_vehicle';

-- Honest luggage capacities. Without this the sedan still claims three large
-- cases and the luggage-based upgrade never fires.
UPDATE "vehicle_classes" SET "luggage_capacity" = 2 WHERE "slug" = 'private-sedan';
UPDATE "vehicle_classes" SET "luggage_capacity" = 4 WHERE "slug" = 'suv-4x4';

/* ---------------------------------------------- 21 September 2026 --------- */

-- A photograph of the driver who is actually coming, so a traveller in
-- arrivals knows the face to look for. Without it the card shows initials.
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "photo_url" text;

/* ---------------------------------------------- 22 September 2026 --------- */

-- Ties the legs of one itinerary together. A Windhoek → Sossusvlei →
-- Swakopmund → airport trip is four driving jobs and one thing the traveller
-- agreed to; the legs stay separate bookings and share this reference.
-- Without it, /admin/quotes/new cannot save a multi-leg quote at all.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "group_ref" text;
CREATE INDEX IF NOT EXISTS "bookings_group_ref_idx" ON "bookings" USING btree ("group_ref");

/* ---------------------------------------------- 22 September 2026 (later) -- */

-- What only the traveller knows: the exact pick-up spot, their flight, and
-- anything the driver should be told. Kept apart from pickup_label and notes,
-- which are ours — a traveller filling these in must never overwrite the place
-- we priced or the terms we quoted.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pickup_detail" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "traveller_notes" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "details_updated_at" timestamptz;

/* ---------------------------------------------- 21 September 2026 (audit) -- */

-- A traveller pressing "I have made the transfer" twice at once used to write
-- two rows, and the operator then saw the same money queued twice. There is
-- only ever one bank transfer per booking, so the database says so — and the
-- code's insert turns into an upsert against this.
--
-- Partial, not a plain unique on (booking_id, provider): a card payment that
-- failed and was retried is a legitimate second row, and this must not stop it.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_one_bank_transfer_idx"
  ON "payments" ("booking_id")
  WHERE "provider" = 'bank_transfer';

-- Reconciliation looks up the latest non-bank attempt for a booking, and the
-- admin queues scan by status. Both were sequential scans of the whole table.
CREATE INDEX IF NOT EXISTS "payments_booking_provider_idx"
  ON "payments" USING btree ("booking_id", "provider", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "payments_provider_status_idx"
  ON "payments" USING btree ("provider", "status");

-- The dispatch board orders by when a driver was put on a trip, and the
-- traveller-details queue by when a traveller last sent something.
CREATE INDEX IF NOT EXISTS "dispatch_assignments_assigned_at_idx"
  ON "dispatch_assignments" USING btree ("assigned_at" DESC);
CREATE INDEX IF NOT EXISTS "bookings_details_updated_at_idx"
  ON "bookings" USING btree ("details_updated_at" DESC);

-- /admin/bookings pages by scheduled date and searches by reference. Without
-- these, both are a full scan that grows with every booking ever taken.
CREATE INDEX IF NOT EXISTS "bookings_scheduled_at_idx"
  ON "bookings" USING btree ("scheduled_at" DESC);
CREATE INDEX IF NOT EXISTS "bookings_status_scheduled_idx"
  ON "bookings" USING btree ("status", "scheduled_at" DESC);

/* ---------------------------------------------- 24 September 2026 --------- */

-- WhatsApp stops being mandatory, and stops being unique.
--
-- Two bookings were impossible before this. A traveller without WhatsApp
-- could not book at all, because the column was NOT NULL — and WhatsApp being
-- how dispatch works is an operating truth, not a reason to turn away an
-- inbound couple who use iMessage. And a couple sharing one number, or a PA
-- booking for two executives from one handset, collided on the unique index:
-- the second insert failed with an error nobody in the conversation could act
-- on.
--
-- A booking still requires one channel — WhatsApp or email — but that is
-- enforced in lib/booking/schema.ts, not here: "at least one of two columns"
-- needs a CHECK that would also have to know about the admin quote paths,
-- and a constraint that fails a booking is the failure mode being removed.
ALTER TABLE "customers" ALTER COLUMN "whatsapp" DROP NOT NULL;
DROP INDEX IF EXISTS "customers_whatsapp_key";
CREATE INDEX IF NOT EXISTS "customers_whatsapp_idx"
  ON "customers" USING btree ("whatsapp");

/* ---------------------------------------------- 24 September 2026 (pricing) */

-- Cost constants an operator can change without a deploy.
--
-- These were literals in lib/network/fare-model.ts, so diesel going up was a
-- code change. One row, pinned to id = 1: two rows would be two answers to
-- "what does a kilometre cost", and the losing one would surface as a fare
-- nobody could reproduce.
--
-- No history table. A booking already snapshots its own fare, payout and
-- contribution, so what somebody agreed to is never rewritten by a later
-- change — which is the only thing a price history would protect.
CREATE TABLE IF NOT EXISTS "pricing_settings" (
  "id"                    smallint PRIMARY KEY DEFAULT 1,
  "driver_hourly"         numeric(10,2) NOT NULL DEFAULT 110.00,
  "same_day_limit_hours"  numeric(5,2)  NOT NULL DEFAULT 10.00,
  "overnight_allowance"   numeric(10,2) NOT NULL DEFAULT 450.00,
  "handling_hours"        numeric(5,2)  NOT NULL DEFAULT 1.00,
  "contribution_rate"     numeric(4,3)  NOT NULL DEFAULT 0.300,
  "price_step"            numeric(8,2)  NOT NULL DEFAULT 50.00,
  "created_at"            timestamptz   NOT NULL DEFAULT now(),
  "updated_at"            timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "pricing_settings_singleton" CHECK ("id" = 1)
);

-- Seeded with exactly the values the code shipped with, so running this
-- changes no price anywhere. The row existing is what lets an operator edit.
INSERT INTO "pricing_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;

-- Per-kilometre running cost, by vehicle class.
--
-- price_multiplier multiplied the whole fare — the fuel, the driver's hours
-- and the overnight allowance alike. Only the fuel is a function of the car.
-- These columns are the dimension a class is actually allowed to move; they
-- stay NULL until an operator costs the class, and until then the class is
-- priced through the old multiplier so nothing reprices on deploy.
ALTER TABLE "vehicle_classes"
  ADD COLUMN IF NOT EXISTS "running_cost_tar"    numeric(6,2),
  ADD COLUMN IF NOT EXISTS "running_cost_gravel" numeric(6,2),
  ADD COLUMN IF NOT EXISTS "minimum_driver_need" numeric(10,2);

/* ---------------------------------------------- 28 September 2026 (ads) --- */

-- Which ad click paid for this booking, so the money can be reported back.
--
-- Google optimises towards whatever we call a conversion. The conversion that
-- matters here is money received, which for a bank transfer is a human in the
-- admin panel days after the click — so the click has to be carried on the
-- booking and reported later, rather than counted by a pixel at submit time.
--
-- Not named `gclid`, although that is what it usually holds. A click arriving
-- from an iOS in-app browser carries `wbraid` or `gbraid` instead, and
-- Google's upload format has a separate column for each — so the kind is
-- stored beside the value rather than guessed from its shape later.
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "ad_click_id"   text,
  ADD COLUMN IF NOT EXISTS "ad_click_kind" text;

-- When this trip's revenue was reported to the ad platform.
--
-- A trip is paid as a trip: an itinerary is one agreed figure across several
-- booking rows sharing a group_ref. Reporting each leg would tell Google we
-- made four sales instead of one, at a quarter of the value each, and the
-- bidding would learn from a figure that never existed. So the export keys on
-- coalesce(group_ref, ref) and stamps every row in the group at once.
--
-- It is also the guard against double counting. A traveller refreshing the
-- confirmation page, or opening the second leg of their own itinerary, must
-- not report a second sale.
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "conversion_reported_at" timestamptz;

-- The export reads exactly one slice: attributed trips whose money has
-- arrived and which have not been reported. Partial, because the rows that
-- qualify are a small minority of the table and always will be.
CREATE INDEX IF NOT EXISTS "bookings_ad_click_pending_idx"
  ON "bookings" USING btree ("created_at" DESC)
  WHERE "ad_click_id" IS NOT NULL AND "conversion_reported_at" IS NULL;


/* ---------------------------------------------- 13 October 2026 (airport) -- */
-- Add the reverse airport route and standardise both private-car fares at N$950.
INSERT INTO "routes" ("id","slug","origin_label","destination_label","category","fixed_price","pricing_unit","currency","default_driver_payout","is_active","distance_km","duration_min","sort_order","origin_lat","origin_lng","destination_lat","destination_lng","seo_title","seo_description","seo_body") VALUES (
  'a7bb0a1a-4e56-5ef0-90b3-0c1e3cbdad12','windhoek-to-hosea-kutako','Windhoek CBD','Hosea Kutako International Airport (WDH)','airport',950.00,'per_vehicle','NAD',665.00,true,45.00,45,15,-22.5609,17.0658,-22.4799,17.4709,
  'Windhoek to Hosea Kutako Airport Transfer — Fixed Price Private Car',
  'Book a private transfer from Windhoek CBD to Hosea Kutako International Airport (WDH). Fixed price, professional Namibian drivers and reliable airport drop-off.',
  'A private transfer from Windhoek CBD to Hosea Kutako International Airport is approximately 45 kilometres and takes around 45 minutes in normal traffic. Book in advance for a dependable drop-off at departures. The fare is N$950 for the whole private car, not per passenger.'
) ON CONFLICT ("slug") DO UPDATE SET "origin_label"=EXCLUDED."origin_label","destination_label"=EXCLUDED."destination_label","category"=EXCLUDED."category","fixed_price"=EXCLUDED."fixed_price","pricing_unit"=EXCLUDED."pricing_unit","default_driver_payout"=EXCLUDED."default_driver_payout","is_active"=EXCLUDED."is_active","distance_km"=EXCLUDED."distance_km","duration_min"=EXCLUDED."duration_min","sort_order"=EXCLUDED."sort_order","origin_lat"=EXCLUDED."origin_lat","origin_lng"=EXCLUDED."origin_lng","destination_lat"=EXCLUDED."destination_lat","destination_lng"=EXCLUDED."destination_lng","seo_title"=EXCLUDED."seo_title","seo_description"=EXCLUDED."seo_description","seo_body"=EXCLUDED."seo_body","updated_at"=now();
UPDATE "routes" SET "fixed_price"=950.00,"default_driver_payout"=665.00,"updated_at"=now() WHERE "slug"='hosea-kutako-to-windhoek';
UPDATE "pricing_rules" SET "is_active"=false,"updated_at"=now() WHERE "route_id" IN (SELECT "id" FROM "routes" WHERE "slug" IN ('hosea-kutako-to-windhoek','windhoek-to-hosea-kutako')) AND "rule_type"='multiplier' AND "is_active"=true;


/* ---------------------------------------------- 15 October 2026 (charter) -- */
-- Isolated charter cost assumptions. These columns and profiles do not feed
-- the legacy fare model or alter any published airport-transfer price.
ALTER TABLE "pricing_settings"
  ADD COLUMN IF NOT EXISTS "charter_target_contribution_margin" numeric(4,3) NOT NULL DEFAULT 0.250,
  ADD COLUMN IF NOT EXISTS "charter_payment_fee_rate" numeric(4,3) NOT NULL DEFAULT 0.048;

CREATE TABLE IF NOT EXISTS "charter_vehicle_cost_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicle_class_id" uuid NOT NULL REFERENCES "vehicle_classes"("id") ON DELETE CASCADE,
  "fuel_type" text NOT NULL CHECK ("fuel_type" IN ('diesel', 'petrol')),
  "litres_per_100_km" numeric(5,2) NOT NULL CHECK ("litres_per_100_km" BETWEEN 2 AND 40),
  "fuel_price_per_litre" numeric(6,2) NOT NULL CHECK ("fuel_price_per_litre" BETWEEN 10 AND 80),
  "non_fuel_running_cost_per_km" numeric(6,2) NOT NULL CHECK ("non_fuel_running_cost_per_km" BETWEEN 0 AND 20),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "charter_vehicle_cost_profiles_vehicle_class_key" UNIQUE ("vehicle_class_id")
);

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pricing_settings_charter_margin_check'
  ) THEN
    ALTER TABLE "pricing_settings"
      ADD CONSTRAINT "pricing_settings_charter_margin_check"
      CHECK ("charter_target_contribution_margin" BETWEEN 0.050 AND 0.750);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pricing_settings_charter_fee_check'
  ) THEN
    ALTER TABLE "pricing_settings"
      ADD CONSTRAINT "pricing_settings_charter_fee_check"
      CHECK ("charter_payment_fee_rate" BETWEEN 0.000 AND 0.150);
  END IF;
END $;


/* ---------------------------------------------- 15 October 2026 (quotes) -- */
-- Persisted charter quote drafts and immutable version snapshots. These tables
-- are additive and are not used by the existing airport-transfer fare flow.
CREATE TABLE IF NOT EXISTS "charter_quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "quote_number" text NOT NULL,
  "public_token" text,
  "status" text NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')),
  "customer_name" text NOT NULL,
  "customer_email" text,
  "customer_whatsapp" text,
  "vehicle_class_id" uuid REFERENCES "vehicle_classes"("id") ON DELETE SET NULL,
  "itinerary_snapshot" jsonb NOT NULL,
  "cost_snapshot" jsonb NOT NULL,
  "pricing_snapshot" jsonb NOT NULL,
  "total" numeric(10,2) NOT NULL CHECK ("total" > 0),
  "currency" char(3) NOT NULL DEFAULT 'NAD',
  "current_version" integer NOT NULL DEFAULT 1 CHECK ("current_version" > 0),
  "valid_until" timestamptz,
  "issued_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "charter_quotes_number_key" UNIQUE ("quote_number"),
  CONSTRAINT "charter_quotes_public_token_key" UNIQUE ("public_token")
);
CREATE INDEX IF NOT EXISTS "charter_quotes_status_created_idx"
  ON "charter_quotes" ("status", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "charter_quote_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "quote_id" uuid NOT NULL REFERENCES "charter_quotes"("id") ON DELETE CASCADE,
  "version" integer NOT NULL CHECK ("version" > 0),
  "status" text NOT NULL
    CHECK ("status" IN ('draft', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')),
  "snapshot" jsonb NOT NULL,
  "total" numeric(10,2) NOT NULL CHECK ("total" > 0),
  "change_reason" text,
  "actor" text NOT NULL DEFAULT 'admin',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "charter_quote_versions_quote_version_key" UNIQUE ("quote_id", "version")
);
CREATE INDEX IF NOT EXISTS "charter_quote_versions_quote_created_idx"
  ON "charter_quote_versions" ("quote_id", "created_at" DESC);


/* Charter quote gateway attempts: one payment belongs to one quote total. */
CREATE TABLE IF NOT EXISTS "charter_quote_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "quote_id" uuid NOT NULL REFERENCES "charter_quotes"("id") ON DELETE RESTRICT,
  "provider" text NOT NULL,
  "provider_reference" text,
  "status" text NOT NULL DEFAULT 'pending'
    CHECK ("status" IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  "amount" numeric(10,2) NOT NULL CHECK ("amount" > 0),
  "currency" char(3) NOT NULL DEFAULT 'NAD',
  "checkout_url" text,
  "expires_at" timestamptz,
  "raw" jsonb,
  "paid_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "charter_quote_payments_provider_reference_key"
    UNIQUE ("provider", "provider_reference")
);
CREATE INDEX IF NOT EXISTS "charter_quote_payments_quote_idx"
  ON "charter_quote_payments" ("quote_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "charter_quote_payments_status_idx"
  ON "charter_quote_payments" ("status", "created_at" DESC);


/* ---------------------------------------------- 28 October 2026 (invoices) -- */
-- Invoice foundation compatibility. This is the single cumulative rollout script.
-- Existing legacy columns are retained and copied into the canonical columns.
-- No invoice records are deleted. Existing invoice NT-INV-2026-00001 is preserved.

-- Ensure the child tables exist before the compatibility ALTERs below.
CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1.00,
  unit_price numeric(10,2) NOT NULL,
  line_total numeric(10,2) NOT NULL,
  tax_rate numeric(5,4) NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'NAD',
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'NAD' CHECK (currency = 'NAD'),
  method text NOT NULL CHECK (method IN ('bank_transfer', 'card', 'cash', 'other')),
  reference text,
  paid_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The original manual setup created invoices with legacy names such as customer_name
-- and total_amount. Add the canonical columns expected by db/schema.ts while retaining
-- legacy fields for compatibility and auditability.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS corporate_quote_id uuid,
  ADD COLUMN IF NOT EXISTS billing_name text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS billing_whatsapp text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'NAD',
  ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Copy legacy data only when the legacy column exists. Existing values in canonical
-- columns always win; this is safe to re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='customer_name'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET billing_name = COALESCE(NULLIF(billing_name, ''), NULLIF(customer_name, ''))
      WHERE billing_name IS NULL OR billing_name = ''
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='customer_email'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET billing_email = COALESCE(billing_email, customer_email)
      WHERE billing_email IS NULL
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='customer_whatsapp'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET billing_whatsapp = COALESCE(billing_whatsapp, customer_whatsapp)
      WHERE billing_whatsapp IS NULL
    $q$;
  END IF;

  -- If the legacy invoice references a customer record, use its canonical contact
  -- details before falling back to a generic name.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='customer_id'
  ) AND to_regclass('public.customers') IS NOT NULL THEN
    EXECUTE $q$
      UPDATE public.invoices i
      SET billing_name = COALESCE(NULLIF(i.billing_name, ''), c.full_name),
          billing_email = COALESCE(i.billing_email, c.email),
          billing_whatsapp = COALESCE(i.billing_whatsapp, c.whatsapp)
      FROM public.customers c
      WHERE i.customer_id = c.id
        AND (i.billing_name IS NULL OR i.billing_name = ''
          OR i.billing_email IS NULL OR i.billing_whatsapp IS NULL)
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='total_amount'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET total = total_amount
      WHERE (total IS NULL OR total = 0) AND total_amount IS NOT NULL
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='due_date'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET due_at = due_date
      WHERE due_at IS NULL AND due_date IS NOT NULL
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='service_description'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET description = COALESCE(NULLIF(description, ''), service_description)
      WHERE description IS NULL OR description = ''
    $q$;
  END IF;
END $$;

-- Backfill any remaining required canonical values without deleting legacy data.
UPDATE public.invoices
SET
  billing_name = COALESCE(NULLIF(billing_name, ''), 'Customer'),
  description = COALESCE(NULLIF(description, ''), 'Transport service'),
  currency = COALESCE(currency, 'NAD'),
  subtotal = COALESCE(subtotal, total, 0),
  discount_amount = COALESCE(discount_amount, 0),
  total = COALESCE(total, subtotal, 0),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, created_at, now());

ALTER TABLE public.invoices
  ALTER COLUMN billing_name SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN currency SET DEFAULT 'NAD',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN subtotal SET DEFAULT 0,
  ALTER COLUMN subtotal SET NOT NULL,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN total SET DEFAULT 0,
  ALTER COLUMN total SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

-- Drafts in the new workflow intentionally have no invoice number until issuance.
-- The legacy table required invoice_number immediately, so relax that legacy constraint.
ALTER TABLE public.invoices ALTER COLUMN invoice_number DROP NOT NULL;

-- Legacy source is not part of the new invoice contract. Allow it to be empty for
-- manually created drafts; its CHECK constraint, if present, accepts NULL.
DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='source'
  ) THEN
    ALTER TABLE public.invoices ALTER COLUMN source DROP NOT NULL;
  END IF;
END $;

-- The new contract allows a customer to be unmatched and allows WhatsApp-only
-- contacts, no due date, and no terms. Relax legacy NOT NULL constraints on these
-- optional fields so the admin draft form behaves as designed.
DO $
DECLARE
  legacy_column text;
BEGIN
  FOREACH legacy_column IN ARRAY ARRAY[
    'customer_id',
    'customer_email',
    'customer_whatsapp',
    'due_date',
    'terms'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='invoices' AND column_name=legacy_column
    ) THEN
      EXECUTE format('ALTER TABLE public.invoices ALTER COLUMN %I DROP NOT NULL', legacy_column);
    END IF;
  END LOOP;
END $;

-- Keep legacy columns populated for older reports and constraints while the app uses
-- canonical names. JSONB lets this trigger work whether a particular legacy column
-- exists in this database version or not.
CREATE OR REPLACE FUNCTION public.sync_invoice_legacy_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $
DECLARE
  row_data jsonb := to_jsonb(NEW);
BEGIN
  IF row_data ? 'customer_name' AND row_data ? 'billing_name' THEN
    IF NULLIF(row_data->>'customer_name', '') IS NULL THEN
      row_data := jsonb_set(row_data, '{customer_name}', COALESCE(row_data->'billing_name', 'null'::jsonb), true);
    END IF;
    IF NULLIF(row_data->>'billing_name', '') IS NULL THEN
      row_data := jsonb_set(row_data, '{billing_name}', COALESCE(row_data->'customer_name', 'null'::jsonb), true);
    END IF;
  END IF;

  IF row_data ? 'customer_email' AND row_data ? 'billing_email'
     AND row_data->'customer_email' = 'null'::jsonb THEN
    row_data := jsonb_set(row_data, '{customer_email}', COALESCE(row_data->'billing_email', 'null'::jsonb), true);
  END IF;

  IF row_data ? 'customer_whatsapp' AND row_data ? 'billing_whatsapp'
     AND row_data->'customer_whatsapp' = 'null'::jsonb THEN
    row_data := jsonb_set(row_data, '{customer_whatsapp}', COALESCE(row_data->'billing_whatsapp', 'null'::jsonb), true);
  END IF;

  IF row_data ? 'total_amount' AND row_data ? 'total'
     AND (row_data->'total_amount' = 'null'::jsonb OR row_data->>'total_amount' = '0') THEN
    row_data := jsonb_set(row_data, '{total_amount}', COALESCE(row_data->'total', '0'::jsonb), true);
  END IF;

  IF row_data ? 'due_date' AND row_data ? 'due_at'
     AND row_data->'due_date' = 'null'::jsonb THEN
    row_data := jsonb_set(row_data, '{due_date}', COALESCE(row_data->'due_at', 'null'::jsonb), true);
  END IF;

  NEW := jsonb_populate_record(NEW, row_data);
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS invoices_sync_legacy_columns ON public.invoices;
CREATE TRIGGER invoices_sync_legacy_columns
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_legacy_columns();

-- Drizzle expects the invoice_status enum. Replace the legacy check constraint
-- before converting the status column; preserve old non-draft states as issued,
-- and legacy cancelled states as void.
DO $$
DECLARE
  current_type text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='invoice_status'
  ) THEN
    CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'void');
  END IF;

  ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

  SELECT c.udt_name INTO current_type
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='invoices' AND c.column_name='status';

  IF current_type IS DISTINCT FROM 'invoice_status' THEN
    ALTER TABLE public.invoices ALTER COLUMN status DROP DEFAULT;
    UPDATE public.invoices
    SET status = CASE
      WHEN lower(status::text) = 'draft' THEN 'draft'
      WHEN lower(status::text) IN ('void', 'cancelled', 'canceled') THEN 'void'
      ELSE 'issued'
    END;
    ALTER TABLE public.invoices
      ALTER COLUMN status TYPE public.invoice_status
      USING status::text::public.invoice_status;
  END IF;
  ALTER TABLE public.invoices ALTER COLUMN status SET DEFAULT 'draft'::public.invoice_status;
END $;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_key
  ON public.invoices (invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_public_token_key
  ON public.invoices (public_token);
CREATE INDEX IF NOT EXISTS invoices_customer_created_idx
  ON public.invoices (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_status_due_idx
  ON public.invoices (status, due_at);
CREATE INDEX IF NOT EXISTS invoices_booking_idx
  ON public.invoices (booking_id);
CREATE INDEX IF NOT EXISTS invoices_corporate_quote_idx
  ON public.invoices (corporate_quote_id);
CREATE INDEX IF NOT EXISTS invoices_charter_quote_idx
  ON public.invoices (charter_quote_id);

-- Invoice lines already exist in this database with additional legacy columns.
-- Add the fields the current admin workflow uses; keep tax_rate/discount columns.
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'NAD',
  ADD COLUMN IF NOT EXISTS sort_order smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.invoice_lines
SET currency = COALESCE(currency, 'NAD'),
    sort_order = COALESCE(sort_order, 0),
    created_at = COALESCE(created_at, now());

ALTER TABLE public.invoice_lines
  ALTER COLUMN currency SET DEFAULT 'NAD',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS invoice_lines_invoice_sort_idx
  ON public.invoice_lines (invoice_id, sort_order);

-- Payment allocation table may predate the current schema; add missing columns.
ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'NAD',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.invoice_payments
SET currency = COALESCE(currency, 'NAD'),
    created_at = COALESCE(created_at, now());

ALTER TABLE public.invoice_payments
  ALTER COLUMN currency SET DEFAULT 'NAD',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_paid_idx
  ON public.invoice_payments (invoice_id, paid_at);

-- Use a transactional yearly counter. Seed it from any existing NT-INV-YYYY-NNNNN
-- or NT-YYYY-NNNNN invoice numbers so issuing cannot reuse an existing number.
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.invoice_sequences (year, last_number)
SELECT parsed_year, MAX(parsed_number)
FROM (
  SELECT
    (regexp_match(invoice_number, '^NT-(?:INV-)?([0-9]{4})-([0-9]+)
WHERE parsed_year IS NOT NULL AND parsed_number IS NOT NULL
GROUP BY parsed_year
ON CONFLICT (year) DO UPDATE
SET last_number = GREATEST(public.invoice_sequences.last_number, EXCLUDED.last_number),
    updated_at = now();


-- Invoice schema verification (results should show all four tables).
SELECT table_name, COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('invoices','invoice_lines','invoice_payments','invoice_sequences')
GROUP BY table_name
ORDER BY table_name;


COMMIT;

/*
 * If the unique index above fails, a booking already has two bank_transfer
 * rows. Find them, keep the newest, and re-run:
 *
 *   SELECT booking_id, count(*) FROM payments
 *    WHERE provider = 'bank_transfer' GROUP BY booking_id HAVING count(*) > 1;
 *
 *   DELETE FROM payments p USING payments keep
 *    WHERE p.provider = 'bank_transfer' AND keep.provider = 'bank_transfer'
 *      AND p.booking_id = keep.booking_id
 *      AND (p.status, p.created_at) < (keep.status, keep.created_at);
 */

/*
 * Check it worked — this should return 7.
 *
 *   SELECT count(*) FROM information_schema.columns
 *    WHERE table_schema = 'public'
 *      AND (table_name, column_name) IN (
 *            ('bookings','journey_slug'),
 *            ('bookings','group_ref'),
 *            ('drivers','base_node'),
 *            ('drivers','photo_url'),
 *            ('bookings','pickup_detail'),
 *            ('bookings','traveller_notes'),
 *            ('bookings','details_updated_at')
 *          );
 */
