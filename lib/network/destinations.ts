import { modelJourney, type Journey } from "@/lib/network/journey";
import { LEG_DESTINATIONS } from "@/lib/network/legs";
import { findNode, nodeLabel, type PlaceNode } from "@/lib/network/nodes";
import { GATE_RULES, type GateRule } from "@/lib/parks/gates";

/**
 * One page per place people are actually going.
 *
 * The leg pages answer a pair — "Swakopmund to Sossusvlei" — which is the
 * right answer for someone who already knows where they are leaving from. It
 * is the wrong shape for the more common question, typed far more often:
 * *I am going to Sossusvlei. How do I get there and what does it cost?*
 *
 * That reader does not have a pair yet. They have a destination, a landing
 * date and a lodge booking, and every operator answers them with a contact
 * form. We can answer with the roads, the surface, an honest driving time,
 * the gate deadline, and a fixed price from each gateway — computed, so the
 * page cannot drift from the model that prices the trip, and not copyable by
 * anyone without the model.
 *
 * ## Which places get one
 *
 * The same hand-kept list the leg pages use. It is the judgement of which
 * places a traveller builds an itinerary around, as opposed to the junctions
 * and supply towns the road happens to pass through, and it stays a written
 * list rather than a derived score for the reason set out in `legs.ts`.
 *
 * Airports are excluded: nobody plans a trip *to* Hosea Kutako. It is where
 * the trip starts, which is why it leads the gateways below.
 *
 * ## Lodges
 *
 * Most travellers are going to a property, not a town — and we deliberately
 * do not hold a database of lodges with invented distances and amenities. We
 * are a transport company; what we can state about somebody else's lodge is
 * how far it is past the town we price to, and we only know that when the
 * operator tells us. So the page prices to the place, names the anchor, and
 * asks for the lodge rather than guessing at it.
 */

/**
 * Where a trip to anywhere in Namibia realistically begins: the international
 * airport first, then the two cities with enough cars that a driver finishing
 * there is effectively home, then the coast's second airport.
 *
 * Ordered, not sorted — this is the order a traveller considers them in, and
 * the airport is almost always the answer.
 */
const GATEWAYS = [
  "hosea-kutako",
  "windhoek",
  "swakopmund",
  "walvis-bay",
] as const;

export type Arrival = {
  from: PlaceNode;
  journey: Journey;
  /** The fare in the other direction, which is rarely the same number. */
  outbound: Journey | null;
};

export type Destination = {
  slug: string;
  node: PlaceNode;
  /** Priced approaches from the gateways, nearest first. */
  arrivals: Arrival[];
  /** Set where the destination sits behind a park gate that shuts at dusk. */
  gate: GateRule | null;
};

function buildDestination(slug: string): Destination | null {
  const node = findNode(slug);
  if (!node || node.isAirport) return null;

  const arrivals: Arrival[] = [];
  for (const gateway of GATEWAYS) {
    if (gateway === slug) continue;

    const journey = modelJourney(gateway, slug);
    if (!journey) continue;

    const from = findNode(gateway);
    if (!from) continue;

    arrivals.push({ from, journey, outbound: modelJourney(slug, gateway) });
  }

  if (arrivals.length === 0) return null;

  // Nearest first: the gateway a traveller is most likely to come from is
  // usually the closest one, and a list that opens with the longest drive
  // reads as though we are quoting the worst case.
  arrivals.sort((a, b) => a.journey.road.minutes - b.journey.road.minutes);

  return { slug, node, arrivals, gate: GATE_RULES[slug] ?? null };
}

function buildDestinations(): Destination[] {
  return LEG_DESTINATIONS.map(buildDestination)
    .filter((d): d is Destination => d !== null)
    .sort((a, b) => nodeLabel(a.node).localeCompare(nodeLabel(b.node)));
}

export const DESTINATIONS: Destination[] = buildDestinations();

export const DESTINATIONS_BY_SLUG = new Map(
  DESTINATIONS.map((d) => [d.slug, d]),
);

export function findDestination(slug: string): Destination | null {
  return DESTINATIONS_BY_SLUG.get(slug) ?? null;
}

/**
 * The cheapest way in, which is not always the nearest: a gateway with a
 * better backhaul can undercut a shorter drive from a place cars leave empty.
 */
export function bestValueArrival(destination: Destination): Arrival {
  return destination.arrivals.reduce((best, arrival) =>
    Number(arrival.journey.route.fixedPrice) <
    Number(best.journey.route.fixedPrice)
      ? arrival
      : best,
  );
}
