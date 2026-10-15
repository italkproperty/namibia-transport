/**
 * Deterministic charter operating-cost and selling-price calculations.
 *
 * This module is intentionally pure: no AI, database, network, or UI imports.
 * Both manual and AI-assisted quotes must eventually call the same calculation
 * service. Currency inputs are NAD amounts; monetary outputs are rounded to cents.
 */

export type FuelType = "diesel" | "petrol";

export type VehicleFuelProfile = {
  fuelType: FuelType;
  /** Litres consumed per 100 driven kilometres. */
  litresPer100Km: number;
  /** Price in NAD per litre, captured for this quote. */
  pricePerLitre: number;
};

export type CostLine = {
  id: string;
  label: string;
  /** Non-negative quantity. */
  quantity: number;
  /** Non-negative NAD rate for one unit. */
  unitCost: number;
  unit: string;
  /** True if this cost is already included in another all-inclusive rate. */
  includedElsewhere?: boolean;
};

export type CharterCostInput = {
  passengerKm: number;
  /** Empty/positioning distance not already included in passengerKm. */
  positioningKm: number;
  /** Local excursions and on-site driving not already included in passengerKm. */
  localKm: number;
  fuel: VehicleFuelProfile;
  /** Cost per km excluding fuel (tyres, servicing and depreciation). */
  nonFuelRunningCostPerKm: number;
  /** Explicit costs, such as driver days, lodging, park fees and supplier costs. */
  items: CostLine[];
};

export type CharterCostBreakdown = {
  passengerKm: number;
  positioningKm: number;
  localKm: number;
  totalDrivenKm: number;
  fuelType: FuelType;
  fuelLitres: number;
  fuelCost: number;
  nonFuelRunningCost: number;
  itemisedCosts: { id: string; label: string; amount: number; unit: string }[];
  excludedIncludedElsewhere: { id: string; label: string }[];
  expectedCost: number;
};

export type SellingPriceInput = {
  expectedCost: number;
  targetContributionMargin: number;
  paymentFeeRate?: number;
  priceStep?: number;
};

export type SellingPriceSuggestion = {
  suggestedPrice: number;
  paymentFee: number;
  contribution: number;
  contributionMargin: number;
};

/** Round currency to two decimals, avoiding visible binary-float tails. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function requireFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite, non-negative number.`);
  }
}

function requireRate(name: string, value: number, max = 1): void {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new Error(`${name} must be between 0 and ${max}.`);
  }
}

/**
 * Calculates expected operating cost. Each kilometre category must be mutually
 * exclusive: passenger, positioning, and local kilometres must not overlap.
 * Included-elsewhere lines are displayed for transparency but not double-counted.
 */
export function calculateCharterCost(input: CharterCostInput): CharterCostBreakdown {
  requireFiniteNonNegative("Passenger kilometres", input.passengerKm);
  requireFiniteNonNegative("Positioning kilometres", input.positioningKm);
  requireFiniteNonNegative("Local kilometres", input.localKm);
  requireFiniteNonNegative("Fuel consumption", input.fuel.litresPer100Km);
  requireFiniteNonNegative("Fuel price", input.fuel.pricePerLitre);
  requireFiniteNonNegative("Non-fuel running cost per kilometre", input.nonFuelRunningCostPerKm);

  if (!Number.isFinite(input.fuel.litresPer100Km) || input.fuel.litresPer100Km <= 0) {
    throw new Error("Fuel consumption must be greater than zero litres per 100 km.");
  }

  const totalDrivenKm = input.passengerKm + input.positioningKm + input.localKm;
  const fuelLitres = totalDrivenKm * input.fuel.litresPer100Km / 100;
  const fuelCost = roundMoney(fuelLitres * input.fuel.pricePerLitre);
  const nonFuelRunningCost = roundMoney(totalDrivenKm * input.nonFuelRunningCostPerKm);
  const itemisedCosts: CharterCostBreakdown["itemisedCosts"] = [];
  const excludedIncludedElsewhere: CharterCostBreakdown["excludedIncludedElsewhere"] = [];
  let additionalCosts = 0;
  const seenIds = new Set<string>();

  for (const item of input.items) {
    if (!item.id.trim() || seenIds.has(item.id)) {
      throw new Error("Every cost item must have a unique, non-empty ID.");
    }
    seenIds.add(item.id);
    requireFiniteNonNegative(`Quantity for ${item.label}`, item.quantity);
    requireFiniteNonNegative(`Unit cost for ${item.label}`, item.unitCost);
    if (item.includedElsewhere) {
      excludedIncludedElsewhere.push({ id: item.id, label: item.label });
      continue;
    }
    const amount = roundMoney(item.quantity * item.unitCost);
    additionalCosts += amount;
    itemisedCosts.push({ id: item.id, label: item.label, amount, unit: item.unit });
  }

  const expectedCost = roundMoney(fuelCost + nonFuelRunningCost + additionalCosts);
  return {
    passengerKm: input.passengerKm,
    positioningKm: input.positioningKm,
    localKm: input.localKm,
    totalDrivenKm,
    fuelType: input.fuel.fuelType,
    fuelLitres: Math.round(fuelLitres * 100) / 100,
    fuelCost,
    nonFuelRunningCost,
    itemisedCosts,
    excludedIncludedElsewhere,
    expectedCost,
  };
}

/**
 * Suggests a price that covers costs, the target contribution margin and
 * percentage-based payment fees. Margin is calculated against selling price.
 * It never silently clamps an impossible target.
 */
export function suggestSellingPrice(input: SellingPriceInput): SellingPriceSuggestion {
  requireFiniteNonNegative("Expected cost", input.expectedCost);
  requireRate("Target contribution margin", input.targetContributionMargin, 0.9);
  const paymentFeeRate = input.paymentFeeRate ?? 0;
  requireRate("Payment fee rate", paymentFeeRate, 0.3);
  const priceStep = input.priceStep ?? 1;
  if (!Number.isFinite(priceStep) || priceStep <= 0 || priceStep > 10000) {
    throw new Error("Price step must be greater than zero and no more than 10000.");
  }
  const availableShare = 1 - input.targetContributionMargin - paymentFeeRate;
  if (availableShare <= 0) {
    throw new Error("Target margin plus payment fee must be less than 100%.");
  }

  const rawPrice = input.expectedCost / availableShare;
  const suggestedPrice = roundMoney(Math.ceil((rawPrice - 1e-9) / priceStep) * priceStep);
  const paymentFee = roundMoney(suggestedPrice * paymentFeeRate);
  const contribution = roundMoney(suggestedPrice - input.expectedCost - paymentFee);
  return {
    suggestedPrice,
    paymentFee,
    contribution,
    contributionMargin: suggestedPrice > 0 ? contribution / suggestedPrice : 0,
  };
}

/** Calculate the actual economics after an operator overrides the price. */
export function calculateActualMargin(
  sellingPrice: number,
  expectedCost: number,
  paymentFeeRate = 0,
): { paymentFee: number; contribution: number; contributionMargin: number } {
  requireFiniteNonNegative("Selling price", sellingPrice);
  requireFiniteNonNegative("Expected cost", expectedCost);
  requireRate("Payment fee rate", paymentFeeRate, 0.3);
  const paymentFee = roundMoney(sellingPrice * paymentFeeRate);
  const contribution = roundMoney(sellingPrice - expectedCost - paymentFee);
  return {
    paymentFee,
    contribution,
    contributionMargin: sellingPrice > 0 ? contribution / sellingPrice : 0,
  };
}
