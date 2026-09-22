/**
 * The destination pages, and the line they must not cross.
 *
 * These pages exist because most travellers have a destination before they
 * have a pair of places: they know they are going to Sossusvlei, not that
 * they want the Swakopmund leg. Every figure on them is computed, so the
 * first half of this file checks the computation.
 *
 * The second half checks something the type system cannot. We are a transport
 * company writing about places other people own and operate. What we can
 * state is what it takes to get there and what that costs; what we cannot
 * state is whether the rooms are nice, how many there are, or what they cost
 * a night — and the temptation to pad a thin page with exactly that is the
 * single most likely way this feature turns into the invented-claims problem
 * CLAUDE.md exists to prevent. So the prose is held to it mechanically.
 */
import { readFileSync } from "node:fs";

import {
  DESTINATIONS,
  bestValueArrival,
  findDestination,
} from "@/lib/network/destinations";
import { LEG_DESTINATIONS } from "@/lib/network/legs";
import { findNode, nodeLabel } from "@/lib/network/nodes";
import { parseMoney } from "@/lib/money";

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

/* ------------------------------------------------------------- the set */

console.log("which places get a page");

check("there are destinations at all", DESTINATIONS.length > 0, `${DESTINATIONS.length}`);
check(
  "every one is drawn from the curated list, not invented",
  DESTINATIONS.every((d) => LEG_DESTINATIONS.includes(d.slug)),
);
check(
  "no airport gets one — nobody plans a trip to a terminal",
  DESTINATIONS.every((d) => !d.node.isAirport),
  DESTINATIONS.filter((d) => d.node.isAirport)
    .map((d) => d.slug)
    .join(", "),
);
check(
  "slugs are unique, so no two pages fight for one URL",
  new Set(DESTINATIONS.map((d) => d.slug)).size === DESTINATIONS.length,
);
check(
  "every slug resolves to a real node",
  DESTINATIONS.every((d) => findNode(d.slug) !== null),
);
check(
  "every destination is reachable by slug",
  DESTINATIONS.every((d) => findDestination(d.slug)?.slug === d.slug),
);
check("an unknown slug resolves to nothing", findDestination("atlantis") === null);

/* --------------------------------------------------------- the arrivals */

console.log("\nevery page can price the way in");

check(
  "each has at least one priced approach",
  DESTINATIONS.every((d) => d.arrivals.length > 0),
);
check(
  "no page prices a trip from itself",
  DESTINATIONS.every((d) => d.arrivals.every((a) => a.from.slug !== d.slug)),
);
check(
  "every fare is a positive number",
  DESTINATIONS.every((d) =>
    d.arrivals.every((a) => parseMoney(a.journey.route.fixedPrice) > 0),
  ),
);
check(
  "every approach has roads, distance and a time on it",
  DESTINATIONS.every((d) =>
    d.arrivals.every(
      (a) =>
        a.journey.road.km > 0 &&
        a.journey.road.minutes > 0 &&
        a.journey.road.roads.length > 0,
    ),
  ),
);
check(
  "approaches are ordered nearest first",
  DESTINATIONS.every((d) =>
    d.arrivals.every(
      (a, i) => i === 0 || d.arrivals[i - 1].journey.road.minutes <= a.journey.road.minutes,
    ),
  ),
);
check(
  "gravel is reported, not hidden — the surface is the whole point",
  DESTINATIONS.every((d) =>
    d.arrivals.every(
      (a) => a.journey.hasGravel === a.journey.road.gravelKm > 0,
    ),
  ),
);

