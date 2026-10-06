import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";
import { pricingRules, routes, vehicleClasses } from "@/db/schema";
import {
  CATALOG_ROUTES,
  CATALOG_ROUTES_BY_SLUG,
  CATALOG_VEHICLE_CLASSES,
} from "@/lib/catalog";

import type { CatalogSource, RouteView, VehicleClassView } from "./types";

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
    pricingUnit: route.pricingUnit ?? "per_vehicle",
    defaultDriverPayout: route.defaultDriverPayout as string,
    currency: route.currency ?? "NAD",
    isActive: route.isActive ?? false,
    distanceKm: (route.distanceKm as string | undefined) ?? null,
    durationMin: route.durationMin ?? null,
    seoTitle: route.seoTitle ?? null,
    seoDescription: route.seoDescription ?? null,
    seoBody: route.seoBody ?? null,
    originLat: route.originLat ?? null,
    originLng: route.originLng ?? null,
    destinationLat: route.destinationLat ?? null,
    destinationLng: route.destinationLng ?? null,
    routeGeometry: null,
    vehiclePrices: {},
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

/** Apply active route/class multiplier rules to the route view. */
function applyVehiclePriceRules(
  route: RouteView,
  rules: Array<typeof pricingRules.$inferSelect>,
): RouteView {
  const vehiclePrices = { ...route.vehiclePrices };
  for (const rule of rules) {
    if (!rule.vehicleClassId || rule.ruleType !== "multiplier") continue;
    if (vehiclePrices[rule.vehicleClassId]) continue;
    const multiplier = Number(rule.amount);
    if (!Number.isFinite(multiplier) || multiplier <= 0) continue;
    vehiclePrices[rule.vehicleClassId] = {
      customerPrice: String(Math.round(Number(route.fixedPrice) * multiplier)),
      driverPayout: String(Math.round(Number(route.defaultDriverPayout) * multiplier)),
    };
  }
  return { ...route, vehiclePrices };
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
    let query = getDb()
      .select({ route: routes, rule: pricingRules })
      .from(routes)
      .leftJoin(
        pricingRules,
        and(
          eq(pricingRules.routeId, routes.id),
          eq(pricingRules.ruleType, "multiplier"),
          eq(pricingRules.isActive, true),
        ),
      )
      .orderBy(
        asc(routes.sortOrder),
        desc(pricingRules.priority),
        desc(pricingRules.updatedAt),
      );

    if (activeOnly) query = query.where(eq(routes.isActive, true));

    const rows = await withDeadline("route catalogue", READ_DEADLINE_MS, () => query);

    // An empty table means "not seeded yet", not "no routes exist".
    if (rows.length === 0) {
      noteFallback("the routes table is empty");
      return fallback();
    }

    const byRoute = new Map<string, RouteView>();
    for (const row of rows) {
      const base = byRoute.get(row.route.id) ?? {
        ...row.route,
        vehiclePrices: {},
      } as RouteView;
      byRoute.set(
        row.route.id,
        row.rule
          ? applyVehiclePriceRules(base, [row.rule])
          : base,
      );
    }

    return { routes: [...byRoute.values()], source: "database" };
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
    const [row] = await withDeadline("route lookup", READ_DEADLINE_MS, () =>
      getDb()
        .select({ route: routes, rule: pricingRules })
        .from(routes)
        .leftJoin(
          pricingRules,
          and(
            eq(pricingRules.routeId, routes.id),
            eq(pricingRules.ruleType, "multiplier"),
            eq(pricingRules.isActive, true),
          ),
        )
        .where(eq(routes.slug, slug))
        .orderBy(desc(pricingRules.priority), desc(pricingRules.updatedAt))
        .limit(1),
    );

    return row
      ? applyVehiclePriceRules({ ...row.route, vehiclePrices: {} }, row.rule ? [row.rule] : [])
      : fallback();
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
    const rows = await withDeadline("vehicle catalogue", READ_DEADLINE_MS, () =>
      getDb()
        .select()
        .from(vehicleClasses)
        .where(eq(vehicleClasses.isActive, true))
        .orderBy(asc(vehicleClasses.sortOrder)),
    );

    return rows.length > 0 ? rows : fallback();
  } catch {
    return fallback();
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
