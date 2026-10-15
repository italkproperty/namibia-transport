import assert from "node:assert/strict";
import { priceCharterItinerary } from "../lib/charter/itinerary-costing";
import type { VerifiedItineraryRoute } from "../lib/maps/charter-routing";

const route: VerifiedItineraryRoute = {
  provider: "mapbox",
  retrievedAt: "2026-10-15T10:00:00.000Z",
  totalDistanceKm: 300,
  totalDurationMinutes: 240,
  geometry: "encoded",
  legs: [
    { fromIndex: 0, toIndex: 1, distanceKm: 100, durationMinutes: 80, geometry: null },
    { fromIndex: 1, toIndex: 2, distanceKm: 200, durationMinutes: 160, geometry: null },
  ],
  snappedWaypoints: [
    { lat: -22.56, lng: 17.06 },
    { lat: -23.3, lng: 15.9 },
    { lat: -24.6, lng: 15.8 },
  ],
};

const base = {
  route,
  positioningKm: 40,
  localKm: 10,
  fuel: { fuelType: "diesel" as const, litresPer100Km: 8, pricePerLitre: 27.96 },
  nonFuelRunningCostPerKm: 2,
  items: [{ id: "driver", label: "Driver days", quantity: 2, unitCost: 750, unit: "day" }],
  targetContributionMargin: 0.25,
  paymentFeeRate: 0.048,
  priceStep: 50,
};

const result = priceCharterItinerary(base);
assert.equal(result.costs.passengerKm, 300);
assert.equal(result.costs.positioningKm, 40);
assert.equal(result.costs.localKm, 10);
assert.equal(result.costs.totalDrivenKm, 350);
assert.equal(result.route.legCount, 2);
assert.equal(result.finalPrice, result.suggested.suggestedPrice);
assert.equal(result.override.applied, false);
assert.ok(result.actual.contributionMargin >= 0.25);
assert.equal(result.belowTargetMargin, false);

const overridden = priceCharterItinerary({ ...base, sellingPriceOverride: 2500 });
assert.equal(overridden.finalPrice, 2500);
assert.equal(overridden.override.applied, true);
assert.equal(overridden.override.reasonRequired, overridden.override.deltaFromSuggested !== 0);
assert.equal(overridden.actual.paymentFee, 120);
assert.equal(overridden.belowTargetMargin, overridden.actual.contributionMargin < 0.25);

assert.throws(
  () => priceCharterItinerary({ ...base, route: { ...route, totalDistanceKm: 500 } }),
  /materially differs/,
);
assert.throws(
  () => priceCharterItinerary({ ...base, positioningKm: -1 }),
  /finite, non-negative/,
);

console.log("Charter itinerary costing tests passed.");
