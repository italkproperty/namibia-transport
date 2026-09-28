/**
 * The campaign has to survive the walk from the ad to the form.
 *
 * This suite exists because it did not. An ad points at a route page; the
 * visitor uses the quote widget; `bookingHref()` rebuilt the URL out of the
 * trip and nothing else. The tag was gone by the time the form loaded,
 * `channelOf()` saw a same-host referrer, and the booking was filed under
 * "Direct or typed in" — money spent and recorded as free traffic.
 *
 * Every check below is one of those failures, written so it cannot come back.
 */
import {
  acquisitionSourceFor,
  attributionQuery,
  isClickId,
  mergeAttribution,
  NO_ATTRIBUTION,
  parseAttribution,
  readAttribution,
  serialiseAttribution,
  type Attribution,
} from "@/lib/marketing/attribution";
import { channelOf } from "@/lib/admin/channels";
import { buildTripQuery, bookingHref } from "@/lib/booking/trip-params";

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

const read = (query: string) => readAttribution(new URLSearchParams(query));

/** A realistic Google click identifier. */
const GCLID = "EAIaIQobChMI-abcDEF1234567890_xyzABCdefGHIjkLMNop";

/* ----------------------------------------------------- reading the URL */

console.log("what a landing URL carries");

const paid = read(
  `utm_source=google&utm_medium=cpc&utm_campaign=arrivals&gclid=${GCLID}`,
);
check("the UTM tags are read", paid.source === "utm_source=google&utm_medium=cpc&utm_campaign=arrivals", String(paid.source));
check("the click id is read", paid.clickId === GCLID);
check("and it knows which kind it is", paid.clickKind === "gclid");

const autoTagged = read(`gclid=${GCLID}`);
check(
  "auto-tagging alone still gives us the click",
  autoTagged.clickId === GCLID && autoTagged.source === null,
);

const ios = read(`wbraid=${GCLID}`);
check(
  "an iOS click is recorded as wbraid, not mislabelled a gclid",
  ios.clickKind === "wbraid" && ios.clickId === GCLID,
);

check("an untagged visit carries nothing", !read("route=x&pax=2").clickId);

/* ------------------------------------------------------------ the link */

/**
 * The defect itself. `bookingHref` is the link every quote widget on the site
 * builds, so if the tag does not survive this function it does not survive
 * anywhere.
 */
console.log("\nthe booking link carries the campaign");

const trip = {
  routeSlug: "hosea-kutako-to-windhoek",
  date: "2026-10-13",
  time: "13:05",
  passengers: 2,
  luggage: 2,
  vehicleClassId: "sedan",
};

const href = bookingHref(trip, paid);
check("THE RULE: the click id reaches /book", href.includes(`gclid=${GCLID}`), href);
check("and so does the campaign", href.includes("utm_campaign=arrivals"));
check("the trip is still intact", href.includes("route=hosea-kutako-to-windhoek") && href.includes("pax=2"));
check(
  "an untagged trip gains no empty parameters",
  !bookingHref(trip).includes("gclid") && !bookingHref(trip).endsWith("&"),
  bookingHref(trip),
);
check(
  "what /book reads back is what the widget put there",
  read(buildTripQuery(trip, paid)).clickId === GCLID,
);

/* ------------------------------------------------- a new click is a new click */

/**
 * The expensive mistake this module is shaped to avoid. Filling each field
 * from whichever source has it means a fresh `gclid` with no UTM tags inherits
 * last week's campaign — and a bidding strategy then learns from a sale that
 * campaign never made.
 */
console.log("\na fresh click never wears an old campaign's tags");

const lastWeek: Attribution = {
  source: "utm_source=google&utm_medium=cpc&utm_campaign=sossusvlei-march",
  clickId: "OLDCLICKID_0000000000",
  clickKind: "gclid",
};
const today = read(`gclid=${GCLID}`);
const resolved = mergeAttribution(today, lastWeek);

