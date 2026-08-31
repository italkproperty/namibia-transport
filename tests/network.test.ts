/**
 * The road network and the fare model.
 *
 * The model exists to price journeys nobody has priced by hand, which means
 * nothing checks its work. So the seven fares the site already publishes are
 * turned into the test: if a graph edge drifts away from the real road, or a
 * cost constant is nudged, the model stops agreeing with prices we have stood
 * behind for months and this fails.
 *
 * Two of the seven diverge by more than a rounding error, and that is the
 * point rather than a failure. The model says the Sossusvlei fare is about a
 * tenth light — it is the one route where the car crosses 260 km of gravel and
 * comes back empty — and that the Etosha fare is about a tenth heavy. Those are
 * findings to act on, so the tolerance is set to hold them visible rather than
 * tuned until they disappear.
 */
import { CATALOG_ROUTES } from "@/lib/catalog";
import { computeFare } from "@/lib/pricing";
import {
  modelFare,
  modelPayout,
  CONTRIBUTION_RATE,
  RUNNING_COST_PER_KM,
} from "@/lib/network/fare-model";
import {
  journeySlug,
  journeyTitle,
  modelJourney,
  modelJourneyBySlug,
  nodePairForRoute,
  parseJourneySlug,
  withCuratedCeiling,
} from "@/lib/network/journey";
import { NODES_BY_SLUG, PLACE_NODES } from "@/lib/network/nodes";
import { findRoad, ROAD_EDGES } from "@/lib/network/roads";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function within(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) / expected <= tolerance;
}

const drift = (actual: number, expected: number) =>
  `${(((actual - expected) / expected) * 100).toFixed(1)}%`;

/* ------------------------------------------------------- the graph is sane */

console.log("\nthe graph");

check(
  "every place has a unique slug",
  new Set(PLACE_NODES.map((n) => n.slug)).size === PLACE_NODES.length,
);

check(
  "every backhaul is a probability",
  PLACE_NODES.every((n) => n.backhaul >= 0 && n.backhaul <= 1),
);

check(
  "every road joins two known places",
  ROAD_EDGES.every(
    (e) => NODES_BY_SLUG.has(e.from) && NODES_BY_SLUG.has(e.to),
  ),
  ROAD_EDGES.filter(
    (e) => !NODES_BY_SLUG.has(e.from) || !NODES_BY_SLUG.has(e.to),
  )
    .map((e) => `${e.from}->${e.to}`)
    .join(", "),
);

check(
  "no road has a zero or negative length",
  ROAD_EDGES.every((e) => e.km > 0),
);

// A place with no road to it is a place we would quote and then fail to reach.
const unreachable = PLACE_NODES.filter(
  (node) => node.slug !== "windhoek" && findRoad("windhoek", node.slug) === null,
);
check(
  "every place is reachable from Windhoek",
  unreachable.length === 0,
  unreachable.map((n) => n.slug).join(", "),
);

check("a place is not a journey to itself", findRoad("windhoek", "windhoek") === null);
check("an unknown place has no road", findRoad("windhoek", "atlantis") === null);

// Roads run both ways, so the shortest path must too.
const symmetric = [
  ["hosea-kutako", "sossusvlei"],
  ["swakopmund", "etosha-okaukuejo"],
  ["luderitz", "katima-mulilo"],
] as const;
check(
  "the drive is the same length in both directions",
  symmetric.every(([a, b]) => findRoad(a, b)!.km === findRoad(b, a)!.km),
);

// Minimising on time, not distance: the tar detour through Swakopmund beats
// the shorter Spitzkoppe gravel, which is the choice a real driver makes.
const hentiesBay = findRoad("windhoek", "henties-bay")!;
check(
  "the fast road wins over the short one",
  hentiesBay.via.some((node) => node.slug === "swakopmund"),
  `went ${hentiesBay.via.map((n) => n.slug).join(" > ")}`,
);

/* ------------------------------- the graph agrees with what the site says */

console.log("\nthe graph against the seven published routes");

