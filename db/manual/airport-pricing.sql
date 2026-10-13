-- Namibia Transport: publish both Windhoek / Hosea Kutako airport directions.
-- Standard Private Car: N$950 each way. SUV/4x4 uses its configured multiplier.
BEGIN;

INSERT INTO "routes" (
  "id", "slug", "origin_label", "destination_label", "category",
  "fixed_price", "pricing_unit", "currency", "default_driver_payout",
  "is_active", "distance_km", "duration_min", "sort_order",
  "origin_lat", "origin_lng", "destination_lat", "destination_lng",
  "seo_title", "seo_description", "seo_body"
) VALUES (
  'a7bb0a1a-4e56-5ef0-90b3-0c1e3cbdad12',
  'windhoek-to-hosea-kutako',
  'Windhoek CBD',
  'Hosea Kutako International Airport (WDH)',
  'airport',
  950.00, 'per_vehicle', 'NAD', 665.00,
  true, 45.00, 45, 15,
  -22.5609, 17.0658, -22.4799, 17.4709,
  'Windhoek to Hosea Kutako Airport Transfer — Fixed Price Private Car',
  'Book a private transfer from Windhoek CBD to Hosea Kutako International Airport (WDH). Fixed price, professional Namibian drivers and reliable airport drop-off.',
  'A private transfer from Windhoek CBD to Hosea Kutako International Airport is approximately 45 kilometres and takes around 45 minutes in normal traffic. Book in advance for a dependable drop-off at departures. The fare is N$950 for the whole private car, not per passenger.'
)
ON CONFLICT ("slug") DO UPDATE SET
  "origin_label" = EXCLUDED."origin_label",
  "destination_label" = EXCLUDED."destination_label",
  "category" = EXCLUDED."category",
  "fixed_price" = EXCLUDED."fixed_price",
  "pricing_unit" = EXCLUDED."pricing_unit",
  "default_driver_payout" = EXCLUDED."default_driver_payout",
  "is_active" = EXCLUDED."is_active",
  "distance_km" = EXCLUDED."distance_km",
  "duration_min" = EXCLUDED."duration_min",
  "sort_order" = EXCLUDED."sort_order",
  "origin_lat" = EXCLUDED."origin_lat",
  "origin_lng" = EXCLUDED."origin_lng",
  "destination_lat" = EXCLUDED."destination_lat",
  "destination_lng" = EXCLUDED."destination_lng",
  "seo_title" = EXCLUDED."seo_title",
  "seo_description" = EXCLUDED."seo_description",
  "seo_body" = EXCLUDED."seo_body",
  "updated_at" = now();

UPDATE "routes"
SET "fixed_price" = 950.00,
    "default_driver_payout" = 665.00,
    "updated_at" = now()
WHERE "slug" = 'hosea-kutako-to-windhoek';

UPDATE "pricing_rules"
SET "is_active" = false, "updated_at" = now()
WHERE "route_id" IN (
  SELECT "id" FROM "routes"
  WHERE "slug" IN ('hosea-kutako-to-windhoek', 'windhoek-to-hosea-kutako')
)
AND "rule_type" = 'multiplier'
AND "is_active" = true;

COMMIT;
