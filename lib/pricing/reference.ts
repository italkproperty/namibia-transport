import { findRoad } from "@/lib/network/roads";
import { modelCost, type PricingConstants, type VehicleCostProfile } from "./cost-model";

/**
 * What a pair costs in every vehicle class, for the operator's reference panel.
 *
 * Lives here rather than inside the component for one reason: a figure an
 * operator quotes from has to be checkable, and logic inside a `useMemo` can
 * only be checked by driving a browser. This is the function the panel calls,
 * and `tests/quote-reference.test.ts` calls the same one.
 *
 * Client-safe on purpose — no server-only import anywhere in the chain — so
 * the panel recomputes as the operator changes the pair without a round trip.
 * It is a reference shown to staff behind the admin gate; the fare that
 * reaches a booking is still typed into the form and re-read server-side.
 */

export type ClassProfile = {
  id: string;
  name: string;
  profile: VehicleCostProfile;
  costed: boolean;
};

export type ReferenceRow = ClassProfile & {
  outbound: number;
  inbound: number;
  total: number;
};

export type ReferenceQuote = {
  km: number;
  gravelKm: number;
  hours: number;
  nights: number;
  rows: ReferenceRow[];
};

export function referenceQuote(
  from: string | null,
  to: string | null,
  returning: boolean,
  classes: ClassProfile[],
  constants: PricingConstants,
): ReferenceQuote | null {
  if (!from || !to || from === to || classes.length === 0) return null;

  const out = findRoad(from, to);
  /**
   * The return is priced as its own leg, never as a doubling. The backhaul is
   * directional: a car running out to the desert comes back empty, while the
   * same car returning to Windhoek is going home and earning again within the
   * hour. On Hosea Kutako to Sossusvlei that is N$7,250 out against N$3,850
   * back — doubling the outbound would quote N$14,500 for an N$11,100 trip
   * and lose the job.
   */
  const back = returning ? findRoad(to, from) : null;
  if (!out || (returning && !back)) return null;

  return {
    km: out.km,
    gravelKm: out.gravelKm,
    hours: out.minutes / 60,
    nights: modelCost(out, classes[0].profile, constants).nights,
    rows: classes.map((vehicleClass) => {
      const outbound = modelCost(out, vehicleClass.profile, constants).price;
      const inbound = back
        ? modelCost(back, vehicleClass.profile, constants).price
        : 0;
      return { ...vehicleClass, outbound, inbound, total: outbound + inbound };
    }),
  };
}
