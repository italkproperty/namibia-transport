ALTER TABLE "bookings" ADD COLUMN "journey_slug" text;--> statement-breakpoint
CREATE INDEX "bookings_journey_idx" ON "bookings" USING btree ("journey_slug");