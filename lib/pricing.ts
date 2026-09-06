import { toMoneyString } from "@/lib/money";
import type { FareQuote, RouteView, VehicleClassView } from "@/lib/maps/types";

/**
 * Pure fare maths, deliberately free of any server-only import so the client
 * price preview and the server action call the exact same function. If these
 * ever disagreed, a customer would be shown one price and charged another.
 *
 * Every private transfer prices per vehicle: fixed_price buys the whole car
 * for the base class, and the vehicle-class multiplier scales it. Passenger
 * count is not an input to the fare — nothing in the cost base scales with
 * it (not fuel, not driver hours, not the empty return), and our own fare
 * model derives the airport run's N$650 per vehicle from the minimum
 * call-out. Party size matters only to which vehicle class is eligible,
 * which is `lib/booking/eligibility.ts`'s job.
 *
 * The per_person pricing unit survives in the type for one future product —
 * a scheduled shared shuttle, where unrelated travellers pool a vehicle.
 * Until that product exists, no route may carry it: the seed and the tests
 * reject it, and at runtime it prices as per-vehicle rather than collapsing
 * a render.
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

/** The price shown next to a class — same as the total, since a fare buys the vehicle. */
export function unitFare(
  route: Pick<RouteView, "fixedPrice">,
  vehicleClass: Pick<VehicleClassView, "priceMultiplier">
): number {
  return roundToRand(
    Number(route.fixedPrice) * Number(vehicleClass.priceMultiplier)
  );
}

/**
 * The label that must accompany every price. Always "per vehicle" — the one
 * legitimate per-person product (a scheduled shared shuttle) does not exist
 * yet, and until it does no surface may say "per person" next to a fare.
 */
// The route stays in the signature so the shared-shuttle future is a
// one-line change at every call site rather than a refactor.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function pricingUnitLabel(_route: Pick<RouteView, "pricingUnit">): string {
  return "per vehicle";
}
