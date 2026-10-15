import {
  calculateActualMargin,
  calculateCharterCost,
  suggestSellingPrice,
  type CharterCostInput,
  type CharterCostBreakdown,
  type SellingPriceInput,
  type SellingPriceSuggestion,
} from "./costing";
import type { VerifiedItineraryRoute } from "@/lib/maps/charter-routing";

/**
 * Joins verified road-routing evidence to the deterministic commercial cost
 * model. This is the shared server-side boundary for manual and AI-generated
 * charter requirements; AI is not allowed to calculate prices.
 *
 * The route's driven legs are passenger kilometres. Empty positioning and
 * local driving are separate inputs and must not overlap those route legs.
 */
export type CharterItineraryCostRequest = {
  route: VerifiedItineraryRoute;
  positioningKm: number;
  localKm: number;
  fuel: CharterCostInput["fuel"];
  nonFuelRunningCostPerKm: number;
  items: CharterCostInput["items"];
  targetContributionMargin: number;
  paymentFeeRate: number;
  priceStep?: number;
  /** Optional operator-entered final fare. Never replaces the model result. */
  sellingPriceOverride?: number;
};

export type CharterItineraryCostResult = {
  route: {
    provider: "mapbox";
    retrievedAt: string;
    totalDistanceKm: number;
    totalDurationMinutes: number;
    legCount: number;
  };
  costs: CharterCostBreakdown;
  suggested: SellingPriceSuggestion;
  finalPrice: number;
  override: {
    applied: boolean;
    amount: number | null;
    deltaFromSuggested: number | null;
    reasonRequired: boolean;
  };
  actual: ReturnType<typeof calculateActualMargin>;
  belowTargetMargin: boolean;
};

/** Validate that the route evidence is internally usable before pricing it. */
function validateRoute(route: VerifiedItineraryRoute): void {
  if (route.provider !== "mapbox" || !route.retrievedAt || !Number.isFinite(Date.parse(route.retrievedAt))) {
    throw new Error("A verified Mapbox route with a retrieval timestamp is required.");
  }
  if (
    !Number.isFinite(route.totalDistanceKm) ||
    route.totalDistanceKm <= 0 ||
    !Number.isFinite(route.totalDurationMinutes) ||
    route.totalDurationMinutes <= 0 ||
    route.legs.length < 1
  ) {
    throw new Error("The route must contain positive distance, duration and at least one leg.");
  }
  if (route.legs.some((leg, index) =>
    leg.fromIndex !== index ||
    leg.toIndex !== index + 1 ||
    !Number.isFinite(leg.distanceKm) ||
    leg.distanceKm <= 0 ||
    !Number.isFinite(leg.durationMinutes) ||
    leg.durationMinutes <= 0
  )) {
    throw new Error("Every route leg must have sequential indexes and positive road distance and duration.");
  }
  if (Math.abs(route.legs.reduce((sum, leg) => sum + leg.distanceKm, 0) - route.totalDistanceKm) > Math.max(1, route.totalDistanceKm * 0.03)) {
    // Mapbox totals can differ slightly from rounded leg values, but not materially.
    throw new Error("The route total materially differs from the sum of its road legs.");
  }
}

/**
 * Produces one auditable cost and selling-price result from real route evidence.
 * The caller must persist the inputs/result as a quote snapshot before sending
 * a customer-facing offer.
 */
export function priceCharterItinerary(
  request: CharterItineraryCostRequest,
): CharterItineraryCostResult {
  validateRoute(request.route);
  const costs = calculateCharterCost({
    passengerKm: request.route.totalDistanceKm,
    positioningKm: request.positioningKm,
    localKm: request.localKm,
    fuel: request.fuel,
    nonFuelRunningCostPerKm: request.nonFuelRunningCostPerKm,
    items: request.items,
  });
  const commercialInput: SellingPriceInput = {
    expectedCost: costs.expectedCost,
    targetContributionMargin: request.targetContributionMargin,
    paymentFeeRate: request.paymentFeeRate,
    priceStep: request.priceStep,
  };
  const suggested = suggestSellingPrice(commercialInput);
  const hasOverride = request.sellingPriceOverride !== undefined;
  const finalPrice = hasOverride ? request.sellingPriceOverride! : suggested.suggestedPrice;
  if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
    throw new Error("An operator price override must be a finite amount greater than zero.");
  }
  const actual = calculateActualMargin(finalPrice, costs.expectedCost, request.paymentFeeRate);
  const delta = hasOverride ? Math.round((finalPrice - suggested.suggestedPrice) * 100) / 100 : null;

  return {
    route: {
      provider: request.route.provider,
      retrievedAt: request.route.retrievedAt,
      totalDistanceKm: request.route.totalDistanceKm,
      totalDurationMinutes: request.route.totalDurationMinutes,
      legCount: request.route.legs.length,
    },
    costs,
    suggested,
    finalPrice,
    override: {
      applied: hasOverride,
      amount: hasOverride ? finalPrice : null,
      deltaFromSuggested: delta,
      reasonRequired: hasOverride && Math.abs(delta ?? 0) > 0,
    },
    actual,
    belowTargetMargin: actual.contributionMargin + 1e-9 < request.targetContributionMargin,
  };
}
