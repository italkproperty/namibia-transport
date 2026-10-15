import "server-only";

import type { LatLng } from "./types";

/**
 * Mapbox-backed routing for custom charter itineraries.
 *
 * Unlike the curated town-to-town road graph, this service accepts the actual
 * coordinates of lodges, camps, gates and addresses. It deliberately throws a
 * typed, operator-actionable error when a firm route cannot be verified;
 * callers may offer an explicitly labelled fallback, but must not silently
 * substitute a nearby town or straight-line distance.
 */

const GEOCODING_BASE = "https://api.mapbox.com/search/geocode/v6/forward";
const DIRECTIONS_BASE = "https://api.mapbox.com/directions/v5/mapbox/driving";

export type DestinationCandidate = {
  id: string;
  name: string;
  fullAddress: string | null;
  coordinates: LatLng;
  featureType: string | null;
};

export type ResolvedDestination = {
  label: string;
  coordinates: LatLng;
  source: "operator_confirmed" | "mapbox_geocoding";
  providerId?: string;
};

export type VerifiedRouteLeg = {
  fromIndex: number;
  toIndex: number;
  distanceKm: number;
  durationMinutes: number;
  geometry: string | null;
};

export type VerifiedItineraryRoute = {
  provider: "mapbox";
  retrievedAt: string;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  legs: VerifiedRouteLeg[];
  snappedWaypoints: LatLng[];
};

export class CharterRoutingError extends Error {
  readonly code:
    | "missing_token"
    | "invalid_query"
    | "destination_not_found"
    | "too_many_stops"
    | "invalid_coordinates"
    | "provider_unavailable"
    | "route_not_found";

  constructor(
    code: CharterRoutingError["code"],
    message: string,
  ) {
    super(message);
    this.name = "CharterRoutingError";
    this.code = code;
  }
}

function mapboxToken(): string | null {
  return (
    process.env.MAPBOX_SECRET_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
    null
  );
}

function validPoint(point: LatLng): boolean {
  return Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 && point.lat <= 90 &&
    point.lng >= -180 && point.lng <= 180;
}

/** Search Namibia for a real property/address. The operator chooses a match. */
export async function searchCharterDestinations(
  query: string,
): Promise<DestinationCandidate[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 3 || cleanQuery.length > 200) {
    throw new CharterRoutingError(
      "invalid_query",
      "Enter at least three characters for the destination search.",
    );
  }
  const token = mapboxToken();
  if (!token) {
    throw new CharterRoutingError(
      "missing_token",
      "Mapbox is not configured. Add MAPBOX_SECRET_TOKEN in the server environment.",
    );
  }

  const url = new URL(GEOCODING_BASE);
  url.searchParams.set("q", cleanQuery);
  url.searchParams.set("country", "NA");
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "5");
  url.searchParams.set("access_token", token);

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new CharterRoutingError(
      "provider_unavailable",
      "Destination search is temporarily unavailable. Try again or enter a verified map pin.",
    );
  }
  if (!response.ok) {
    throw new CharterRoutingError(
      "provider_unavailable",
      `Destination search failed (Mapbox HTTP ${response.status}). Retry before issuing a firm quote.`,
    );
  }

  const body = await response.json() as {
    features?: Array<{
      id?: string;
      geometry?: { coordinates?: [number, number] };
      properties?: {
        name?: string;
        full_address?: string;
        place_formatted?: string;
        feature_type?: string;
      };
    }>;
  };

  const candidates = (body.features ?? []).flatMap((feature) => {
    const coords = feature.geometry?.coordinates;
    const name = feature.properties?.name?.trim();
    if (!coords || coords.length < 2 || !name) return [];
    const point = { lng: coords[0], lat: coords[1] };
    if (!validPoint(point)) return [];
    return [{
      id: feature.id ?? `${point.lat},${point.lng}`,
      name,
      fullAddress:
        feature.properties?.full_address ??
        feature.properties?.place_formatted ??
        null,
      coordinates: point,
      featureType: feature.properties?.feature_type ?? null,
    }];
  });

  if (candidates.length === 0) {
    throw new CharterRoutingError(
      "destination_not_found",
      "No usable destination match was found. Try the full property name or confirm its map pin.",
    );
  }
  return candidates;
}