// The cheapest way in is not always the nearest: a gateway with a better
// backhaul can undercut a shorter drive from somewhere cars leave empty.
const cheapestDiffers = DESTINATIONS.filter((d) => {
  const best = bestValueArrival(d);
  return best.from.slug !== d.arrivals[0].from.slug;
});
check(
  "the cheapest approach is computed rather than assumed to be the nearest",
  DESTINATIONS.every(
    (d) =>
      parseMoney(bestValueArrival(d).journey.route.fixedPrice) <=
      Math.min(
        ...d.arrivals.map((a) => parseMoney(a.journey.route.fixedPrice)),
      ) +
        0.001,
  ),
  `${cheapestDiffers.length} where it is not the nearest`,
);

/* -------------------------------------------------------------- gates */

console.log("\npark gates");

const gated = DESTINATIONS.filter((d) => d.gate);
check("some destinations sit behind a gate", gated.length > 0, `${gated.length}`);
check(
  "every gate names itself, so the warning is checkable",
  gated.every((d) => Boolean(d.gate?.gate)),
);
check(
  "Etosha's camps are among them",
  gated.some((d) => d.slug === "etosha-okaukuejo"),
);

/* ------------------------------------------------- what the page may say */

/**
 * The credibility rule, enforced against the page source rather than trusted.
 *
 * These are the words that show up when a page about somewhere else's
 * property runs out of things it actually knows. A page that needs them is a
 * page that should have stayed shorter.
 */
console.log("\nthe page does not review anybody's lodge");

const SOURCES = [
  "app/(marketing)/destinations/[slug]/page.tsx",
  "app/(marketing)/destinations/page.tsx",
  "lib/network/destinations.ts",
];

const BANNED: { word: RegExp; why: string }[] = [
  { word: /\bluxur(y|ious)\b/i, why: "a claim about a property we do not own" },
  { word: /\bstunning\b/i, why: "decoration standing in for a fact" },
  { word: /\bbreathtaking\b/i, why: "decoration standing in for a fact" },
  { word: /\bworld[- ]class\b/i, why: "unverifiable" },
  { word: /\bbest\s+(lodge|hotel|camp|place)\b/i, why: "a ranking we cannot support" },
  { word: /\b\d+\s*[- ]?star\b/i, why: "a rating nobody gave us" },
  { word: /\bper\s+night\b/i, why: "someone else's room rate" },
  { word: /\b24\/7\b/, why: "a capability we do not have" },
  { word: /\bhand[- ]picked\b/i, why: "implies a vetting process we do not run" },
  { word: /\bvetted\b/i, why: "no document on file" },
];

for (const source of SOURCES) {
  const text = readFileSync(source, "utf8");
  for (const { word, why } of BANNED) {
    const hit = text.match(word);
    check(
      `${source.split("/").pop()} avoids "${hit?.[0] ?? word.source}" — ${why}`,
      hit === null,
      hit ? `found "${hit[0]}"` : "",
    );
  }
}

const page = readFileSync(SOURCES[0], "utf8");
check(
  "it asks for the lodge rather than guessing at the last stretch",
  /Send us the lodge/.test(page),
);
check(
  "it says plainly that the price is to the town, not the door",
  /prices above are to/i.test(page),
);

/* ------------------------------------------------ not competing with itself */

/**
 * The same cannibalisation rule the leg pages follow. A destination page
 * answers "how do I get to X from anywhere"; a leg page answers one pair.
 * They overlap only if a destination page starts targeting a single pair,
 * which is what the canonical is for.
 */
console.log("\none page per destination, and it says so");

check(
  "every page declares a canonical on its own slug",
  /alternates: \{ canonical: `\$\{SITE\.url\}\/destinations\/\$\{slug\}` \}/.test(
    page,
  ),
);
check(
  "the title is the question people type, not a pair of nouns",
  /title: `Getting to \$\{name\}`/.test(page),
);

/* --------------------------------------------------------------- labels */

console.log("\nlabels");

check(
  "every destination has a human name",
  DESTINATIONS.every((d) => nodeLabel(d.node).length > 1),
);
check(
  "and every gateway does too",
  DESTINATIONS.every((d) => d.arrivals.every((a) => nodeLabel(a.from).length > 1)),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
