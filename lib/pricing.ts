import { toMoneyString } from "@/lib/money";
import type { FareQuote, RouteView, VehicleClassView } from "@/lib/maps/types";

/**
 * Pure fare maths, deliberately free of any server-only import so the client
 * price preview and the server action call the exact same function. If these
 * ever disagreed, a customer would be shown one price and charged another.
 *
 * The server still recomputes from the database on submit — this module makes
 * the two agree, it does not make the client's number trustworthy.
 */

/** Fares are quoted in whole Namibian dollars — no stray cents in the UI. */
function roundToRand(amount: number): number {
  return Math.round(amount);
}

export function computeFare(
  route: Pick<
    RouteView,
    "id" | "slug" | "fixedPrice" | "defaultDriverPayout" | "currency" | "distanceKm" | "durationMin"
  >,
  vehicleClass: Pick<VehicleClassView, "id" | "slug" | "priceMultiplier">
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
