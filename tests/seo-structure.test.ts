/**
 * What Google can read about each page set.
 *
 * An audit found the structure inverted: the curated route pages — eight of
 * them — carried Service, Offer and FAQPage, while the 160 leg pages carried
 * FAQPage alone despite each having a modelled fare, and the 24 destination
 * pages carried nothing at all. The two page sets that answer a traveller's
 * real question were the two Google could read least about.
 *
 * No page of the 215 emitted a BreadcrumbList, although the hierarchy is real
 * and several pages already drew the trail on screen. It was simply never
 * said in a form a crawler reads.
 *
 * Checked against the page sources, because a schema that exists in a helper
 * nobody renders is not structured data.
 */
import { readFileSync } from "node:fs";

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

const read = (path: string) => readFileSync(path, "utf8");

/**
 * Comments are not code.
 *
 * The third suite in a row to fail itself this way: the doc comment
 * explaining *why* `priceValidUntil` is absent contains the word. Banning the
 * string in raw source would ban recording the reasoning, which is how a rule
 * outlives the reason for it.
 */
const stripped = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const PAGES = {
  home: "app/(marketing)/page.tsx",
  route: "app/(marketing)/transfers/[slug]/page.tsx",
  leg: "app/(marketing)/drive/[leg]/page.tsx",
  destination: "app/(marketing)/destinations/[slug]/page.tsx",
  guide: "app/(marketing)/guides/[slug]/page.tsx",
} as const;

/* ------------------------------------------------------------ breadcrumbs */

console.log("every generated page set says where it sits");

for (const [label, path] of Object.entries(PAGES)) {
  if (label === "home") continue; // the root has no trail above it
  check(`${label} pages emit a breadcrumb trail`, /breadcrumbSchema\(/.test(read(path)));
}

/* ----------------------------------------------------------- priced pages */

/**
 * A page that states a fare should say so in a form that can become a price
 * in a result. Guides are excluded on purpose: they answer a question rather
 * than sell one journey, and an Offer on an article is a claim about which
 * journey the page is for that the page does not make.
 */
console.log("\nevery page that names a fare offers it");

for (const label of ["route", "leg", "destination"] as const) {
  const source = read(PAGES[label]);
  check(
    `${label} pages emit a priced Offer`,
    /transferServiceSchema\(|"@type": "Offer"/.test(source),
  );
}

check(
  "guides do not — they are not one journey",
  !/transferServiceSchema\(/.test(read(PAGES.guide)),
);

/* ----------------------------------------------------------- the currency */

/**
 * The one field in this whole file that could cost real money if it drifted.
 * A conversion shown beside a fare is guidance; in markup it would be read as
 * the amount due, in a currency we do not bank in.
 */
console.log("\nmarkup prices are in the currency we charge");

const schema = read("lib/seo/schema.ts");
check(
  "THE RULE: priceCurrency is NAD and nothing else",
  /priceCurrency: "NAD"/.test(schema) &&
    !/priceCurrency: (?!"NAD")/.test(schema),
);
check(
  "the price is passed through as a string, never a number",
  /price: string/.test(schema),
);
check(
  "no priceValidUntil — a public page does not hold a fare",
  !/priceValidUntil/.test(stripped("lib/seo/schema.ts")),
);

/* ------------------------------------------------------------- canonicals */

console.log("\nevery indexable page set declares its canonical");

check(
  "THE RULE: the homepage has one",
  /alternates: \{ canonical/.test(read(PAGES.home)),
  "it had none, on the page Google named first",
);
for (const [label, path] of Object.entries(PAGES)) {
  check(`${label} pages declare a canonical`, /alternates/.test(read(path)));
}

/* --------------------------------------------------------- the link graph */

/**
 * The hub was orphaned from its spokes: 160 pair pages, and not one link up
 * to the 24 place pages that answer the broader question.
 */
console.log("\nthe page sets link to each other");

check(
  "THE RULE: a leg page links up to its destination pages",
  /href=\{`\/destinations\/\$\{[^}]+\}`\}/.test(read(PAGES.leg)),
);
check(
  "and a destination page links down to its legs",
  /\/drive\//.test(read(PAGES.destination)),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
