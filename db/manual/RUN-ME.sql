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
