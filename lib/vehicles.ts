import type { VehicleArtKind } from "@/components/vehicles/vehicle-art";

/**
 * What a traveller is actually getting into, described by class.
 *
 * Researched against what is genuinely on Namibian roads rather than a generic
 * "economy / business / luxury" ladder copied from a European transfer site:
 *
 *  · Toyota sold 10,171 units in Namibia in 2024 — more than every other brand
 *    combined — led by the Hilux, Fortuner and Corolla Cross. Volkswagen was
 *    second on roughly 1,200, led by the Polo Vivo. (thebrief.com.na, Jan 2025)
 *  · Namibian shuttle operators run the Toyota Quantum 14-seater as the group
 *    vehicle almost universally — Ashley Shuttles and Welwitschia Shuttles both
 *    describe their minibus fleet that way.
 *  · The Fortuner and the Hilux double cab are the transfer 4x4s, which is why
 *    the gravel routes to Sossusvlei and Etosha are quoted on that class.
 *
 * The models named here describe the *segment*, not our stock. We do not own
 * cars, so a card that showed a specific vehicle would be a fleet claim we
 * cannot make. What we can say, and do, is that the exact vehicle and its
 * registration reach you before pickup.
 */

export type VehicleSpec = {
  /** Matches vehicle_classes.slug, so the database stays authoritative. */
  slug: string;
  art: VehicleArtKind;
  /** What is typically driven in this segment in Namibia. */
  typicalModels: string;
  /** One line on who this class is the right answer for. */
  bestFor: string;
  /** Concrete, checkable facts — never adjectives. */
  points: string[];
  /**
   * A photograph of a real partner vehicle, once one exists — a path under
   * public/vehicles/. Setting it retires the drawing for that class with no
   * other change. Deliberately not a manufacturer press shot: that is someone
   * else's copyright and implies a fleet we do not own.
   */
  photo?: string;
  photoCredit?: string;
};

export const VEHICLE_SPECS: Record<string, VehicleSpec> = {
  "private-sedan": {
    slug: "private-sedan",
    art: "sedan",
    typicalModels: "VW Polo Vivo, Toyota Corolla or Corolla Quest",
    bestFor: "Couples, solo travellers and business trips on tarred routes.",
    points: [
      "Air-conditioned, and the whole car is yours — no shared seats",
      "Three passengers and three bags is the working limit, not a squeeze",
      "Right for the B6 airport run and any tarred intercity leg",
    ],
  },
  "suv-4x4": {
    slug: "suv-4x4",
    art: "suv",
    typicalModels: "Toyota Fortuner or Hilux double cab",
    bestFor: "Families, camera gear, and anything that leaves the tar.",
    points: [
      "Higher clearance for gravel — the D-roads to Sesriem and Etosha",
      "Room for oversized bags, tripods and cool boxes",
      "The class we quote for Sossusvlei, because a small car should not do it",
    ],
  },
};

/**
 * Vehicles we can put on a trip but do not yet sell online.
 *
 * The Quantum is the standard Namibian group vehicle, and a party of ten
 * landing at Hosea Kutako is a booking we currently cannot take. Listing it
 * with an honest "we quote this by hand" is better than a silent maximum of
 * five seats — but it is deliberately not a bookable card, because a price we
 * have not set is not a price.
 */
export const ENQUIRY_ONLY_VEHICLES: (VehicleSpec & {
  name: string;
  capacity: string;
})[] = [
  {
    slug: "minibus",
    name: "Minibus",
    capacity: "6–13 passengers",
    art: "van",
    typicalModels: "Toyota Quantum 14-seater",
    bestFor: "Tour groups, extended families and conference arrivals.",
    points: [
      "The vehicle Namibian operators use for groups, near-universally",
      "Sliding door and a full-height cabin — easier with children",
      "Not on the booking form yet: send us the trip and we price it by hand",
    ],
  },
];

export function specFor(slug: string): VehicleSpec | undefined {
  return VEHICLE_SPECS[slug];
}
