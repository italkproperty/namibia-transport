import "./env";

import { eq, isNotNull } from "drizzle-orm";

import { getDb } from "./index";
import { routes } from "./schema";
import { MapboxRouteProvider, isMapboxConfigured } from "../lib/maps/mapbox";

/**
 * Measures every route against Mapbox Directions and writes the result back.
 *
 * Distance and duration were typed by hand from rough knowledge, which is fine
 * for a launch price but wrong to quote at travellers — "about 45 min" should
 * be the road's answer, not ours. The encoded polyline is cached at the same
 * time so route pages can draw the real driven path without an API call per
 * view.
 *
 * Idempotent and safe to re-run; a route Mapbox cannot answer for is left
 * exactly as it was.
 */
async function main() {
  if (!isMapboxConfigured()) {
    console.error(
      "NEXT_PUBLIC_MAPBOX_TOKEN is not set — nothing to measure. See .env.example."
    );
    process.exit(1);
  }

  const db = getDb();
  const provider = new MapboxRouteProvider();

  const rows = await db
    .select()
    .from(routes)
    .where(isNotNull(routes.originLat));

  if (rows.length === 0) {
    console.info("No routes have coordinates yet. Run `npm run db:seed` first.");
    return;
  }

  let measured = 0;

  for (const route of rows) {
    const { originLat, originLng, destinationLat, destinationLng } = route;
    if (
      originLat == null ||
      originLng == null ||
      destinationLat == null ||
      destinationLng == null
    ) {
      console.warn(`  skipped   ${route.slug} — incomplete coordinates`);
      continue;
    }

    // A route whose endpoints are the same place (the corporate city rate)
    // has no leg to measure.
    if (originLat === destinationLat && originLng === destinationLng) {
      console.info(`  skipped   ${route.slug} — origin and destination match`);
      continue;
    }

    const leg = await provider.getLeg(
      { lat: originLat, lng: originLng },
      { lat: destinationLat, lng: destinationLng }
    );

    if (!leg) {
      console.warn(`  failed    ${route.slug} — Mapbox returned no route`);
      continue;
    }

    const before = `${route.distanceKm ?? "?"}km / ${route.durationMin ?? "?"}min`;

    await db
      .update(routes)
      .set({
        distanceKm: leg.distanceKm.toFixed(2),
        durationMin: leg.durationMin,
        routeGeometry: leg.encodedGeometry ?? null,
        updatedAt: new Date(),
      })
      .where(eq(routes.id, route.id));

    measured += 1;
    console.info(
      `  measured  ${route.slug.padEnd(30)} ${before}  ->  ${leg.distanceKm}km / ${leg.durationMin}min` +
        (leg.encodedGeometry ? "  (+ geometry)" : "")
    );
  }

  console.info(`\nMeasured ${measured} of ${rows.length} routes.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
