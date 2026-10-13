/*
 * Production correction: Hosea Kutako (WDH) -> Windhoek CBD
 *
 * The application catalogue already publishes N$950 for this route, but the
 * production database can retain an older fixed_price. The public route card
 * reads the database when it is available, which can therefore show a stale
 * fare such as N$1,062.
 *
 * Safe to run more than once.
 */
BEGIN;

UPDATE "routes"
SET
  "fixed_price" = 950.00,
  "default_driver_payout" = 665.00,
  "pricing_unit" = 'per_vehicle',
  "updated_at" = NOW()
WHERE "slug" = 'hosea-kutako-to-windhoek';

-- Keep the reverse airport transfer at the same published fare.
UPDATE "routes"
SET
  "fixed_price" = 950.00,
  "default_driver_payout" = 665.00,
  "pricing_unit" = 'per_vehicle',
  "updated_at" = NOW()
WHERE "slug" = 'windhoek-to-hosea-kutako';

COMMIT;

/*
 * Verify:
 *
 * SELECT slug, fixed_price, default_driver_payout, pricing_unit
 * FROM routes
 * WHERE slug IN ('hosea-kutako-to-windhoek', 'windhoek-to-hosea-kutako');
 *
 * Expected:
 * hosea-kutako-to-windhoek | 950.00 | 665.00 | per_vehicle
 * windhoek-to-hosea-kutako | 950.00 | 665.00 | per_vehicle
 */
