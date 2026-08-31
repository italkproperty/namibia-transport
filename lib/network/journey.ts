import type { RouteView } from "@/lib/maps/types";
import { toMoneyString } from "@/lib/money";

import { modelFare, modelPayout } from "./fare-model";
import { findNode, nodeLabel, PLACE_NODES, type PlaceNode } from "./nodes";
import { findRoad, type Road } from "./roads";

/**
 * A journey between any two places, wearing the same shape as a curated route.
 *
 * The rest of the app — the booking form, the fare maths, the maps, the
 * confirmation email — all speak `RouteView`. Rather than teach every one of
 * them about a second kind of trip, a modelled journey is presented as a
 * RouteView with a computed price. The one thing it does not have is a row in
 * the routes table, and that is deliberate: nothing is written to the database
 * to make a quote, so the network can price a thousand pairs without seeding
 * a thousand rows nobody will ever visit.
 *
 * The absent row shows up as an empty `id`. Bookings store `route_id` as null
 * for these and rely on the labels and economics already snapshotted onto the
 * booking itself — which is every figure that matters, and the same ones a
 * curated booking keeps.
 */

/** Journeys have no routes row, so their RouteView carries no id. */
export const MODELLED_ROUTE_ID = "";

export function isModelledRoute(route: Pick<RouteView, "id">): boolean {
  return route.id === MODELLED_ROUTE_ID;
}

/**
 * `windhoek-to-sossusvlei`. Deliberately the same shape as a curated slug: a
 * curated route for the pair, if one is ever created, takes the slug over and
 * the journey stops being modelled without a single link breaking.
 */
export function journeySlug(originSlug: string, destinationSlug: string): string {
  return `${originSlug}-to-${destinationSlug}`;
}

/**
 * Splits a slug back into two known places.
 *
 * Node slugs contain hyphens and one contains "-to-" in no place, but rather
 * than rely on that, every possible split is tried and the one where both
 * halves name a real place wins. Ambiguity would need two places whose names
 * overlap across the separator, which cannot happen while both halves must
 * resolve exactly.
 */
export function parseJourneySlug(
  slug: string,
): { origin: PlaceNode; destination: PlaceNode } | null {
  const separator = "-to-";
  let index = slug.indexOf(separator);

  while (index !== -1) {
    const origin = findNode(slug.slice(0, index));
    const destination = findNode(slug.slice(index + separator.length));
    if (origin && destination && origin.slug !== destination.slug) {
      return { origin, destination };
    }
    index = slug.indexOf(separator, index + 1);
  }
  return null;
}

/* --------------------------------------------------------------- the view */

export type Journey = {
  route: RouteView;
  road: Road;
  /** Nights the driver spends away. Zero for anything inside a long day. */
  overnights: number;
  /** True where any part of the drive is on gravel — the traveller should know. */
  hasGravel: boolean;
};

function toRouteView(road: Road): RouteView {
  const fare = modelFare(road);
  const isAirport = Boolean(road.origin.isAirport || road.destination.isAirport);

  return {
    id: MODELLED_ROUTE_ID,
    slug: journeySlug(road.origin.slug, road.destination.slug),
    originLabel: road.origin.name,
    destinationLabel: road.destination.name,
    category: isAirport ? "airport" : "intercity",
    fixedPrice: toMoneyString(fare.price),
    // Always the whole car. Per-seat pricing is a shuttle product and it
    // exists on exactly one route; a modelled journey is a private vehicle.
    pricingUnit: "per_vehicle",
    defaultDriverPayout: toMoneyString(modelPayout(fare.price)),
    currency: "NAD",
    isActive: true,
    distanceKm: toMoneyString(Math.round(road.km)),
    durationMin: road.minutes,
    // No SEO fields on purpose. A thousand generated pages of near-identical
    // copy is how a site earns a thin-content penalty; the curated routes are
    // the pages we ask Google to read, and these are quotes, not pages.
    seoTitle: null,
    seoDescription: null,
    seoBody: null,
    originLat: road.origin.lat,
    originLng: road.origin.lng,
    destinationLat: road.destination.lat,
    destinationLng: road.destination.lng,
    routeGeometry: null,
  };
}

/** Prices a journey between two known places. Null if either is unknown. */
export function modelJourney(
  originSlug: string,
  destinationSlug: string,
): Journey | null {
  const road = findRoad(originSlug, destinationSlug);
  if (!road) return null;

  return {
    route: toRouteView(road),
    road,
    overnights: modelFare(road).overnights,
    hasGravel: road.gravelKm > 0,
  };
}

/** The same, from a `a-to-b` slug. */
export function modelJourneyBySlug(slug: string): Journey | null {
  const parsed = parseJourneySlug(slug);
  if (!parsed) return null;
  return modelJourney(parsed.origin.slug, parsed.destination.slug);
}

