/**
 * The leg pages, against the rules that justify publishing them.
 *
 * 160 generated pages is either the strongest asset on the site or a
 * thin-content liability, and the difference is entirely whether each page
 * carries facts the others do not. So this suite does not check that the pages
 * render — it checks the three claims that make publishing them defensible:
 * every leg is a drive a person would actually make, no leg competes with one
 * of our own curated pages, and no two legs are the same page twice.
 *
 * If any of these stops being true, the right response is to remove legs, not
 * to loosen the test.
 */
import { CATALOG_ROUTES } from "@/lib/catalog";
import { modelJourney, nodePairForRoute } from "@/lib/network/journey";
import {
  curatedLegSlugs,
  findLeg,
  LEG_DESTINATIONS,
  LEGS,
  LEGS_BY_SLUG,
  legSlug,
} from "@/lib/network/legs";
import { findNode } from "@/lib/network/nodes";
import { GATE_RULES } from "@/lib/parks/gates";

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

/* ------------------------------------------------------- the set itself */

console.log("the leg set");

check("there are legs", LEGS.length > 0);
check(
  "every destination in the list is a real node",
  LEG_DESTINATIONS.every((slug) => findNode(slug) !== null),
  LEG_DESTINATIONS.filter((slug) => !findNode(slug)).join(", "),
);
check(
  "the destination list has no duplicates",
  new Set(LEG_DESTINATIONS).size === LEG_DESTINATIONS.length,
);
check(
  "every slug is unique",
  new Set(LEGS.map((leg) => leg.slug)).size === LEGS.length,
);
check(
  "the lookup map covers every leg",
  LEGS.every((leg) => LEGS_BY_SLUG.get(leg.slug) === leg),
);

/* ----------------------------------------------- one page per leg, not two */

console.log("\none page per leg");

// The whole point of canonicalising alphabetically. If a leg appeared under
// both orderings we would publish two pages competing for one query.
const unordered = new Set(LEGS.map((leg) => legSlug(leg.a.slug, leg.b.slug)));
check(
  "no leg appears in both directions",
  unordered.size === LEGS.length,
  `${LEGS.length} legs, ${unordered.size} distinct pairs`,
);
check(
  "every slug is already in canonical order",
  LEGS.every((leg) => leg.slug === legSlug(leg.a.slug, leg.b.slug)),
);
check(
  "the reverse slug still resolves to the same page",
  LEGS.every((leg) => findLeg(`${leg.b.slug}-to-${leg.a.slug}`) === leg),
);
check(
  "an unknown pair resolves to nothing",
  findLeg("windhoek-to-atlantis") === null &&
    findLeg("not-a-slug-at-all") === null,
);
check(
  "a real pair outside the published set resolves to nothing",
  findLeg("okahandja-to-karibib") === null,
);

/* ------------------------------------------------- no self-cannibalisation */

console.log("\nno competing with our own curated pages");

const curated = curatedLegSlugs();
check("curated routes were matched to node pairs", curated.size > 0);
for (const slug of curated) {
  check(
    `no leg page duplicates the curated "${slug}"`,
    !LEGS_BY_SLUG.has(slug),
  );
}

// The set is built from the static catalogue, so a curated route that exists
// only in the database would not be excluded. This is the guard for that.
const catalogPairs = CATALOG_ROUTES.filter((route) => route.isActive)
  .map((route) =>
    nodePairForRoute({
      originLat: route.originLat ?? null,
      originLng: route.originLng ?? null,
      destinationLat: route.destinationLat ?? null,
      destinationLng: route.destinationLng ?? null,
    }),
  )
  .filter((pair) => pair !== null);
check(
  "every active catalogue route that maps to nodes is excluded",
  catalogPairs.every(
    (pair) =>
      !LEGS_BY_SLUG.has(legSlug(pair!.origin.slug, pair!.destination.slug)),
  ),
);

/* --------------------------------------------- every page has real content */

console.log("\nevery leg page has something to say");

const MAX_LEG_MIN = 8 * 60;
let withGate = 0;
let withRain = 0;
let withGravel = 0;

for (const leg of LEGS) {
  const out = modelJourney(leg.a.slug, leg.b.slug);
  const back = modelJourney(leg.b.slug, leg.a.slug);

  // Both directions are priced on the page; one missing renders a half page.
  if (!out || !back) {
    check(`${leg.slug}: both directions price`, false);
    continue;
  }

  if (GATE_RULES[leg.a.slug] || GATE_RULES[leg.b.slug]) withGate += 1;
  if (out.road.rainNotes.length > 0) withRain += 1;
  if (out.road.gravelKm > 0) withGravel += 1;
}

check(
  "every leg prices in both directions",
  LEGS.every(
    (leg) =>
      modelJourney(leg.a.slug, leg.b.slug) !== null &&
      modelJourney(leg.b.slug, leg.a.slug) !== null,
  ),
);
check(
  "every leg is drivable in a day",
  LEGS.every((leg) => {
    const journey = modelJourney(leg.a.slug, leg.b.slug);
    return journey !== null && journey.road.minutes <= MAX_LEG_MIN;
  }),
);
check(
  "every leg names at least one road",
  LEGS.every((leg) => {
    const journey = modelJourney(leg.a.slug, leg.b.slug);
    return (journey?.road.roads.length ?? 0) > 0;
  }),
);
check(
  "no leg starts and ends in the same place",
  LEGS.every((leg) => leg.a.slug !== leg.b.slug),
);

// Not a pass/fail so much as the evidence that these pages differ from one
// another — if most carried no gravel, no gate and no rain note, they would be
// the same page 160 times and should not be published.
const distinguishing = LEGS.filter((leg) => {
  const journey = modelJourney(leg.a.slug, leg.b.slug);
  return (
    (journey?.road.gravelKm ?? 0) > 0 ||
    (journey?.road.rainNotes.length ?? 0) > 0 ||
    Boolean(GATE_RULES[leg.a.slug] || GATE_RULES[leg.b.slug])
  );
}).length;
check(
  "most legs carry something the others do not",
  distinguishing / LEGS.length >= 0.6,
  `${distinguishing}/${LEGS.length} carry gravel, rain or a gate`,
);

console.log(
  `\n  (${withGravel} involve gravel, ${withGate} end at a park gate, ${withRain} carry a rain closure)`,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
