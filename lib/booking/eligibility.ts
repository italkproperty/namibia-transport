import type { VehicleClassView } from "@/lib/maps/types";

/**
 * Which vehicle can actually carry the party.
 *
 * Passenger count and luggage never touch the fare — they decide only which
 * class is eligible, and the class multiplier does the pricing. The binding
 * constraint is the GREATER of the two: a family of three off a long-haul
 * flight has three large cases, and a sedan that seats them but cannot take
 * their luggage is the worst failure an airport transfer can produce.
 *
 * Capacities are honest, not optimistic: the sedan carries 3 passengers and
 * 2 large cases, and advertising more would be discovered at the kerb.
 */

export function classFits(
  vehicleClass: Pick<VehicleClassView, "capacity" | "luggageCapacity">,
  passengers: number,
  luggage: number
): boolean {
  return (
    passengers <= vehicleClass.capacity &&
    luggage <= vehicleClass.luggageCapacity
  );
}

/**
 * The cheapest class that fits, or null when nothing does — in which case no
 * price may be shown and the party is routed to the enquiry form instead of
 * being silently sold a vehicle that cannot carry them.
 */
export function smallestFittingClass<
  T extends Pick<VehicleClassView, "capacity" | "luggageCapacity" | "priceMultiplier">,
>(vehicleClasses: T[], passengers: number, luggage: number): T | null {
  const fitting = vehicleClasses.filter((c) =>
    classFits(c, passengers, luggage)
  );
  if (fitting.length === 0) return null;
  return fitting.reduce((a, b) =>
    Number(a.priceMultiplier) <= Number(b.priceMultiplier) ? a : b
  );
}
