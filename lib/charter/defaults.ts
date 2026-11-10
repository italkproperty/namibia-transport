import type { VehicleCostProfile } from "@/lib/pricing/cost-model";

/**
 * What a charter costs to run per kilometre when no profile has been saved.
 *
 * ## Why this is derived and not typed
 *
 * The first fallback was a literal: 6.4 L/100 km, N$27 a litre, N$0 a
 * kilometre for everything that is not fuel. It priced Jen's six-stop
 * Sossusvlei–Etosha itinerary — 1,478 km in a Fortuner, much of it gravel —
 * at N$2,553 of fuel and nothing for tyres, servicing or depreciation. The
 * public fare model charges the same class N$5.32/km on tar and N$7.21/km on
 * gravel for fuel *and* wear together, so the charter was recovering about a
 * third of what the public pages assume the vehicle costs to move. The
 * operator saw N$2,553 and knew it was wrong before anyone traced why.
 *
 * So the default is now built from the public model's running cost for the
 * class: a realistic consumption for the vehicle sets the fuel share, and
 * whatever is left of the public per-kilometre figure is the wear share. A
 * charter can no longer run the vehicle for less than a transfer does, and
 * the figure the public pages are built on is the one the charter inherits.
 *
 * ## Consumption
 *
 * Blended figures for the roads these itineraries actually use. A Fortuner
 * 2.8 or Hilux double cab holds 8.5–9.5 L/100 km at highway speed on tar and
 * 11–13 on gravel and corrugation with a load; itineraries that leave the tar
 * — Sossusvlei, Damaraland, the Etosha interior — sit around 10.5. A sedan on
 * the same mix is near 8. These are operating assumptions, not measurements
 * from our own fleet, which is why the planner says so until a profile is
 * saved with the real numbers.
 */
export const DEFAULT_FUEL_PRICE_PER_LITRE = 27;

type Consumption = { fuelType: "diesel" | "petrol"; litresPer100Km: number };

const CONSUMPTION_BY_CLASS: Record<string, Consumption> = {
  "private-sedan": { fuelType: "petrol", litresPer100Km: 8 },
  "suv-4x4": { fuelType: "diesel", litresPer100Km: 10.5 },
};

/** A class we have not named: assume a diesel people-carrier. */
const CONSUMPTION_UNKNOWN: Consumption = { fuelType: "diesel", litresPer100Km: 12 };

export type CharterRunningProfile = {
  fuelType: "diesel" | "petrol";
  litresPer100Km: number;
  fuelPricePerLitre: number;
  nonFuelRunningCostPerKm: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Fuel plus wear, per kilometre. */
export function charterRunningCostPerKm(profile: CharterRunningProfile): number {
  return round2((profile.litresPer100Km / 100) * profile.fuelPricePerLitre + profile.nonFuelRunningCostPerKm);
}

export function defaultCharterProfile(
  vehicle: { slug: string; name: string },
  publicProfile: VehicleCostProfile,
  fuelPricePerLitre = DEFAULT_FUEL_PRICE_PER_LITRE,
): CharterRunningProfile {
  const consumption =
    CONSUMPTION_BY_CLASS[vehicle.slug] ??
    (/suv|4x4/i.test(vehicle.name) ? CONSUMPTION_BY_CLASS["suv-4x4"] : CONSUMPTION_UNKNOWN);
  const fuelPerKm = (consumption.litresPer100Km / 100) * fuelPricePerLitre;
  // The tar figure is the floor: a charter never knows how much of its route
  // is gravel, and the benchmark below shows the operator both numbers.
  const wear = Math.max(0, publicProfile.runningCost.tar - fuelPerKm);
  return {
    fuelType: consumption.fuelType,
    litresPer100Km: consumption.litresPer100Km,
    fuelPricePerLitre,
    nonFuelRunningCostPerKm: round2(wear),
  };
}

export type RunningCostBenchmark = {
  /** What this charter charges per driven kilometre, fuel and wear. */
  charterPerKm: number;
  /** What the public fare model charges the same class per kilometre. */
  publicTarPerKm: number;
  publicGravelPerKm: number;
  /** True when the charter recovers less per kilometre than a tar transfer. */
  belowPublic: boolean;
};

export function benchmarkRunningCost(
  profile: CharterRunningProfile,
  publicProfile: VehicleCostProfile,
): RunningCostBenchmark {
  const charterPerKm = charterRunningCostPerKm(profile);
  const publicTarPerKm = round2(publicProfile.runningCost.tar);
  return {
    charterPerKm,
    publicTarPerKm,
    publicGravelPerKm: round2(publicProfile.runningCost.gravel),
    belowPublic: charterPerKm + 0.005 < publicTarPerKm,
  };
}
