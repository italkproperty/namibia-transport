import type { PricingUnit, RouteCategory } from "@/db/schema";

export type LatLng = { lat: number; lng: number };

/**
 * The shape pages and the booking form consume. Both the database and the
 * static catalogue map into it, so no UI code depends on a Drizzle row or on
 * whether a database happens to be connected.
 */
export type RouteView = {
  id: string;
  slug: string;
  originLabel: string;
  destinationLabel: string;
  category: RouteCategory;
  /** Decimal strings, e.g. "650.00". */
  fixedPrice: string;
  /** What one unit of fixedPrice buys: the whole vehicle, or one seat. */
  pricingUnit: PricingUnit;
  defaultDriverPayout: string;
  currency: string;
  isActive: boolean;
  distanceKm: string | null;
  durationMin: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoBody: string | null;
  /** Null until a route has been given coordinates; maps degrade to nothing. */
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  routeGeometry: string | null;
};

export type VehicleClassView = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  capacity: number;
  luggageCapacity: number;
  /** Multiplier applied to a route's fixed price, e.g. "1.40". */
  priceMultiplier: string;
};

/** A fully resolved fare. Every figure is computed server-side. */
export type FareQuote = {
  routeId: string;
  vehicleClassId: string;
  /** What the customer pays. */
  customerPrice: string;
  /** What the partner driver is paid. */
  driverPayout: string;
  /** customerPrice - driverPayout. */
  contribution: string;
  currency: string;
  distanceKm: string | null;
  durationMin: number | null;
};

/** Where the catalogue was read from. Surfaced in the admin view. */
export type CatalogSource = "database" | "fallback";

export type RouteLeg = {
  distanceKm: number;
  durationMin: number;
  /** Encoded polyline (polyline6) of the driven road, from Directions. */
  encodedGeometry?: string;
};

/**
 * Distance/duration lookup. Backed by the routes table today; a Mapbox
 * Directions implementation slots in behind the same shape later.
 */
export interface RouteProvider {
  readonly name: string;
  getLeg(origin: LatLng, destination: LatLng): Promise<RouteLeg | null>;
}
