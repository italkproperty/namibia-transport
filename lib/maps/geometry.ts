import "server-only";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { routes } from "@/db/schema";

import { MapboxRouteProvider, isMapboxConfigured } from "./mapbox";
import type { RouteView } from "./types";

/**
 * Fills in a route's road geometry the first time it is needed, then keeps it.
 *
 * The alternative was a CLI command someone has to remember to run, which
 * meant every route map drew a straight line across the veld until they did.
 * This asks Mapbox once, writes the polyline to the routes row, and never asks
 * again — the database is the cache.
 *
 * Deliberately does NOT touch distance or duration. Those are quoted to
 * travellers, and silently rewriting a published figure during a page render
 * is not something that should happen as a side effect of someone loading the
 * home page. `npm run routes:measure` updates those explicitly.
 */

/** Shared per process so concurrent renders of the same route fetch once. */
const inFlight = new Map<string, Promise<string | null>>();

async function fetchAndPersist(route: RouteView): Promise<string | null> {
  const { originLat, originLng, destinationLat, destinationLng } = route;
  if (
    originLat == null ||
    originLng == null ||
    destinationLat == null ||
    destinationLng == null
  ) {
    return null;
  }

  // A route that starts and ends in the same place has no line to draw.
  if (originLat === destinationLat && originLng === destinationLng) return null;

  const leg = await new MapboxRouteProvider().getLeg(
    { lat: originLat, lng: originLng },
    { lat: destinationLat, lng: destinationLng }
  );

  const geometry = leg?.encodedGeometry ?? null;
  if (!geometry) return null;

  if (isDatabaseConfigured()) {
    try {
      await getDb()
        .update(routes)
        .set({ routeGeometry: geometry, updatedAt: new Date() })
        .where(eq(routes.id, route.id));
    } catch (error) {
      // Worth a line in the logs, but not worth failing a page render: the
      // map still draws, we just pay for the lookup again next boot.
      console.error(
        `[maps] could not cache geometry for ${route.slug}`,
        error
      );
    }
  }

  return geometry;
}

/** Returns the route with its geometry populated, where that is possible. */
export async function withRouteGeometry(route: RouteView): Promise<RouteView> {
  if (route.routeGeometry || !isMapboxConfigured()) return route;

  let pending = inFlight.get(route.slug);
  if (!pending) {
    pending = fetchAndPersist(route).catch((error) => {
      console.error(`[maps] geometry lookup failed for ${route.slug}`, error);
      return null;
    });
    inFlight.set(route.slug, pending);
  }

  const geometry = await pending;
  return geometry ? { ...route, routeGeometry: geometry } : route;
}

/** The same, for every route on a page. Lookups run concurrently. */
export async function withRouteGeometries(
  list: RouteView[]
): Promise<RouteView[]> {
  return Promise.all(list.map((route) => withRouteGeometry(route)));
}
