import "server-only";

import { getRouteBySlug, listRoutes } from "@/lib/maps";
import type { RouteView } from "@/lib/maps";
import {
  modelJourneyBySlug,
  withCuratedCeiling,
} from "@/lib/network/journey";

/**
 * What a route slug means when someone tries to book it.
 *
 * Curated first, always. A route in the database or the catalogue has a price
 * a human set and the site has advertised, and the model does not get to
 * second-guess a published promise. Only when no such route exists is the slug
 * read as a pair of places and priced from the road network.
 *
 * That ordering is also the upgrade path: publish `swakopmund-to-sossusvlei`
 * as a curated route one day and every existing link, quote and bookmark for
 * it silently starts using the curated price instead of the modelled one.
 */
export async function resolveBookableRoute(
  slug: string,
): Promise<RouteView | null> {
  const curated = await getRouteBySlug(slug);
  if (curated) return curated;

  const journey = modelJourneyBySlug(slug);
  if (!journey) return null;

  // Same ceiling the quote page applied, from the same list, so the price the
  // traveller was shown is the price this recomputes.
  const { routes } = await listRoutes({ activeOnly: true });
  return withCuratedCeiling(journey, routes).route;
}
