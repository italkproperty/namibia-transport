/**
 * The fare in the reader's own currency.
 *
 * Two failures are worth real money here and neither announces itself. A
 * misplaced decimal in a rate — 1.82 where 18.2 was meant — misquotes every
 * foreign traveller on the site by a factor of ten, and nothing downstream
 * notices because the number is still a number. And a conversion presented as
 * the amount owed invites someone to transfer exactly that and arrive short.
 *
 * So: rates are bounded, everything indicative is rounded and dated, and the
 * rand is exact because the peg makes it exact.
 */
import {
  CURRENCIES,
  availableCurrencies,
  convertFromNad,
  guessCurrency,
  isCurrencyCode,
  isIndicative,
  rateNote,
  type Rates,
} from "@/lib/currency";
import { getRates } from "@/lib/currency-rates";

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

const RATES: Rates = {
  nadPer: { USD: 18.2, EUR: 19.8, GBP: 23.4 },
  asAt: "2026-09-21",
};

/* ------------------------------------------------------------ conversion */

console.log("converting a fare");

check(
  "converts at the configured rate",
  convertFromNad("6000.00", "USD", RATES) === "US$330",
  String(convertFromNad("6000.00", "USD", RATES)),
);
check(
  "each currency uses its own rate, not the dollar's",
  convertFromNad("6000.00", "EUR", RATES) === "€303" &&
    convertFromNad("6000.00", "GBP", RATES) === "£256",
  `${convertFromNad("6000.00", "EUR", RATES)} / ${convertFromNad("6000.00", "GBP", RATES)}`,
);
check(
  "rounds to whole units — cents imply a precision it does not have",
  !(convertFromNad("6000.00", "USD", RATES) ?? "").includes("."),
);
check(
  "NAD converts to nothing: it is the fare, not a conversion of one",
  convertFromNad("6000.00", "NAD", RATES) === null,
);
check(
  "nothing without a configured rate",
  convertFromNad("6000.00", "USD", { nadPer: {}, asAt: null }) === null,
);
check("nothing for a zero fare", convertFromNad("0.00", "USD", RATES) === null);
check(
  "nothing for a fare that is not a number",
  convertFromNad("not money", "USD", RATES) === null,
);

/* ------------------------------------------------------------- the peg */

/**
 * The Namibian dollar is pegged at par to the rand, so this is the one figure
 * on the site that is exact rather than indicative — and it needs no rate, so
 * it works on a deployment that has configured nothing at all.
 */
console.log("\nthe rand is not a conversion");

const NO_RATES: Rates = { nadPer: {}, asAt: null };

check(
  "N$650 is R650, exactly",
  convertFromNad("650.00", "ZAR", NO_RATES) === "R650",
  String(convertFromNad("650.00", "ZAR", NO_RATES)),
);
check(
  "and it keeps its cents, because it is not an approximation",
  convertFromNad("5786.50", "ZAR", NO_RATES) === "R5786.50",
  String(convertFromNad("5786.50", "ZAR", NO_RATES)),
);
check("rand is never indicative", !isIndicative("ZAR"));
check("the dollar always is", isIndicative("USD"));
check(
  "the rand's note explains the peg rather than quoting a rate",
  (rateNote("ZAR", NO_RATES) ?? "").includes("pegged at par"),
  String(rateNote("ZAR", NO_RATES)),
);
check(
  "it is offered even when no rates are configured",
  availableCurrencies(NO_RATES).some((c) => c.code === "ZAR"),
);
check(
  "a currency needing a rate is not offered without one",
  !availableCurrencies(NO_RATES).some((c) => c.code === "USD"),
);
check(
  "and is offered once it has one",
  availableCurrencies(RATES).some((c) => c.code === "USD"),
);

/* ---------------------------------------------------------- the working */

console.log("\nthe note shows the working");

check(
  "it names the rate and the day it was set",
  (rateNote("USD", RATES) ?? "").includes("N$18.20") &&
    (rateNote("USD", RATES) ?? "").includes("21 September 2026"),
  String(rateNote("USD", RATES)),
);
check(
  "it names the currency it converted to",
  (rateNote("EUR", RATES) ?? "").includes("euro"),
  String(rateNote("EUR", RATES)),
);
check(
  "an undated rate still shows the rate rather than nothing",
  (rateNote("USD", { nadPer: { USD: 18.2 }, asAt: null }) ?? "").includes(
    "N$18.20",
  ),
);
check("no note for NAD", rateNote("NAD", RATES) === null);
check("no note without a rate", rateNote("USD", NO_RATES) === null);

