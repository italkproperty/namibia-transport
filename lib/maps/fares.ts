import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { routes, vehicleClasses } from "@/db/schema";
import {
  CATALOG_ROUTES,
  CATALOG_ROUTES_BY_SLUG,
  CATALOG_VEHICLE_CLASSES,
} from "@/lib/catalog";
import { toMoneyString } from "@/lib/money";

import type {
  CatalogSource,
  FareQuote,
  RouteView,
  VehicleClassView,
} from "./types";

/**
 * Catalogue reads fall back to lib/catalog.ts when no database is reachable,
 * so the marketing site and booking form work before Supabase is provisioned.
 * The fallback is safe because the seed writes those exact rows, IDs included
 * — and it covers reads only. Writing a booking still requires a database, so
 * nothing can be sold at a guessed price.
 */

let warnedAboutFallback = false;

function noteFallback(reason: string) {
  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      `[catalog] serving the static catalogue (${reason}). Run \`npm run db:seed\` once a database is configured.`
    );
  }
}

/* ------------------------------------------------------------------ mapping */

type CatalogRoute = (typeof CATALOG_ROUTES)[number];
type CatalogVehicleClass = (typeof CATALOG_VEHICLE_CLASSES)[number];

function catalogRouteToView(route: CatalogRoute): RouteView {
  return {
    id: route.id as string,
    slug: route.slug,
    originLabel: route.originLabel,
    destinationLabel: route.destinationLabel,
    category: route.category,
    fixedPrice: route.fixedPrice as string,
    defaultDriverPayout: route.defaultDriverPayout as string,
    currency: route.currency ?? "NAD",
    isActive: route.isActive ?? false,
    distanceKm: (route.distanceKm as string | undefined) ?? null,
    durationMin: route.durationMin ?? null,
    seoTitle: route.seoTitle ?? null,
    seoDescription: route.seoDescription ?? null,
    seoBody: route.seoBody ?? null,
  };
}

function catalogVehicleClassToView(
  vehicleClass: CatalogVehicleClass
): VehicleClassView {
  return {
    id: vehicleClass.id as string,
    slug: vehicleClass.slug,
    name: vehicleClass.name,
    description: vehicleClass.description ?? null,
    capacity: vehicleClass.capacity,
    luggageCapacity: vehicleClass.luggageCapacity ?? 2,
    priceMultiplier: (vehicleClass.priceMultiplier as string) ?? "1.00",
  };
}

/* ------------------------------------------------------------------- reads */

export async function listRoutes(
  options: { activeOnly?: boolean } = {}
): Promise<{ routes: RouteView[]; source: CatalogSource }> {
  const { activeOnly = true } = options;

  const fallback = () => ({
    routes: CATALOG_ROUTES.map(catalogRouteToView).filter(
      (route) => !activeOnly || route.isActive
    ),
    source: "fallback" as const,
  });

  if (!isDatabaseConfigured()) {
    noteFallback("DATABASE_URL is not set");
    return fallback();
  }

  try {
    const query = getDb().select().from(routes).orderBy(asc(routes.sortOrder));
    const rows = await (activeOnly
      ? query.where(eq(routes.isActive, true))
      : query);

    // An empty table means "not seeded yet", not "no routes exist".
    if (rows.length === 0) {
      noteFallback("the routes table is empty");
      return fallback();
    }

    return { routes: rows, source: "database" };
  } catch (error) {
    noteFallback(`the database is unreachable: ${describe(error)}`);
    return fallback();
  }
}

export async function getRouteBySlug(slug: string): Promise<RouteView | null> {
  const fallback = () => {
    const route = CATALOG_ROUTES_BY_SLUG.get(slug);
    return route ? catalogRouteToView(route) : null;
  };

  if (!isDatabaseConfigured()) {
    noteFallback("DATABASE_URL is not set");
    return fallback();
  }

  try {
    const [row] = await getDb()
      .select()
      .from(routes)
      .where(eq(routes.slug, slug))
      .limit(1);

    return row ?? fallback();
  } catch (error) {
    noteFallback(`the database is unreachable: ${describe(error)}`);
    return fallback();
  }
}

export async function listVehicleClasses(): Promise<VehicleClassView[]> {
  const fallback = () =>
    CATALOG_VEHICLE_CLASSES.map(catalogVehicleClassToView);

  if (!isDatabaseConfigured()) {
    return fallback();
  }

  try {
    const rows = await getDb()
      .select()
      .from(vehicleClasses)
      .where(eq(vehicleClasses.isActive, true))
      .orderBy(asc(vehicleClasses.sortOrder));

    return rows.length > 0 ? rows : fallback();
  } catch {
    return fallback();
  }
}

/* ----------------------------------------------------------------- pricing */

/**
 * The single source of truth for what a trip costs. Always call this on the
 * server: a price arriving from the client is an input to validate, never a
 * value to trust.
 *
 * The driver payout scales with the same multiplier as the fare, so our
 * contribution margin holds across vehicle classes.
 */
export function quoteFare(
  route: RouteView,
  vehicleClass: VehicleClassView
): FareQuote {
  const multiplier = Number(vehicleClass.priceMultiplier);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error(
      `Vehicle class ${vehicleClass.slug} has an invalid price multiplier`
    );
  }

  const customerPrice = roundToRand(Number(route.fixedPrice) * multiplier);
  const driverPayout = roundToRand(
    Number(route.defaultDriverPayout) * multiplier
  );

  return {
    routeId: route.id,
    vehicleClassId: vehicleClass.id,
    customerPrice: toMoneyString(customerPrice),
    driverPayout: toMoneyString(driverPayout),
    contribution: toMoneyString(customerPrice - driverPayout),
    currency: route.currency,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
  };
}

/** Fares are quoted in whole Namibian dollars — no stray cents in the UI. */
function roundToRand(amount: number): number {
  return Math.round(amount);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