/**
 * Routes up to 25 actual itinerary stops. Distances are returned per leg as
 * well as in total, with road distance rather than straight-line distance.
 */
export async function routeCharterItinerary(
  stops: ResolvedDestination[],
): Promise<VerifiedItineraryRoute> {
  if (stops.length < 2) {
    throw new CharterRoutingError(
      "route_not_found",
      "A route needs at least two confirmed destinations.",
    );
  }
  if (stops.length > 25) {
    throw new CharterRoutingError(
      "too_many_stops",
      "A single route can contain at most 25 stops. Split the itinerary into separate route segments.",
    );
  }
  for (const [index, stop] of stops.entries()) {
    if (!stop.label.trim() || !validPoint(stop.coordinates)) {
      throw new CharterRoutingError(
        "invalid_coordinates",
        `Stop ${index + 1} needs a label and valid confirmed coordinates.`,
      );
    }
  }

  const token = mapboxToken();
  if (!token) {
    throw new CharterRoutingError(
      "missing_token",
      "Mapbox is not configured. Add MAPBOX_SECRET_TOKEN in the server environment.",
    );
  }

  const coordinatePath = stops
    .map((stop) => `${stop.coordinates.lng.toFixed(6)},${stop.coordinates.lat.toFixed(6)}`)
    .join(";");
  const url = new URL(`${DIRECTIONS_BASE}/${coordinatePath}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("geometries", "polyline6");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "false");
  url.searchParams.set("alternatives", "false");

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new CharterRoutingError(
      "provider_unavailable",
      "Road routing is temporarily unavailable. Do not treat an unverified estimate as a firm fare.",
    );
  }
  if (!response.ok) {
    throw new CharterRoutingError(
      "provider_unavailable",
      `Road routing failed (Mapbox HTTP ${response.status}). Retry or explicitly approve a labelled estimate.`,
    );
  }

  const body = await response.json() as {
    code?: string;
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: string;
      legs?: Array<{ distance?: number; duration?: number }>;
    }>;
    waypoints?: Array<{ location?: [number, number] }>;
  };
  const route = body.routes?.[0];
  if (
    body.code !== "Ok" ||
    !route ||
    !Array.isArray(route.legs) ||
    route.legs.length !== stops.length - 1 ||
    route.distance == null ||
    route.duration == null
  ) {
    throw new CharterRoutingError(
      "route_not_found",
      "Mapbox could not route every leg. Check the selected property pins and road access.",
    );
  }

  const legs = route.legs.map((leg, index) => {
    if (leg.distance == null || leg.duration == null) {
      throw new CharterRoutingError(
        "route_not_found",
        `Mapbox returned no distance or duration for leg ${index + 1}.`,
      );
    }
    return {
      fromIndex: index,
      toIndex: index + 1,
      distanceKm: Math.round((leg.distance / 1000) * 10) / 10,
      durationMinutes: Math.round(leg.duration / 60),
      geometry: route.geometry ?? null,
    };
  });

  return {
    provider: "mapbox",
    retrievedAt: new Date().toISOString(),
    totalDistanceKm: Math.round((route.distance / 1000) * 10) / 10,
    totalDurationMinutes: Math.round(route.duration / 60),
    legs,
    snappedWaypoints: (body.waypoints ?? []).flatMap((waypoint) => {
      const coords = waypoint.location;
      if (!coords || coords.length < 2) return [];
      const point = { lng: coords[0], lat: coords[1] };
      return validPoint(point) ? [point] : [];
    }),
  };
}
