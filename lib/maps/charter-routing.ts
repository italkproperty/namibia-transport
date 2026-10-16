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

const NAMIBIA_DESTINATIONS: DestinationCandidate[] = [
  { id: "catalog:kulala-desert-lodge", name: "Kulala Desert Lodge", fullAddress: "Kulala Wilderness Reserve, Hardap Region, Namibia", coordinates: { lat: -24.61485, lng: 15.70331 }, featureType: "lodge", source: "namibia_destination_catalog" },
  { id: "catalog:little-kulala", name: "Little Kulala", fullAddress: "Kulala Wilderness Reserve, Hardap Region, Namibia", coordinates: { lat: -24.61880, lng: 15.76560 }, featureType: "lodge", source: "namibia_destination_catalog" },
  { id: "catalog:villa-margherita", name: "Villa Margherita", fullAddress: "34 Daniel Tjongarero Avenue, Swakopmund, Namibia", coordinates: { lat: -22.67669, lng: 14.52875 }, featureType: "hotel", source: "namibia_destination_catalog" },
  { id: "catalog:anderssons-at-ongava", name: "Anderssons at Ongava", fullAddress: "Ongava Private Game Reserve, near Etosha, Namibia", coordinates: { lat: -19.343611, lng: 15.898806 }, featureType: "lodge", source: "namibia_destination_catalog" },
  { id: "catalog:okonjima-bush-camp", name: "Okonjima Bush Camp", fullAddress: "Okonjima Nature Reserve, Otjozondjupa, Namibia", coordinates: { lat: -20.850158, lng: 16.666221 }, featureType: "lodge", source: "namibia_destination_catalog" },
  { id: "catalog:hilton-windhoek", name: "Hilton Windhoek", fullAddress: "Rev. Michael Scott Street, Windhoek, Namibia", coordinates: { lat: -22.57037, lng: 17.08538 }, featureType: "hotel", source: "namibia_destination_catalog" },
  { id: "catalog:windhoek-airport", name: "Hosea Kutako International Airport", fullAddress: "Hosea Kutako International Airport, Namibia", coordinates: { lat: -22.4799, lng: 17.4709 }, featureType: "airport", source: "namibia_destination_catalog" },
];


export type DestinationCandidate = {
  id: string;
  name: string;
  fullAddress: string | null;
  coordinates: LatLng;
  featureType: string | null;
  source: "mapbox_geocoding" | "openstreetmap_geocoding" | "namibia_destination_catalog";
};