/* -------------------------------------------------- refusing a bad rate */

/**
 * The expensive failure. A rate out by a factor of ten is still a number, and
 * every page would render a plausible-looking price that is wrong.
 */
console.log("\nimplausible rates are refused, not trusted");

const savedUsd = process.env.USD_RATE;
const savedEur = process.env.EUR_RATE;
const savedAsAt = process.env.FX_RATE_AS_AT;

for (const bad of ["1.82", "182", "0", "-18", "not a number", ""]) {
  process.env.USD_RATE = bad;
  check(
    `refuses USD_RATE="${bad}"`,
    getRates().nadPer.USD === undefined,
    String(getRates().nadPer.USD),
  );
}

process.env.USD_RATE = "18.20";
check("accepts a plausible one", getRates().nadPer.USD === 18.2);

// Each currency has its own band: 18 is a fine dollar rate and a nonsense
// pound one, and a single shared range would wave both through.
process.env.EUR_RATE = "19.80";
check("a plausible euro rate is accepted", getRates().nadPer.EUR === 19.8);
process.env.EUR_RATE = "1.98";
check(
  "one bad rate does not take the good ones with it",
  getRates().nadPer.EUR === undefined && getRates().nadPer.USD === 18.2,
);

delete process.env.EUR_RATE;
process.env.FX_RATE_AS_AT = "not-a-date";
check("a malformed date is dropped, not printed", getRates().asAt === null);
process.env.FX_RATE_AS_AT = "2026-09-21";
check("a good one is kept", getRates().asAt === "2026-09-21");

// The single-currency variable this replaced, so an existing deployment does
// not silently lose its date on the next push.
delete process.env.FX_RATE_AS_AT;
process.env.USD_RATE_AS_AT = "2026-08-01";
check("the old USD_RATE_AS_AT still works", getRates().asAt === "2026-08-01");
delete process.env.USD_RATE_AS_AT;

if (savedUsd === undefined) delete process.env.USD_RATE;
else process.env.USD_RATE = savedUsd;
if (savedEur === undefined) delete process.env.EUR_RATE;
else process.env.EUR_RATE = savedEur;
if (savedAsAt === undefined) delete process.env.FX_RATE_AS_AT;
else process.env.FX_RATE_AS_AT = savedAsAt;

/* --------------------------------------------------------- first guess */

console.log("\nguessing from the browser's locale");

const offered = availableCurrencies(RATES);

check("a German browser is offered euros", guessCurrency(["de-DE"], offered) === "EUR");
check("an American one, dollars", guessCurrency(["en-US"], offered) === "USD");
check("a South African one, rand", guessCurrency(["en-ZA"], offered) === "ZAR");
check("a Namibian one stays in NAD", guessCurrency(["en-NA"], offered) === "NAD");
check(
  "a script subtag does not confuse the region",
  guessCurrency(["de-Latn-DE"], offered) === "EUR",
);
check(
  "a language with no region is skipped rather than guessed at",
  guessCurrency(["de"], offered) === null,
);
check(
  "it falls through to the next locale it understands",
  guessCurrency(["xx", "fr-FR"], offered) === "EUR",
);
check("an unknown region guesses nothing", guessCurrency(["en-JP"], offered) === null);
check(
  "it never guesses a currency this deployment cannot show",
  guessCurrency(["en-US"], availableCurrencies(NO_RATES)) === null,
);

/* ------------------------------------------------------------- the list */

console.log("\nthe currency list itself");

check("NAD is first, because it is the fare", CURRENCIES[0].code === "NAD");
check(
  "every currency needing a rate declares its bounds",
  CURRENCIES.every((c) => !c.env || Array.isArray(c.bounds)),
);
check(
  "every currency has a symbol and a label",
  CURRENCIES.every((c) => Boolean(c.symbol) && Boolean(c.label)),
);
check("only the rand is exact", CURRENCIES.filter((c) => c.exact).length === 1);
check("a known code is recognised", isCurrencyCode("EUR"));
check("an invented one is not", !isCurrencyCode("XYZ"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
