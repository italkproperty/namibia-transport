/**
 * Where bookings come from, and how wrong we are allowed to be about it.
 *
 * `acquisition_source` has been recorded since the first booking, but nothing
 * ever read it in aggregate — so the question "how did this customer find us"
 * had no answer beyond opening one row at a time. The folding that answers it
 * is a judgement, not a lookup: four Google hostnames are one channel, a
 * tagged campaign outranks the host it rendered on, and a quote we typed
 * ourselves is not acquisition at all.
 *
 * Two ways this goes wrong quietly, and both are checked below.
 *
 * It can *overcount*: sweeping an unrecognised referrer into "Other" hides
 * exactly the channel we are trying to discover, and counting admin quotes as
 * traffic makes the site look like it is working when the work was a phone
 * call.
 *
 * It can *flatter*: a referrer goes missing whenever a link is opened from
 * WhatsApp or an email client, and those land in "not recorded". A page that
 * draws a clean chart over that is lying by omission, so the confidence
 * figure is part of the contract and is tested like one.
 */
import {
  attributionConfidence,
  channelOf,
  foldChannels,
} from "@/lib/admin/channels";

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

/* ------------------------------------------------------------- search */

console.log("search engines");

check(
  "a Google referrer is Google",
  channelOf("referrer:www.google.com").id === "google",
  channelOf("referrer:www.google.com").id,
);
check(
  "THE RULE: every Google hostname folds into one channel",
  new Set(
    [
      "referrer:google.com",
      "referrer:www.google.com",
      "referrer:google.com.na",
      "referrer:google.co.za",
      "com.google.android.gm",
    ]
      .map((raw) => (raw.startsWith("referrer:") ? raw : `referrer:${raw}`))
      .map((raw) => channelOf(raw).id),
  ).size === 1,
  [...new Set(
    ["google.com", "www.google.com", "google.com.na", "google.co.za"].map(
      (h) => channelOf(`referrer:${h}`).id,
    ),
  )].join(", "),
);
check(
  "a link opened from Gmail on Android is still Google",
  channelOf("referrer:com.google.android.gm").id === "google",
);
check("Bing is its own channel", channelOf("referrer:bing.com").id === "bing");
check(
  "and is classified as search, not a referral",
  channelOf("referrer:www.bing.com").kind === "search",
);
check(
  "a lookalike domain is not mistaken for the search engine",
  channelOf("referrer:google.namibiasafaris.com").id !== "google",
  channelOf("referrer:google.namibiasafaris.com").id,
);

/* ------------------------------------------------------------- social */

console.log("\nsocial");

check(
  "Facebook's mobile and link-shim hosts fold together",
  channelOf("referrer:m.facebook.com").id === "facebook" &&
    channelOf("referrer:l.facebook.com").id === "facebook" &&
    channelOf("referrer:www.facebook.com").id === "facebook",
);
check("Instagram is separate from Facebook", channelOf("referrer:instagram.com").id === "instagram");
check(
  "WhatsApp is recognised when it does send a referrer",
  channelOf("referrer:api.whatsapp.com").id === "whatsapp",
);
check(
  "t.co resolves to X rather than an unknown host",
  channelOf("referrer:t.co").id === "x",
);

/* -------------------------------------------------------- campaigns */

/**
 * A tagged campaign is the answer whatever host it arrived from, and it must
 * never merge with the organic channel of the same name — money spent and
 * traffic earned sharing a row is how a channel gets credited with results it
 * did not produce.
 */
console.log("\ncampaigns outrank the referrer");

check(
  "a utm_source is read",
  channelOf("utm_source=facebook&utm_medium=cpc").id === "utm:facebook" &&
    channelOf("utm_source=facebook&utm_medium=cpc").label.startsWith("Facebook"),
  channelOf("utm_source=facebook&utm_medium=cpc").label,
);
check(
  "THE RULE: paid facebook and organic facebook are different rows",
  channelOf("utm_source=facebook").id !== channelOf("referrer:facebook.com").id,
  `${channelOf("utm_source=facebook").id} vs ${channelOf("referrer:facebook.com").id}`,
);
// The admin page rendered "Facebook 1" directly above "Facebook 1" — two
// correct rows that read as one duplicated mistake. A distinction the reader
// cannot see is not a distinction.
check(
  "and an operator can tell them apart, because the labels differ too",
  channelOf("utm_source=facebook").label !==
    channelOf("referrer:facebook.com").label,
  `${channelOf("utm_source=facebook").label} vs ${channelOf("referrer:facebook.com").label}`,
);
check(
  "an unknown campaign source is named rather than bucketed",
  channelOf("utm_source=lodge-newsletter").label === "Campaign: lodge-newsletter",
  channelOf("utm_source=lodge-newsletter").label,
);
check(
  "an encoded source is decoded",
  channelOf("utm_source=windhoek%20expo").label === "Campaign: windhoek expo",
  channelOf("utm_source=windhoek%20expo").label,
);
check(
  "utm_source is matched as a parameter, not as a substring",
  channelOf("utm_medium=cpc&utm_source=bing").id === "utm:bing",
  channelOf("utm_medium=cpc&utm_source=bing").id,
);
check(
  "a campaign with no utm_source falls through rather than throwing",
  channelOf("utm_medium=cpc&utm_campaign=arrivals").kind === "referral",
);