const PUBLISHED: [string, string, string][] = [
  ["hosea-kutako-to-windhoek", "hosea-kutako", "windhoek"],
  ["hosea-kutako-to-swakopmund", "hosea-kutako", "swakopmund"],
  ["windhoek-to-swakopmund", "windhoek", "swakopmund"],
  ["hosea-kutako-to-walvis-bay", "hosea-kutako", "walvis-bay"],
  ["hosea-kutako-to-sossusvlei", "hosea-kutako", "sossusvlei"],
  ["hosea-kutako-to-etosha", "hosea-kutako", "etosha-okaukuejo"],
  ["windhoek-to-walvis-bay", "windhoek", "walvis-bay"],
];

for (const [slug, origin, destination] of PUBLISHED) {
  const published = CATALOG_ROUTES.find((r) => r.slug === slug);
  if (!published) {
    check(`${slug} exists in the catalogue`, false);
    continue;
  }
  const road = findRoad(origin, destination);
  if (!road) {
    check(`${slug} has a road`, false);
    continue;
  }

  const publishedKm = Number(published.distanceKm);
  const publishedMin = published.durationMin!;

  check(
    `${slug}: distance within 8% of published`,
    within(road.km, publishedKm, 0.08),
    `${road.km} km vs ${publishedKm} km (${drift(road.km, publishedKm)})`,
  );
  check(
    `${slug}: driving time within 10% of published`,
    within(road.minutes, publishedMin, 0.1),
    `${road.minutes} min vs ${publishedMin} min (${drift(road.minutes, publishedMin)})`,
  );
}

/* ------------------------------- the model agrees with what the site charges */

console.log("\nthe model against the seven published fares");

for (const [slug, origin, destination] of PUBLISHED) {
  const published = CATALOG_ROUTES.find((r) => r.slug === slug)!;
  const road = findRoad(origin, destination)!;
  const fare = modelFare(road);
  const publishedPrice = Number(published.fixedPrice);

  check(
    `${slug}: modelled fare within 12% of published`,
    within(fare.price, publishedPrice, 0.12),
    `N$${fare.price} vs N$${publishedPrice} (${drift(fare.price, publishedPrice)})`,
  );
}

/* --------------------------------------- the model cannot lose us the car */

console.log("\nthe model never sells a drive below its cost");

// The floor that matters is physical: whatever else the model does, the payout
// has to cover fuel, tyres and wear on every kilometre the car actually turns,
// or a booking costs the driver money to accept and they stop accepting.
let belowCost = 0;
let cheapest = Infinity;
for (const origin of PLACE_NODES) {
  for (const destination of PLACE_NODES) {
    if (origin.slug === destination.slug) continue;
    const road = findRoad(origin.slug, destination.slug)!;
    const fare = modelFare(road);
    const returnFactor = 2 - destination.backhaul;
    const runningCost =
      (road.tarKm * RUNNING_COST_PER_KM.tar +
        road.gravelKm * RUNNING_COST_PER_KM.gravel) *
      returnFactor;
    const payout = modelPayout(fare.price);
    if (payout <= runningCost) belowCost += 1;
    cheapest = Math.min(cheapest, fare.price);
  }
}
check(
  "no pair is priced below the driver's running cost",
  belowCost === 0,
  `${belowCost} pairs`,
);
check(
  "no journey is cheaper than the shortest transfer we sell",
  cheapest >= 650,
  `cheapest N$${cheapest}`,
);

// Rounding must not open a gap between the two halves of the split.
const splitOk = PLACE_NODES.slice(0, 8).every((origin) =>
  PLACE_NODES.slice(0, 8).every((destination) => {
    if (origin.slug === destination.slug) return true;
    const journey = modelJourney(origin.slug, destination.slug)!;
    const price = Number(journey.route.fixedPrice);
    const payout = Number(journey.route.defaultDriverPayout);
    return Math.abs(price - payout - price * CONTRIBUTION_RATE) < 0.005;
  }),
);
check("price, payout and contribution always reconcile", splitOk);

/* ------------------------------------------------- the deadhead is priced */

console.log("\nthe empty return leg");

// The whole reason for modelling rather than listing: the same road costs
// different money in each direction, because on the way out the car comes home
// empty and on the way back it comes home to a market.
const toEtosha = modelJourney("windhoek", "etosha-okaukuejo")!;
const fromEtosha = modelJourney("etosha-okaukuejo", "windhoek")!;
check(
  "the same road is dearer away from the market than towards it",
  Number(toEtosha.route.fixedPrice) > Number(fromEtosha.route.fixedPrice),
  `out N$${toEtosha.route.fixedPrice}, back N$${fromEtosha.route.fixedPrice}`,
);
check(
  "and both directions are the same distance",
  toEtosha.road.km === fromEtosha.road.km,
);

