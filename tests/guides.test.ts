/**
 * The guides, against the models they quote.
 *
 * Guides carry slugs, never figures — a section names a journey and the page
 * computes distance, surface and time from the network. That design keeps the
 * numbers honest, but it moves the failure: a mistyped slug does not throw, it
 * renders an empty table, and an empty table on a published page is a guide
 * that quietly stopped making its argument. Nothing here was covered before,
 * which is why a preset named "fourteen days" that planned twelve survived for
 * weeks.
 *
 * So every slug a guide points at is resolved here against the real model, and
 * the credibility rules from CLAUDE.md are enforced on the prose the same way
 * they are on the confirmation email.
 */
import { CATALOG_ROUTES } from "@/lib/catalog";
import { GUIDES, GUIDES_BY_SLUG } from "@/lib/guides";
import { modelJourneyBySlug } from "@/lib/network/journey";
import { ITINERARY_PRESETS, planItinerary } from "@/lib/network/itinerary";
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

const activeRoutes = new Set(
  CATALOG_ROUTES.filter((route) => route.isActive).map((route) => route.slug),
);
const presetIds = new Set(ITINERARY_PRESETS.map((preset) => preset.id));

/* ------------------------------------------------------------- the basics */

console.log("the guide set itself");

check("there are guides at all", GUIDES.length > 0);
check(
  "every slug is unique",
  new Set(GUIDES.map((g) => g.slug)).size === GUIDES.length,
);
check(
  "the lookup map covers every guide",
  GUIDES.every((g) => GUIDES_BY_SLUG.get(g.slug) === g),
);
check(
  "both audiences are served",
  GUIDES.some((g) => g.kind === "arrival") &&
    GUIDES.some((g) => g.kind === "decision"),
);

/* ---------------------------------------------- every slug must resolve */

console.log("\nevery slug a guide points at");

for (const guide of GUIDES) {
  for (const slug of guide.routes) {
    check(
      `${guide.slug}: books a live route "${slug}"`,
      activeRoutes.has(slug),
    );
  }

  for (const slug of guide.journeys ?? []) {
    check(
      `${guide.slug}: journey "${slug}" resolves`,
      modelJourneyBySlug(slug) !== null,
    );
  }

  for (const section of guide.sections) {
    for (const slug of section.routeTable?.journeys ?? []) {
      check(
        `${guide.slug}: route table row "${slug}" resolves`,
        modelJourneyBySlug(slug) !== null,
      );
    }

    for (const slug of section.rainTable?.journeys ?? []) {
      check(
        `${guide.slug}: rain table row "${slug}" resolves`,
        modelJourneyBySlug(slug) !== null,
      );
    }

    if (section.gateTable) {
      const { origin, gates } = section.gateTable;
      for (const gate of gates) {
        check(
          `${guide.slug}: "${gate}" is a gate we model`,
          Boolean(GATE_RULES[gate]),
        );
        // Both halves are needed for a row: a gate rule gives the sunset, the
        // journey gives the driving time. One without the other prints nothing.
        check(
          `${guide.slug}: can drive ${origin} to "${gate}"`,
          modelJourneyBySlug(`${origin}-to-${gate}`) !== null,
        );
      }
    }

    if (section.circuitCompare) {
      check(
        `${guide.slug}: preset "${section.circuitCompare.presetId}" exists`,
        presetIds.has(section.circuitCompare.presetId),
      );
    }
  }
}

/* ------------------------------------------------- a table that renders */

console.log("\ntables that would render empty");

for (const guide of GUIDES) {
  for (const section of guide.sections) {
    // A spec with no resolvable rows renders nothing at all, and the prose
    // above it goes on referring to "the table below".
    const specs = [section.routeTable, section.rainTable].filter(
      (spec) => spec !== undefined,
    );
    for (const spec of specs) {
      check(
        `${guide.slug}/${section.heading}: table has rows`,
        spec.journeys.some((slug) => modelJourneyBySlug(slug) !== null),
      );
    }
    if (section.gateTable) {
      check(
        `${guide.slug}/${section.heading}: gate table has rows`,
        section.gateTable.gates.some(
          (gate) =>
            GATE_RULES[gate] &&
            modelJourneyBySlug(`${section.gateTable!.origin}-to-${gate}`),
        ),
      );
    }
  }
}

/* ------------------------------------------------------- presets are real */

console.log("\npresets a guide can point at");

for (const preset of ITINERARY_PRESETS) {
  const itinerary = planItinerary(preset.stops);
  check(`preset "${preset.id}" plans`, itinerary !== null);
  if (!itinerary) continue;

  // The name is shown beside the computed day count, so a name claiming a
  // different number of days contradicts the page it sits on.
  const claimed = preset.name.match(
    /\b(six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)\b/i,
  );
  if (claimed) {
    const words: Record<string, number> = {
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      eleven: 11,
      twelve: 12,
      thirteen: 13,
      fourteen: 14,
    };
    check(
      `preset "${preset.id}" name matches the days it plans`,
      words[claimed[1].toLowerCase()] === itinerary.days,
      `name says ${claimed[1]}, plans ${itinerary.days}`,
    );
  }
}

/* ----------------------------------------------------------- credibility */

console.log("\nclaims we are not allowed to make");

const prose = GUIDES.map((guide) =>
  [
    guide.title,
    guide.metaTitle,
    guide.metaDescription,
    guide.answer,
    ...guide.sections.flatMap((s) => [s.heading, ...s.body]),
    ...(guide.decision?.selfDriveIf ?? []),
    ...(guide.decision?.drivenIf ?? []),
  ].join(" "),
).join(" ");

// Same list the confirmation templates are held to. A guide is read earlier
// in the funnel than an email and by more people, so it matters more, not less.
for (const claim of ["24/7", "vetted", "licensed", "guaranteed"]) {
  check(`no guide claims "${claim}"`, !prose.toLowerCase().includes(claim));
}
check(
  "no guide promises we monitor flights beyond the pickup",
  !/we (track|monitor|watch) (your|the) flight/i.test(prose),
);

/* ------------------------------------------------------------ hygiene */

console.log("\npublishing hygiene");

const today = new Date().toISOString().slice(0, 10);

for (const guide of GUIDES) {
  check(
    `${guide.slug}: updated is a real date, not in the future`,
    /^\d{4}-\d{2}-\d{2}$/.test(guide.updated) && guide.updated <= today,
    guide.updated,
  );
  check(`${guide.slug}: has a short answer`, guide.answer.trim().length > 40);
  check(
    `${guide.slug}: has sections with bodies`,
    guide.sections.length > 0 &&
      guide.sections.every(
        (s) => s.body.length > 0 || s.routeTable !== undefined,
      ),
  );
  // Google truncates the snippet around 160 characters. Ten of the first
  // eleven guides ran past it, losing the clause that carried the reason to
  // click — so the limit is enforced rather than aimed at.
  check(
    `${guide.slug}: meta description fits the snippet`,
    guide.metaDescription.length >= 70 && guide.metaDescription.length <= 160,
    `${guide.metaDescription.length} chars`,
  );
  // Decision guides render a self-drive/driven split; one without it silently
  // drops the section that does the converting.
  if (guide.kind === "decision") {
    check(
      `${guide.slug}: decision guide carries its verdict block`,
      Boolean(
        guide.decision?.selfDriveIf.length && guide.decision?.drivenIf.length,
      ),
    );
  }
  // Every guide has to end somewhere bookable, or it is just an article.
  check(
    `${guide.slug}: ends somewhere bookable`,
    guide.routes.length > 0 || (guide.journeys?.length ?? 0) > 0,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