/* ------------------------------------------------- what is not the site */

console.log("\nwork we did ourselves is not acquisition");

check(
  "an admin quote is marked internal",
  channelOf("admin-quote").kind === "internal",
);
check(
  "so is an admin itinerary, and it says which",
  channelOf("admin-itinerary").kind === "internal" &&
    channelOf("admin-itinerary").label.includes("itinerary"),
);
/**
 * A quote typed in the admin panel never travelled through the website, so it
 * belongs in neither half of "how many bookings name a channel". Counting it
 * as attributed credits the site with a phone call; counting it as
 * unattributed invents a measurement problem that does not exist. It is
 * reported on its own line instead.
 */
const mixed = attributionConfidence([
  { channel: channelOf("admin-quote"), bookings: 9, revenue: "0" },
  { channel: channelOf("referrer:google.com"), bookings: 1, revenue: "0" },
]);
check("THE RULE: internal is never counted as an attributed channel", mixed.attributed === 1, String(mixed.attributed));
check(
  "and it is out of the denominator too, not counted as a missing referrer",
  mixed.total === 1,
  String(mixed.total),
);
check("it is reported on its own instead", mixed.internal === 9, String(mixed.internal));
check(
  "so a book of nothing but admin quotes reports no false gap",
  attributionConfidence([
    { channel: channelOf("admin-quote"), bookings: 4, revenue: "0" },
  ]).percent === 0 &&
    attributionConfidence([
      { channel: channelOf("admin-quote"), bookings: 4, revenue: "0" },
    ]).total === 0,
);

/* ------------------------------------------------- honesty about gaps */

console.log("\nthe gaps are reported, not smoothed over");

check("a null source is not recorded", channelOf(null).kind === "unknown");
check("nor is an empty one", channelOf("   ").kind === "unknown");
check(
  "THE RULE: 'not recorded' is kept apart from 'direct'",
  channelOf(null).id !== channelOf("direct").id,
);
check(
  "direct is its own kind, so it is not counted as an earned channel",
  channelOf("direct").kind === "direct",
);
check(
  "confidence counts only genuinely attributed bookings",
  attributionConfidence([
    { channel: channelOf("referrer:google.com"), bookings: 3, revenue: "0" },
    { channel: channelOf("direct"), bookings: 3, revenue: "0" },
    { channel: channelOf(null), bookings: 4, revenue: "0" },
  ]).percent === 30,
  String(
    attributionConfidence([
      { channel: channelOf("referrer:google.com"), bookings: 3, revenue: "0" },
      { channel: channelOf("direct"), bookings: 3, revenue: "0" },
      { channel: channelOf(null), bookings: 4, revenue: "0" },
    ]).percent,
  ),
);
check(
  "an empty book does not divide by zero",
  attributionConfidence([]).percent === 0,
);

/**
 * The discovery case. A lodge that starts linking to us is the single most
 * valuable thing this report can surface, and it only surfaces if unknown
 * hosts keep their names.
 */
check(
  "an unrecognised referrer keeps its host instead of becoming 'Other'",
  channelOf("referrer:www.sossusvleilodge.com").label === "sossusvleilodge.com",
  channelOf("referrer:www.sossusvleilodge.com").label,
);
check(
  "two different unknown hosts do not collapse into one row",
  channelOf("referrer:lodge-a.com").id !== channelOf("referrer:lodge-b.com").id,
);

/* ------------------------------------------------------------ folding */

console.log("\nfolding the rows Postgres returns");

const folded = foldChannels([
  { source: "referrer:www.google.com", bookings: 4, revenue: "2600.00" },
  { source: "referrer:google.com.na", bookings: 2, revenue: "1300.00" },
  { source: "direct", bookings: 3, revenue: "1950.00" },
  { source: null, bookings: 1, revenue: "650.00" },
  { source: "admin-quote", bookings: 5, revenue: "28000.00" },
]);

check(
  "THE RULE: the two Google rows became one",
  folded.filter((t) => t.channel.id === "google").length === 1,
);
check(
  "with their bookings added",
  folded.find((t) => t.channel.id === "google")?.bookings === 6,
  String(folded.find((t) => t.channel.id === "google")?.bookings),
);
check(
  "and their revenue added as money, not concatenated",
  folded.find((t) => t.channel.id === "google")?.revenue === "3900.00",
  String(folded.find((t) => t.channel.id === "google")?.revenue),
);
check(
  "revenue keeps two decimal places, because it is money",
  folded.every((t) => /^\d+\.\d{2}$/.test(t.revenue)),
  folded.map((t) => t.revenue).join(", "),
);
check(
  "no booking is lost or double-counted in the fold",
  folded.reduce((sum, t) => sum + t.bookings, 0) === 15,
  String(folded.reduce((sum, t) => sum + t.bookings, 0)),
);
check(
  "biggest channel first",
  folded[0].channel.id === "google",
  folded.map((t) => `${t.channel.id}:${t.bookings}`).join(" "),
);
check(
  "an empty result folds to an empty list rather than throwing",
  foldChannels([]).length === 0,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
