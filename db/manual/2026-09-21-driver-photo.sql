-- Driver photographs, so a traveller in arrivals knows the face to look for.
--
-- Idempotent: safe to run twice, and safe to run against a database that has
-- already been migrated by drizzle-kit.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS photo_url text;