export type ResolvedDestination = {
  label: string;
  coordinates: LatLng;
  source: "operator_confirmed" | "mapbox_geocoding" | "openstreetmap_geocoding" | "namibia_destination_catalog";
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
  /** Full itinerary overview geometry, not falsely represented as each leg. */
  geometry: string | null;
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
export async function searchCharterDestinations(query: string): Promise<DestinationCandidate[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 3 || cleanQuery.length > 200) {
    throw new CharterRoutingError("invalid_query", "Enter at least three characters for the destination search.");
  }

    const normalise = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const q = normalise(cleanQuery);
  const curated = NAMIBIA_DESTINATIONS.filter((item) => {
    const searchable = normalise(`${item.name} ${item.fullAddress ?? ""}`);
    return searchable.includes(q) || q.includes(normalise(item.name));
  });
  // Exact known Namibia destinations take priority over fuzzy provider results.
  if (curated.length) return curated.slice(0, 5);

  const token = mapboxToken();
  let mapboxCandidates: DestinationCandidate[] = [];
  if (token) {
    const url = new URL(GEOCODING_BASE);
            url.searchParams.set("q", /\bnamibia\b/i.test(cleanQuery) ? cleanQuery : cleanQuery + ", Namibia");
    url.searchParams.set("country", "NA");
    url.searchParams.set("language", "en");
    url.searchParams.set("limit", "5");
    url.searchParams.set("access_token", token);
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7000) });
      if (response.ok) {
        const body = await response.json() as { features?: Array<{ id?: string; geometry?: { coordinates?: [number, number] }; properties?: { name?: string; name_preferred?: string; full_address?: string; place_formatted?: string; feature_type?: string } }> };
        mapboxCandidates = (body.features ?? []).flatMap((feature) => {
          const coords = feature.geometry?.coordinates;
          const name = (feature.properties?.name_preferred ?? feature.properties?.name)?.trim();
          if (!coords || coords.length < 2 || !name) return [];
          const point = { lng: coords[0], lat: coords[1] };
          if (!validPoint(point)) return [];
          return [{ id: feature.id ?? `${point.lat},${point.lng}`, name, fullAddress: feature.properties?.full_address ?? feature.properties?.place_formatted ?? null, coordinates: point, featureType: feature.properties?.feature_type ?? null, source: "mapbox_geocoding" as const }];
        });
      }
    } catch {
      // Fall through to OpenStreetMap and the curated Namibia destination index.
    }
  }

  const osmCandidates: DestinationCandidate[] = [];
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
            url.searchParams.set("q", /\bnamibia\b/i.test(cleanQuery) ? cleanQuery : cleanQuery + ", Namibia");
    url.searchParams.set("countrycodes", "na");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "NamibiaTransport/1.0 (charter destination lookup)" },
    });
    if (response.ok) {
      const body = await response.json() as Array<{ place_id?: number; osm_type?: string; osm_id?: number; name?: string; display_name?: string; lat?: string; lon?: string; type?: string; class?: string }>;
      for (const feature of body) {
        const lat = Number(feature.lat);
        const lng = Number(feature.lon);
        const name = feature.name?.trim() || feature.display_name?.split(",")[0]?.trim();
        if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const point = { lat, lng };
        if (!validPoint(point) || lat > -16 || lat < -30 || lng < 11 || lng > 26) continue;
        osmCandidates.push({ id: `osm:${feature.osm_type ?? "place"}:${feature.osm_id ?? feature.place_id ?? `${lat},${lng}`}`, name, fullAddress: feature.display_name ?? "Namibia", coordinates: point, featureType: feature.type ?? feature.class ?? null, source: "openstreetmap_geocoding" });
      }
    }
  } catch {
    // We still return any Mapbox matches rather than failing the whole search.
  }

  const merged = [...mapboxCandidates, ...osmCandidates];
  const seen = new Set<string>();
  const unique = merged.filter((item) => {
    const key = `${normalise(item.name)}|${item.coordinates.lat.toFixed(4)}|${item.coordinates.lng.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
  if (unique.length) return unique;

  throw new CharterRoutingError(
    token ? "destination_not_found" : "missing_token",
    token
      ? "No destination was found in Mapbox or OpenStreetMap. Try the lodge's full official name, or add it to the Namibia destination catalogue after verifying its map pin."
      : "Mapbox is not configured and the destination was not found in the Namibia catalogue. Add MAPBOX_SECRET_TOKEN in the server environment.",
  );
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
    // Keep routing inside the serverless request budget. Without an explicit
    // timeout, a stalled Mapbox Directions request can hold the server action
    // open until Vercel returns a generic 504 and the UI remains stuck loading.
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("[charter-routing] Mapbox Directions request failed", {
      reason: timedOut ? "timeout" : error instanceof Error ? error.name : "unknown",
      stopCount: stops.length,
    });
    throw new CharterRoutingError(
      "provider_unavailable",
      timedOut
        ? "Road routing took too long to respond. Your quote has not been saved; retry in a moment. If this repeats, check Mapbox service status and token limits."
        : "Road routing is temporarily unavailable. Your quote has not been saved; retry shortly. Do not treat an unverified estimate as a firm fare.",
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
      geometry: null,
    };
  });

  return {
    provider: "mapbox",
    retrievedAt: new Date().toISOString(),
    totalDistanceKm: Math.round((route.distance / 1000) * 10) / 10,
    totalDurationMinutes: Math.round(route.duration / 60),
    geometry: route.geometry ?? null,
    legs,
    snappedWaypoints: (body.waypoints ?? []).flatMap((waypoint) => {
      const coords = waypoint.location;
      if (!coords || coords.length < 2) return [];
      const point = { lng: coords[0], lat: coords[1] };
      return validPoint(point) ? [point] : [];
    }),
  };
}