/* ------------------------------------------- matching curated routes to nodes */

/**
 * How close a curated route's endpoint has to be to a node to be the same
 * place. Generous: these are town centres and gates, and two points 20 km
 * apart on the Namibian road network are the same destination for a driver.
 */
const SAME_PLACE_KM = 25;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function nearestNode(point: { lat: number; lng: number }): PlaceNode | null {
  let best: PlaceNode | null = null;
  let bestKm = SAME_PLACE_KM;
  for (const node of PLACE_NODES) {
    const km = haversineKm(point, node);
    if (km <= bestKm) {
      best = node;
      bestKm = km;
    }
  }
  return best;
}

/**
 * The node pair a curated route joins, matched on coordinates rather than on a
 * hand-maintained table — a route added straight to the database is matched
 * too, without a deploy. Null when a route has no coordinates, or joins a
 * place the network does not model, or starts and ends in the same place (the
 * corporate city route does).
 */
export function nodePairForRoute(
  route: Pick<
    RouteView,
    "originLat" | "originLng" | "destinationLat" | "destinationLng"
  >,
): { origin: PlaceNode; destination: PlaceNode } | null {
  if (
    route.originLat === null ||
    route.originLng === null ||
    route.destinationLat === null ||
    route.destinationLng === null
  ) {
    return null;
  }

  const origin = nearestNode({ lat: route.originLat, lng: route.originLng });
  const destination = nearestNode({
    lat: route.destinationLat,
    lng: route.destinationLng,
  });

  if (!origin || !destination || origin.slug === destination.slug) return null;
  return { origin, destination };
}

/* ---------------------------------------------- the published-price ceiling */

/**
 * A modelled fare must never be dearer than a route we already advertise for a
 * drive to the same place that is both longer and slower.
 *
 * The model says our Sossusvlei fare is about a tenth light, and it may well be
 * right — but until someone decides to raise it, the published N$6,500 from
 * Hosea Kutako stands, and quoting N$6,700 for the shorter run from Windhoek
 * would ask more money for less driving. A traveller comparing the two pages
 * would be right to distrust both. So the published price becomes a ceiling:
 * the modelled quote is pulled down to it, and the payout with it, so the
 * split still holds.
 *
 * The cure for the ceiling biting is to fix the published price rather than
 * the model. When the curated fare moves, everything under it moves too.
 */
export function withCuratedCeiling(
  journey: Journey,
  /** Only the fields the ceiling reads, so a partial row is enough to pass. */
  curated: Pick<
    RouteView,
    | "pricingUnit"
    | "fixedPrice"
    | "originLat"
    | "originLng"
    | "destinationLat"
    | "destinationLng"
  >[],
): Journey {
  let ceiling = Infinity;

  for (const route of curated) {
    // Per-seat fares are not comparable with a whole-vehicle quote.
    if (route.pricingUnit === "per_person") continue;

    const pair = nodePairForRoute(route);
    if (!pair || pair.destination.slug !== journey.road.destination.slug) continue;

    // Measured the same way as the quote, not read off the route's own
    // distance field — two numbers from two sources would compare badly.
    const curatedRoad = findRoad(pair.origin.slug, pair.destination.slug);
    if (!curatedRoad) continue;

    /**
     * The published route has to be the harder drive on both counts before it
     * can cap anything. Distance alone is the wrong test: Sossusvlei to
     * Swakopmund is 30 km shorter than the airport run to Swakopmund and an
     * hour and a half longer, because 340 km of it is gravel. Capping that to
     * the tar price would sell a day's work at half a day's fare.
     */
    if (
      curatedRoad.km < journey.road.km ||
      curatedRoad.minutes < journey.road.minutes
    ) {
      continue;
    }

    ceiling = Math.min(ceiling, Number(route.fixedPrice));
  }

  const price = Number(journey.route.fixedPrice);
  if (!Number.isFinite(ceiling) || ceiling >= price) return journey;

  return {
    ...journey,
    route: {
      ...journey.route,
      fixedPrice: toMoneyString(ceiling),
      defaultDriverPayout: toMoneyString(modelPayout(ceiling)),
    },
  };
}

/** "Windhoek to Sossusvlei" — for headings and links. */
export function journeyTitle(road: Road): string {
  return `${nodeLabel(road.origin)} to ${nodeLabel(road.destination)}`;
}

/**
 * The same, from the slug snapshotted onto a booking. Null rather than a
 * guess when the slug names a place the network no longer models — a booking
 * still has its pickup and drop-off labels to fall back on.
 */
export function journeyLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const parsed = parseJourneySlug(slug);
  return parsed
    ? `${nodeLabel(parsed.origin)} to ${nodeLabel(parsed.destination)}`
    : null;
}
