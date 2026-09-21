-- Multi-leg itinerary quotes, and driver photographs.
--
-- Run this whole block in the Supabase SQL editor. It is idempotent: running
-- it twice, or against a database drizzle-kit has already migrated, is safe
-- and changes nothing the second time.

-- Ties the legs of one itinerary together. A Windhoek → Sossusvlei →
-- Swakopmund → airport trip is four driving jobs and one thing the traveller
-- agreed to; the legs stay separate bookings and share this reference.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_ref text;
CREATE INDEX IF NOT EXISTS bookings_group_ref_idx ON bookings (group_ref);

-- A photograph of the driver who is actually coming, so a traveller in
-- arrivals knows the face to look for. Without it the card shows initials.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS photo_url text;
