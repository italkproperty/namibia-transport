/**
 * Multi-leg quotes, and the arithmetic a traveller will check.
 *
 * The failure this guards is specific and expensive: a traveller adds up the
 * legs on their quote page, gets a different number from the total they agreed
 * on the phone, and believes the larger one. So the split across legs has to
 * reconcile exactly — not nearly — both for the computed price and for a
 * figure an operator typed in after negotiating.
 *
 * The second guarantee is that a driven multi-day trip is never priced as a
 * bare sum of its legs. A driver who is away for six nights is paid for six
 * nights, and per-leg pricing loses that silently.
 */
import { priceItinerary, type QuoteStop } from "@/lib/admin/itinerary-quote";
import { modelJourney } from "@/lib/network/journey";

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

/* ------------------------------------------------------------ the basics */

console.log("a simple out-and-back");

// Tomo's trip: out to the dunes, three nights, back again.
const tomo: QuoteStop[] = [
  { slug: "windhoek", label: "Etango Ranch Guest Farm", nights: 0 },
  { slug: "solitaire", label: "Namib Desert Lodge", nights: 3 },
  { slug: "windhoek", label: "Etango Ranch Guest Farm", nights: 0 },
];

const quote = priceItinerary(tomo);
check("it prices", quote !== null);

if (quote) {
  check("it has two legs", quote.legs.length === 2, `${quote.legs.length}`);
  check("it counts the nights", quote.nights === 3, `${quote.nights}`);
  check(
    "custom labels reach the legs, not the node names",
    quote.legs[0].fromLabel === "Etango Ranch Guest Farm" &&
      quote.legs[0].toLabel === "Namib Desert Lodge",
    `${quote.legs[0].fromLabel} → ${quote.legs[0].toLabel}`,
  );
  check(
    "the return leg is labelled too",
    quote.legs[1].toLabel === "Etango Ranch Guest Farm",
    quote.legs[1].toLabel,
  );

  // THE arithmetic guarantee.
  const sum = quote.legs.reduce((total, leg) => total + leg.price, 0);
  check(
    "THE RULE: the legs sum to the quoted total, exactly",
    sum === quote.total,
    `legs ${sum} vs total ${quote.total}`,
  );
  check(
    "every leg costs something",
    quote.legs.every((leg) => leg.price > 0),
  );
  check(
    "payouts never exceed the fare",
    quote.legs.every((leg) => leg.payout <= leg.price),
  );

  // A driven trip is not the sum of one-way fares: the driver's nights away
  // are in it, and a per-leg sum loses them.
  const out = modelJourney("windhoek", "solitaire");
  const back = modelJourney("solitaire", "windhoek");
  if (out && back) {
    const naive = Number(out.route.fixedPrice) + Number(back.route.fixedPrice);
    check(
      "a three-night trip costs more than two one-way fares",
      quote.total > naive,
      `itinerary ${quote.total} vs naive ${naive}`,
    );
  }

  check("it offers a self-drive comparison", quote.selfDrive.length > 0);
  check(
    "every self-drive option has a real total",
    quote.selfDrive.every((option) => option.total > 0),
  );
}

/* --------------------------------------------------- a real multi-stop */

console.log("\na four-stop itinerary");

const circuit: QuoteStop[] = [
  { slug: "hosea-kutako", nights: 0 },
  { slug: "sossusvlei", nights: 2 },
  { slug: "swakopmund", nights: 2 },
  { slug: "etosha-okaukuejo", nights: 3 },
  { slug: "hosea-kutako", nights: 0 },
];

const big = priceItinerary(circuit);
check("it prices", big !== null);

if (big) {
  check("four legs", big.legs.length === 4, `${big.legs.length}`);
  check("seven nights", big.nights === 7, `${big.nights}`);
  const sum = big.legs.reduce((total, leg) => total + leg.price, 0);
  check(
    "THE RULE: the legs still sum exactly",
    sum === big.total,
    `legs ${sum} vs total ${big.total}`,
  );
  check(
    "the legs are in travelling order",
    big.legs[0].fromSlug === "hosea-kutako" &&
      big.legs[3].toSlug === "hosea-kutako",
  );
  check(
    "a longer trip costs more than the short one",
    quote !== null && big.total > quote.total,
  );
}

/* -------------------------------------------------------- what it refuses */

console.log("\nwhat it refuses to price");

check(
  "one stop is not an itinerary",
  priceItinerary([{ slug: "windhoek", nights: 0 }]) === null,
);
check(
  "an unknown place is refused rather than guessed",
  priceItinerary([
    { slug: "windhoek", nights: 0 },
    { slug: "not-a-real-place", nights: 1 },
  ]) === null,
);
check("no stops at all", priceItinerary([]) === null);

/* ------------------------------------------------- labels are cosmetic only */

console.log("\nlabels change the words, never the price");

const labelled = priceItinerary([
  { slug: "windhoek", label: "Some Lodge", nights: 0 },
  { slug: "swakopmund", label: "Another Lodge", nights: 2 },
  { slug: "windhoek", nights: 0 },
]);
const plain = priceItinerary([
  { slug: "windhoek", nights: 0 },
  { slug: "swakopmund", nights: 2 },
  { slug: "windhoek", nights: 0 },
]);
check(
  "a display label cannot move the fare",
  labelled !== null && plain !== null && labelled.total === plain.total,
  `${labelled?.total} vs ${plain?.total}`,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
