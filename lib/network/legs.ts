import { CATALOG_ROUTES } from "@/lib/catalog";
import { findNode, type PlaceNode } from "@/lib/network/nodes";
import {
  modelJourney,
  nodePairForRoute,
  parseJourneySlug,
} from "@/lib/network/journey";

/**
 * The legs worth a page of their own.
 *
 * `/journey` deliberately collapses every pair into one URL, on the reasoning
 * that 2,352 generated pages is how a site earns a thin-content penalty. That
 * reasoning is still correct about 2,352. It is wrong as a permanent ceiling,
 * because it assumed a pair page would be a template with two nouns swapped —
 * and ours is not. Each leg below carries its own roads, its own tar-and-gravel
 * split, its own honest driving time, its own rain closures, its own park-gate
 * deadline and its own fixed price. Those are different facts, not different
 * nouns, and a page made of them is the best answer on the internet to a
 * question thousands of people type.
 *
 * Three filters keep the set honest, and every one of them exists to stop a
 * page being published that nobody searches for:
 *
 *   1. Both ends must be places a traveller builds an itinerary around. Most
 *      of the network is junctions and supply towns — real roads, but nobody
 *      plans "Karibib to Otavi".
 *   2. The leg must be drivable in a day. "Epupa to Lüderitz" is a pair the
 *      graph can answer and no human has ever asked about.
 *   3. It must not already have a curated transfer page, or the two compete
 *      with each other for the same query and both lose.
 *
 * The first filter is editorial, not computed, and is deliberately written out
 * by hand rather than dressed up as a derived score. `backhaul` looks like it
 * would serve — it is already a measure of how busy a place is — but it
 * measures return *fares*, and Sossusvlei has almost none while being one of
 * the most searched destinations in the country. Encoding a judgement as
 * arithmetic that does not support it would be worse than admitting it is a
 * judgement.
 */

/**
 * Places people plan a trip around, as opposed to places the road goes
 * through. Add to this when a destination genuinely draws visitors; the
 * pages follow automatically.
 */
export const LEG_DESTINATIONS: string[] = [
  // The hubs everything routes through
  "hosea-kutako",
  "windhoek",
  "swakopmund",
  "walvis-bay",
  // The Namib
  "sossusvlei",
  "solitaire",
  // Damaraland and the north-west
  "spitzkoppe",
  "twyfelfontein",
  "uis",
  "khorixas",
  "palmwag",
  "kamanjab",
  "omaruru",
  "henties-bay",
  // Etosha and the north
  "etosha-okaukuejo",
  "etosha-namutoni",
  "otjiwarongo",
  "waterberg",
  "opuwo",
  "epupa",
  // The south
  "fish-river-canyon",
  "luderitz",
  "aus",
  // The Zambezi
  "rundu",
  "katima-mulilo",
];

/**
 * The longest a leg can be and still be something a person drives in one go.
 * Beyond this the honest answer is "that is two days", which the model says on
 * `/journey` without needing a page to say it on.
 */
const MAX_LEG_MIN = 8 * 60;

/** Canonical slug for an unordered pair: alphabetical, so one page per leg. */
export function legSlug(a: string, b: string): string {
  return a < b ? `${a}-to-${b}` : `${b}-to-${a}`;
}

/**
 * Pairs already served by a curated transfer page, matched on coordinates by
 * the same function the journey pages use. Two of our own pages competing for
 * one query is the most avoidable kind of cannibalisation.
 *
 * Read from the static catalogue rather than the database so the page set is
 * identical on every build. A curated route added to the database alone would
 * not be excluded here — `tests/legs.test.ts` fails if that ever happens.
 */
type Located = {
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
};

export function curatedLegSlugs(
  routes: readonly Located[] = CATALOG_ROUTES,
): Set<string> {
  const slugs = new Set<string>();
  for (const route of routes) {
    const pair = nodePairForRoute({
      originLat: route.originLat ?? null,
      originLng: route.originLng ?? null,
      destinationLat: route.destinationLat ?? null,
      destinationLng: route.destinationLng ?? null,
    });
    if (pair) slugs.add(legSlug(pair.origin.slug, pair.destination.slug));
  }
  return slugs;
}

export type Leg = {
  slug: string;
  a: PlaceNode;
  b: PlaceNode;
};

function buildLegs(): Leg[] {
  const curated = curatedLegSlugs();
  const nodes = LEG_DESTINATIONS.map(findNode).filter(
    (node): node is PlaceNode => node !== null,
  );

  const legs: Leg[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const slug = legSlug(a.slug, b.slug);
      if (curated.has(slug)) continue;

      const journey = modelJourney(a.slug, b.slug);
      if (!journey || journey.road.minutes > MAX_LEG_MIN) continue;

      // Alphabetical, so the page's own order matches its URL.
      legs.push(a.slug < b.slug ? { slug, a, b } : { slug, a: b, b: a });
    }
  }

  return legs.sort((x, y) => x.slug.localeCompare(y.slug));
}

export const LEGS: Leg[] = buildLegs();

export const LEGS_BY_SLUG = new Map(LEGS.map((leg) => [leg.slug, leg]));

/**
 * Resolve a URL slug to a leg, accepting either direction. Someone linking
 * "swakopmund-to-sossusvlei" should reach the page even though the canonical
 * is the other way round; the page itself declares the canonical.
 */
export function findLeg(slug: string): Leg | null {
  const direct = LEGS_BY_SLUG.get(slug);
  if (direct) return direct;

  const parsed = parseJourneySlug(slug);
  if (!parsed) return null;
  return (
    LEGS_BY_SLUG.get(legSlug(parsed.origin.slug, parsed.destination.slug)) ??
    null
  );
}
