import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { routes, type Route } from "@/db/schema";
import { toMoneyString } from "@/lib/money";

import type { FareQuote } from "./types";

/**
 * Fallback rate used only when a route has no fixed price. Replaced by
 * pricing_rules + Mapbox distances once dynamic quoting lands.
 */
const FALLBACK_RATE_PER_KM = 18;
const FALLBACK_MINIMUM_FARE = 250;

export async function getRouteBySlug(slug: string): Promise<Route | null> {
  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.slug, slug), eq(routes.isActive, true)))
    .limit(1);

  return route ?? null;
}

export async function listActiveRoutes(): Promise<Route[]> {
  return db.select().from(routes).where(eq(routes.isActive, true));
}

/**
 * Authoritative fare for a route. Always call this on the server: a price that
 * arrived from the client is an input to validate, never a value to trust.
 */
export function quoteFareForRoute(route: Route): FareQuote {
  if (route.fixedPrice !== null) {
    return {
      routeId: route.id,
      routeSlug: route.slug,
      source: "fixed_route",
      fareTotal: toMoneyString(Number(route.fixedPrice)),
      currency: route.currency,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
    };
  }

  const distanceKm = route.distanceKm === null ? null : Number(route.distanceKm);
  if (distanceKm === null) {
    throw new Error(
      `Route ${route.slug} has neither a fixed price nor a distance to price from`
    );
  }

  const fare = Math.max(
    FALLBACK_MINIMUM_FARE,
    Math.ceil((distanceKm * FALLBACK_RATE_PER_KM) / 10) * 10
  );

  return {
    routeId: route.id,
    routeSlug: route.slug,
    source: "distance",
    fareTotal: toMoneyString(fare),
    currency: route.currency,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
  };
}

/** Convenience wrapper: look the route up and price it in one call. */
export async function quoteFareBySlug(slug: string): Promise<FareQuote | null> {
  const route = await getRouteBySlug(slug);
  return route ? quoteFareForRoute(route) : null;
}
