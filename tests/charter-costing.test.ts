import assert from "node:assert/strict";
import {
  calculateActualMargin,
  calculateCharterCost,
  suggestSellingPrice,
} from "../lib/charter/costing";
import { benchmarkRunningCost, charterRunningCostPerKm, defaultCharterProfile } from "../lib/charter/defaults";
import type { VehicleCostProfile } from "../lib/pricing/cost-model";

const cost = calculateCharterCost({
  passengerKm: 500,
  positioningKm: 60,
  localKm: 40,
  fuel: { fuelType: "diesel", litresPer100Km: 8, pricePerLitre: 27.96 },
  nonFuelRunningCostPerKm: 2.25,
  items: [
    { id: "driver", label: "Driver", quantity: 3, unitCost: 800, unit: "day" },
    { id: "bed", label: "Driver accommodation", quantity: 2, unitCost: 450, unit: "night" },
    { id: "fuel-included", label: "Supplier package fuel", quantity: 1, unitCost: 900, unit: "package", includedElsewhere: true },
  ],
});

assert.equal(cost.totalDrivenKm, 600);
assert.equal(cost.fuelLitres, 48);
assert.equal(cost.fuelCost, 1342.08);
assert.equal(cost.nonFuelRunningCost, 1350);
// Driver 2400 + bed 900; the supplier fuel package is excluded as included elsewhere.
assert.equal(cost.expectedCost, 1342.08 + 1350 + 2400 + 900);
assert.equal(cost.excludedIncludedElsewhere.length, 1);

const suggested = suggestSellingPrice({
  expectedCost: cost.expectedCost,
  targetContributionMargin: 0.25,
  paymentFeeRate: 0.048,
  priceStep: 50,
});
assert.ok(suggested.suggestedPrice >= cost.expectedCost / (1 - 0.25 - 0.048));
assert.ok(suggested.contributionMargin >= 0.25);
assert.equal(suggested.suggestedPrice % 50, 0);

const override = calculateActualMargin(8000, cost.expectedCost, 0.048);
assert.equal(override.paymentFee, 384);
assert.equal(override.contribution, 1623.92);
assert.ok(override.contributionMargin > 0);

assert.throws(
  () => suggestSellingPrice({ expectedCost: 1000, targetContributionMargin: 0.8, paymentFeeRate: 0.25 }),
  /must be less than 100%/,
);
assert.throws(
  () => calculateCharterCost({
    passengerKm: 1, positioningKm: 0, localKm: 0,
    fuel: { fuelType: "petrol", litresPer100Km: 0, pricePerLitre: 20 },
    nonFuelRunningCostPerKm: 1, items: [],
  }),
  /greater than zero litres per 100 km/,
);
assert.throws(
  () => calculateCharterCost({
    passengerKm: 1, positioningKm: 0, localKm: 0,
    fuel: { fuelType: "petrol", litresPer100Km: 8, pricePerLitre: 20 },
    nonFuelRunningCostPerKm: 1,
    items: [
      { id: "x", label: "X", quantity: 1, unitCost: 1, unit: "unit" },
      { id: "x", label: "Duplicate", quantity: 1, unitCost: 1, unit: "unit" },
    ],
  }),
  /unique, non-empty ID/,
);


// ---- defaults derived from the public fare model -------------------------
//
// The literal fallback this replaced ran a Fortuner at 6.4 L/100 km with
// N$0/km wear: N$1.73/km against the N$5.32/km the public fares charge the
// same class. A default must never run the vehicle for less than a transfer.
{
  const suvPublic: VehicleCostProfile = {
    slug: "suv-4x4",
    runningCost: { tar: 5.32, gravel: 7.21 },
    minimumDriverNeed: 637,
  };
  const suv = defaultCharterProfile({ slug: "suv-4x4", name: "SUV / 4x4" }, suvPublic);
  assert.equal(suv.fuelType, "diesel");
  assert.ok(suv.litresPer100Km >= 9, `an SUV default of ${suv.litresPer100Km} L/100 km is a sedan figure`);
  assert.ok(suv.nonFuelRunningCostPerKm > 0, "wear is never free");
  const bench = benchmarkRunningCost(suv, suvPublic);
  // Wear is rounded to the cent, so the total can sit a cent above the public figure — never below.
  assert.ok(bench.charterPerKm >= 5.32 && bench.charterPerKm <= 5.33, `default recovers ${bench.charterPerKm}/km against 5.32`);
  assert.equal(bench.belowPublic, false);

  // The old literal, benchmarked, is flagged.
  const old = benchmarkRunningCost(
    { fuelType: "diesel", litresPer100Km: 6.4, fuelPricePerLitre: 27, nonFuelRunningCostPerKm: 0 },
    suvPublic,
  );
  assert.equal(old.charterPerKm, 1.73);
  assert.equal(old.belowPublic, true);

  // A class without a named consumption still gets a non-zero, non-sedan default.
  const bus = defaultCharterProfile(
    { slug: "minibus", name: "Minibus" },
    { slug: "minibus", runningCost: { tar: 6, gravel: 8 }, minimumDriverNeed: 700 },
  );
  assert.ok(bus.litresPer100Km >= 10);
  assert.ok(charterRunningCostPerKm(bus) >= 6 && charterRunningCostPerKm(bus) <= 6.01);

  // Jen's itinerary, for the record: 1,477.6 km in the SUV.
  const jen = calculateCharterCost({
    passengerKm: 1477.6, positioningKm: 0, localKm: 0,
    fuel: { fuelType: suv.fuelType, litresPer100Km: suv.litresPer100Km, pricePerLitre: suv.fuelPricePerLitre },
    nonFuelRunningCostPerKm: suv.nonFuelRunningCostPerKm,
    items: [],
  });
  assert.ok(jen.fuelCost > 4000, `fuel for 1,478 km in a Fortuner is ${jen.fuelCost}, not two and a half thousand`);
  assert.ok(jen.fuelCost + jen.nonFuelRunningCost >= 1477.6 * 5.32 - 1);
}

console.log("Charter costing tests passed.");
