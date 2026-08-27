ALTER TABLE "bookings" ADD COLUMN "pickup_lat" double precision;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pickup_lng" double precision;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "dropoff_lat" double precision;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "dropoff_lng" double precision;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "origin_lat" double precision;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "origin_lng" double precision;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "destination_lat" double precision;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "destination_lng" double precision;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "route_geometry" text;