/* -------------------------------------------------------------- the slugs */

console.log("\nslugs");

const roundTrips = PLACE_NODES.every((origin) =>
  PLACE_NODES.every((destination) => {
    if (origin.slug === destination.slug) return true;
    const parsed = parseJourneySlug(journeySlug(origin.slug, destination.slug));
    return (
      parsed?.origin.slug === origin.slug &&
      parsed?.destination.slug === destination.slug
    );
  }),
);
check("every pair survives a slug round-trip", roundTrips);

check(
  "hyphenated place names parse",
  parseJourneySlug("walvis-bay-to-fish-river-canyon")?.destination.slug ===
    "fish-river-canyon",
);
check("an unknown place does not parse", parseJourneySlug("windhoek-to-paris") === null);
check("a place is not a journey to itself", parseJourneySlug("windhoek-to-windhoek") === null);
check("nonsense does not parse", parseJourneySlug("hello") === null);
check("a curated slug that is not a node pair does not parse", parseJourneySlug("corporate-windhoek-city") === null);
check(
  "a slug prices a journey",
  (modelJourneyBySlug("swakopmund-to-sossusvlei")?.road.gravelKm ?? 0) > 0,
);

/* ------------------------------------------- curated routes map onto nodes */

console.log("\ncurated routes and the network");

for (const [slug, origin, destination] of PUBLISHED) {
  const published = CATALOG_ROUTES.find((r) => r.slug === slug)!;
  const pair = nodePairForRoute({
    originLat: published.originLat ?? null,
    originLng: published.originLng ?? null,
    destinationLat: published.destinationLat ?? null,
    destinationLng: published.destinationLng ?? null,
  });
  check(
    `${slug} maps onto the network`,
    pair?.origin.slug === origin && pair?.destination.slug === destination,
    `got ${pair ? `${pair.origin.slug} -> ${pair.destination.slug}` : "null"}`,
  );
}

const corporate = CATALOG_ROUTES.find((r) => r.slug === "corporate-windhoek-city")!;
check(
  "a route that starts and ends in one place is not a journey",
  nodePairForRoute({
    originLat: corporate.originLat ?? null,
    originLng: corporate.originLng ?? null,
    destinationLat: corporate.destinationLat ?? null,
    destinationLng: corporate.destinationLng ?? null,
  }) === null,
);

check(
  "a route without coordinates is not a journey",
  nodePairForRoute({
    originLat: null,
    originLng: null,
    destinationLat: null,
    destinationLng: null,
  }) === null,
);

/* ------------------------------ a modelled journey behaves like a route */

console.log("\na modelled journey is a route in every way that matters");

const journey = modelJourney("sossusvlei", "swakopmund")!;
check("it has no routes row", journey.route.id === "");
check("it is bookable", journey.route.isActive);
check("it is priced per vehicle", journey.route.pricingUnit === "per_vehicle");
check("it carries no SEO copy", journey.route.seoBody === null);
check(
  "it carries both endpoints' coordinates",
  journey.route.originLat === NODES_BY_SLUG.get("sossusvlei")!.lat &&
    journey.route.destinationLng === NODES_BY_SLUG.get("swakopmund")!.lng,
);
check("it knows it crosses gravel", journey.hasGravel);
check(
  "it names the drive",
  journeyTitle(journey.road) === "Sossusvlei to Swakopmund",
  journeyTitle(journey.road),
);

// The existing fare maths must work on it unchanged — that is the entire point
// of dressing a modelled journey as a RouteView.
const sedan = {
  id: "class-sedan",
  slug: "private-sedan",
  priceMultiplier: "1.00",
};
const suv = { id: "class-suv", slug: "suv-4x4", priceMultiplier: "1.40" };

const sedanFare = computeFare(journey.route, sedan, 2);
const suvFare = computeFare(journey.route, suv, 2);

check(
  "computeFare prices it per vehicle, not per head",
  sedanFare.customerPrice === journey.route.fixedPrice,
  `${sedanFare.customerPrice} vs ${journey.route.fixedPrice}`,
);
check(
  "the SUV multiplier applies",
  Number(suvFare.customerPrice) ===
    Math.round(Number(journey.route.fixedPrice) * 1.4),
);
check(
  "our share holds at 30% across classes",
  Math.abs(
    Number(suvFare.contribution) / Number(suvFare.customerPrice) -
      CONTRIBUTION_RATE,
  ) < 0.01,
);

