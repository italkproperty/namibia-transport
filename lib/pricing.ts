import { toMoneyString } from "@/lib/money";
import type { FareQuote, RouteView, VehicleClassView } from "@/lib/maps/types";

/**
 * Pure fare maths, deliberately free of any server-only import so the client
 * price preview and the server action call the exact same function. If these
 * ever disagreed, a customer would be shown one price and charged another.
 *
 * Two pricing units exist:
 *   per_person  — airport transfers: fixed_price buys one seat, so the fare
 *                 scales with the party size (N$650/person into Windhoek).
 *   per_vehicle — long-distance private transfers: fixed_price buys the whole
 *                 car, whatever the party size.
 * The vehicle-class multiplier applies to the unit price in both cases.
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
    | "id"
    | "slug"
    | "fixedPrice"
    | "pricingUnit"
    | "defaultDriverPayout"
    | "currency"
    | "distanceKm"
    | "durationMin"
  >,
  vehicleClass: Pick<VehicleClassView, "id" | "slug" | "priceMultiplier">,
  passengers = 1
): FareQuote {
  const multiplier = Number(vehicleClass.priceMultiplier);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error(
      `Vehicle class ${vehicleClass.slug} has an invalid price multiplier`
    );
  }

  const seats =
    route.pricingUnit === "per_person" ? Math.max(1, Math.floor(passengers)) : 1;

  const unitPrice = roundToRand(Number(route.fixedPrice) * multiplier);
  const unitPayout = roundToRand(
    Number(route.defaultDriverPayout) * multiplier
  );

  const customerPrice = unitPrice * seats;
  const driverPayout = unitPayout * seats;

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

/** The per-unit price shown next to a class, before party size is applied. */
export function unitFare(
  route: Pick<RouteView, "fixedPrice">,
  vehicleClass: Pick<VehicleClassView, "priceMultiplier">
): number {
  return roundToRand(
    Number(route.fixedPrice) * Number(vehicleClass.priceMultiplier)
  );
}

/** "per person" | "per vehicle" — the label that must accompany every price. */
export function pricingUnitLabel(route: Pick<RouteView, "pricingUnit">): string {
  return route.pricingUnit === "per_person" ? "per person" : "per vehicle";
}
