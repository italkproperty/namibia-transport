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

COMMIT;

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