check("THE RULE: the new click id wins", resolved.clickId === GCLID);
check(
  "THE RULE: and the old campaign does not come with it",
  resolved.source === null,
  String(resolved.source),
);
check(
  "an untagged page keeps what this tab already knew",
  mergeAttribution(read("route=x"), lastWeek).clickId === lastWeek.clickId,
);

/* ---------------------------------------------------- what gets recorded */

console.log("\nwhat lands in acquisition_source");

check(
  "tagged traffic records its tags",
  acquisitionSourceFor(paid) === paid.source,
);
check(
  "THE RULE: a bare gclid is recorded as paid Google, not as nothing",
  acquisitionSourceFor(autoTagged) === "utm_source=google&utm_medium=cpc",
  String(acquisitionSourceFor(autoTagged)),
);
check(
  "untagged traffic records nothing here",
  acquisitionSourceFor(NO_ATTRIBUTION) === null,
);

/**
 * End to end into the admin page: a paid click must not land in the same row
 * as organic search, because money spent and traffic earned sharing a row is
 * the whole reason `channelOf` distinguishes them.
 */
const folded = channelOf(acquisitionSourceFor(autoTagged));
check(
  "THE RULE: it folds to paid Google on /admin/bookings",
  folded.id === "utm:google" && folded.label === "Google (campaign)",
  `${folded.id} / ${folded.label}`,
);
check(
  "and organic Google still folds somewhere else",
  channelOf("referrer:www.google.com").id !== folded.id,
);

/* --------------------------------------------------------- validation */

/**
 * `createBooking` is a public endpoint and this value ends up in a file
 * uploaded to Google, so anything that is not plausibly a click identifier is
 * dropped rather than stored.
 */
console.log("\na click id is validated, not trusted");

check("a real one passes", isClickId(GCLID));
check("an empty one fails", !isClickId(""));
check("a short one fails", !isClickId("abc"));
check("an oversized one fails", !isClickId("a".repeat(513)));
check("a script tag fails", !isClickId("<script>alert(1)</script>"));
check("an SQL fragment fails", !isClickId("x' OR 1=1--"));
check("a newline fails", !isClickId(`${GCLID}\ninjected`));
check("a space fails", !isClickId("abcdefgh ijklmnop"));

// The validation is on the way in, not on the way out — so the thing worth
// proving is that a junk value put into a link is refused when read back,
// rather than that the link builder refuses to write it.
const junkLink = attributionQuery({
  source: null,
  clickId: "x' OR 1=1--",
  clickKind: "gclid",
});
check("a junk click id is written into a link verbatim", junkLink.length > 0, junkLink);
check(
  "THE RULE: and is refused when that link is read",
  read(junkLink).clickId === null,
);

/* -------------------------------------------------------- storage round trip */

/**
 * The bug caught while writing this: the stored `utm_a=x&utm_b=y` string was
 * validated with the per-value length bound, so five tagged parameters failed
 * it — silently discarding the attribution of exactly the well-tagged
 * campaigns the whole module exists for.
 */
console.log("\nsession storage round-trips what it was given");

const fullyTagged = read(
  "utm_source=google&utm_medium=cpc&utm_campaign=namibia-airport-transfers-september" +
    "&utm_term=windhoek%20airport%20transfer&utm_content=responsive-search-ad-two",
);
check(
  "THE RULE: five tagged parameters survive a round trip",
  parseAttribution(serialiseAttribution(fullyTagged)).source === fullyTagged.source,
  String(parseAttribution(serialiseAttribution(fullyTagged)).source),
);
check(
  "a click id survives too",
  parseAttribution(serialiseAttribution(paid)).clickId === GCLID,
);
check("unreadable storage is unattributed, not a crash", parseAttribution("{{{").clickId === null);
check("absent storage is unattributed", parseAttribution(null).source === null);
check(
  "a tampered click id in storage is dropped",
  parseAttribution('{"clickId":"<script>","clickKind":"gclid"}').clickId === null,
);
check(
  "a click id with no kind is dropped, since it cannot be uploaded",
  parseAttribution(`{"clickId":"${GCLID}"}`).clickId === null,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