/* -------------------------------------------- the published price is a ceiling */

console.log("\nno modelled quote is dearer than a published one for a longer, slower drive");

// The catalogue as the app sees it: only the fields the ceiling reads.
const published = CATALOG_ROUTES.filter((r) => r.isActive).map((route) => ({
  slug: route.slug,
  pricingUnit: route.pricingUnit ?? ("per_vehicle" as const),
  fixedPrice: route.fixedPrice as string,
  originLat: route.originLat ?? null,
  originLng: route.originLng ?? null,
  destinationLat: route.destinationLat ?? null,
  destinationLng: route.destinationLng ?? null,
}));

// Windhoek to Sossusvlei is 45 km shorter than the airport run we publish at
// N$6,500, and the model prices it higher. Asking more for less driving is the
// one comparison a traveller will actually make, so the published price wins.
const toDunes = modelJourney("windhoek", "sossusvlei")!;
const cappedDunes = withCuratedCeiling(toDunes, published);
check(
  "the shorter drive to Sossusvlei is not dearer than the published longer one",
  Number(cappedDunes.route.fixedPrice) <= 6500,
  `N$${cappedDunes.route.fixedPrice} (uncapped N$${toDunes.route.fixedPrice})`,
);
check(
  "and the payout follows the capped price, so the split still holds",
  Math.abs(
    Number(cappedDunes.route.fixedPrice) -
      Number(cappedDunes.route.defaultDriverPayout) -
      Number(cappedDunes.route.fixedPrice) * CONTRIBUTION_RATE,
  ) < 0.005,
);

// The airport run to Etosha is longer and dearer, so nothing is capped.
const toEtoshaFromCity = modelJourney("windhoek", "etosha-okaukuejo")!;
check(
  "a quote already under the published fare is left alone",
  withCuratedCeiling(toEtoshaFromCity, published).route.fixedPrice ===
    toEtoshaFromCity.route.fixedPrice,
);

// N$650 buys one seat on the airport shuttle, not a car to Windhoek from the
// coast. A per-seat fare must never become a ceiling on a whole-vehicle quote.
const toCity = modelJourney("swakopmund", "windhoek")!;
check(
  "a per-seat published fare is not a ceiling on a whole-vehicle quote",
  withCuratedCeiling(toCity, published).route.fixedPrice ===
    toCity.route.fixedPrice,
  `N$${withCuratedCeiling(toCity, published).route.fixedPrice}`,
);

// 340 of the 373 km from the dunes to the coast are gravel, so it is shorter
// than the airport run to Swakopmund and an hour and a half longer. A shorter
// published route must not cap it just because the odometer says less.
const dunesToCoast = modelJourney("sossusvlei", "swakopmund")!;
check(
  "a shorter but faster published route is not a ceiling",
  withCuratedCeiling(dunesToCoast, published).route.fixedPrice ===
    dunesToCoast.route.fixedPrice,
  `N$${withCuratedCeiling(dunesToCoast, published).route.fixedPrice} vs modelled N$${dunesToCoast.route.fixedPrice}`,
);

// The invariant, across the whole network rather than on three examples.
let inversions = 0;
for (const origin of PLACE_NODES) {
  for (const destination of PLACE_NODES) {
    if (origin.slug === destination.slug) continue;
    const quote = withCuratedCeiling(
      modelJourney(origin.slug, destination.slug)!,
      published,
    );
    const price = Number(quote.route.fixedPrice);
    const km = quote.road.km;

    for (const route of published) {
      if (route.pricingUnit === "per_person") continue;
      const pair = nodePairForRoute(route);
      if (!pair || pair.destination.slug !== destination.slug) continue;
      const curatedRoad = findRoad(pair.origin.slug, pair.destination.slug)!;
      if (
        curatedRoad.km >= km &&
        curatedRoad.minutes >= quote.road.minutes &&
        price > Number(route.fixedPrice)
      ) {
        inversions += 1;
      }
    }
  }
}
check(
  "no pair anywhere asks more money for less driving than a published route",
  inversions === 0,
  `${inversions} inversions`,
);

/* ------------------------------------------------------------------ done */

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
