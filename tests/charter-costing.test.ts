import assert from "node:assert/strict";
import {
  calculateActualMargin,
  calculateCharterCost,
  suggestSellingPrice,
} from "../lib/charter/costing";

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
assert.equal(cost.expectedCost, 1342.08 + 1350 + 2400);
assert.equal(cost.excludedIncludedElsewhere.length, 1);

const suggested = suggestSellingPrice({
  expectedCost: cost.expectedCost,
  targetContributionMargin: 0.25,
  paymentFeeRate: 0.048,
  priceStep: 50,
});
assert.ok(suggested.suggestedPrice >= 5992.08 / (1 - 0.25 - 0.048));
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

console.log("Charter costing tests passed.");
