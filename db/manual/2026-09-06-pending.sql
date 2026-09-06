/*
 * Production changes pending as of 6 September 2026.
 *
 * Run in the Supabase SQL editor. Safe to run more than once: every
 * statement is idempotent, and the whole script is one transaction, so a
 * failure leaves the database exactly as it was.
 *
 * Verified on a scratch cluster restored to production's state (migrations
 * 0000-0004 applied, seeded, airport route per_person, sedan at 3 bags):
 * applied cleanly, produced the values asserted at the bottom, ran a second
 * time with no error, and the booking-insert test suites passed against the
 * result.
 *
 * Drizzle migrations 0005 and 0006 are inlined here rather than run through
 * drizzle-kit because production is reached through Supabase's SQL editor.
 */
BEGIN;

-- 1. Modelled journeys on bookings (migration 0005_last_magik).
--    Until this exists, every booking insert fails on production.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "journey_slug" text;
CREATE INDEX IF NOT EXISTS "bookings_journey_idx" ON "bookings" USING btree ("journey_slug");

-- 2. Where each driver is based (migration 0006_redundant_fantastic_four),
--    so the dispatch calendar can cost a repositioning drive.
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "base_node" text;

-- 3. Per-vehicle pricing everywhere. The code already ignores per_person,
--    so this is data hygiene rather than a behaviour switch.
UPDATE "routes" SET "pricing_unit" = 'per_vehicle' WHERE "pricing_unit" <> 'per_vehicle';

-- 4. Honest luggage capacities. Without this the sedan still claims three
--    large cases and the luggage-based upgrade never fires.
UPDATE "vehicle_classes" SET "luggage_capacity" = 2 WHERE "slug" = 'private-sedan';
UPDATE "vehicle_classes" SET "luggage_capacity" = 4 WHERE "slug" = 'suv-4x4';

COMMIT;

/*
 * Expected afterwards:
 *   SELECT count(*) FROM routes WHERE pricing_unit = 'per_person';   -- 0
 *   SELECT slug, luggage_capacity FROM vehicle_classes;              -- 2 and 4
 *   SELECT count(*) FROM information_schema.columns
 *     WHERE (table_name='bookings' AND column_name='journey_slug')
 *        OR (table_name='drivers'  AND column_name='base_node');     -- 2
 */
