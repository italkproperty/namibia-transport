export type LatLng = { lat: number; lng: number };

/** How a fare was arrived at — persisted alongside the booking for auditing. */
export type FareSource = "fixed_route" | "distance";

export type FareQuote = {
  routeId: string | null;
  routeSlug: string | null;
  source: FareSource;
  /** Decimal string, e.g. "650.00". */
  fareTotal: string;
  currency: string;
  distanceKm: string | null;
  durationMin: number | null;
};

export type RouteLeg = {
  distanceKm: number;
  durationMin: number;
  /** GeoJSON LineString coordinates, once Mapbox Directions is wired up. */
  geometry?: [number, number][];
};

/**
 * Distance/duration lookup. Backed by the routes table today; a Mapbox
 * Directions implementation slots in behind the same shape later.
 */
export interface RouteProvider {
  readonly name: string;
  getLeg(origin: LatLng, destination: LatLng): Promise<RouteLeg | null>;
}
