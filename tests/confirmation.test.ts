/**
 * The booking confirmation, both renderings.
 *
 * The failures worth guarding are all silent. An unescaped apostrophe in a
 * traveller's name breaks the HTML without throwing. A pin that renders in the
 * HTML but not the text is invisible to the many people who read mail as
 * plain text. And a template that promises a driver's details are attached, or
 * that we answer at 03:00, is a credibility claim CLAUDE.md forbids — one that
 * no type checker will ever catch.
 */
import {
  confirmationHtml,
  confirmationSubject,
  confirmationText,
  type ConfirmationDetails,
} from "@/lib/messaging/templates";
import { normaliseFrom } from "@/lib/messaging/smtp";
import { PAYMENT_POLICY } from "@/lib/booking/payment-policy";

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

const base: ConfirmationDetails = {
  ref: "NT-4KQ8ZP",
  fullName: "Anna Weber",
  routeLabel: "Hosea Kutako International Airport (WDH) to Windhoek CBD",
  scheduledAt: new Date("2026-09-12T14:30:00+02:00"),
  vehicleClassName: "Private Car",
  passengers: 2,
  total: "1300.00",
  pickupLabel: "Arrivals hall",
  dropoffLabel: "Windhoek Country Club Resort",
  checkoutUrl: null,
  supportWhatsapp: "+264811234567",
};

/* ------------------------------------------------------- the essentials */

const text = confirmationText(base);
const html = confirmationHtml(base);

check(
  "the subject carries the reference",
  confirmationSubject(base).includes("NT-4KQ8ZP"),
);
check("the text carries the reference", text.includes("NT-4KQ8ZP"));
check("the html carries the reference", html.includes("NT-4KQ8ZP"));
check("the text formats the fare as NAD", text.includes("N$1,300"));
check("the html formats the fare as NAD", html.includes("N$1,300"));
check("the text names the vehicle class", text.includes("Private Car"));
check(
  "the text names both ends",
  text.includes("Arrivals hall") &&
    text.includes("Windhoek Country Club Resort"),
);

/* ------------------------------------------------------------ the pins */

const withPin = confirmationText({
  ...base,
  dropoffPin: { lat: -22.6018, lng: 17.0842 },
});
check(
  "a pin reaches the plain-text body, not just the html",
  withPin.includes("query=-22.6018,17.0842"),
);
check("one pin reads as singular", withPin.includes("The spot you pinned"));
check("one pin does not say 'either'", !withPin.includes("If either is wrong"));

const withBoth = confirmationText({
  ...base,
  pickupPin: { lat: -22.4799, lng: 17.4709 },
  dropoffPin: { lat: -22.6018, lng: 17.0842 },
});
check("two pins read as plural", withBoth.includes("The spots you pinned"));
check(
  "two pins both appear",
  withBoth.includes("17.4709") && withBoth.includes("17.0842"),
);
check("no pins means no pin section", !text.includes("pinned"));
check(
  "the html says 'that link' for a single pin",
  confirmationHtml({
    ...base,
    dropoffPin: { lat: -22.6, lng: 17.08 },
  }).includes("that link"),
);

/* ------------------------------------------------------------ escaping */

const hostile = confirmationHtml({
  ...base,
  fullName: 'Anna "Q" <script>alert(1)</script> O\'Brien',
  notes: "Gate is <left> of the sign & past it",
});
check(
  "a script tag in a name cannot escape into the markup",
  !hostile.includes("<script>") && hostile.includes("&lt;script&gt;"),
);
check("an ampersand in notes is escaped", hostile.includes("&amp; past it"));
check(
  "a double quote in a name cannot break an attribute",
  !hostile.includes('Anna "Q"'),
);

/* ------------------------------------------------------ credibility */

const everything = (
  confirmationText({ ...base, flightNumber: "SA 074", notes: "n" }) +
  confirmationHtml({ ...base, flightNumber: "SA 074", notes: "n" })
).toLowerCase();

for (const claim of ["24/7", "vetted", "licensed", "insured", "guaranteed"]) {
  check(`makes no "${claim}" claim`, !everything.includes(claim));
}
check(
  "states the support hours we actually keep",
  text.includes("06:00–22:00 CAT"),
);
check(
  "promises driver details before pickup rather than attaching them",
  text.includes("before pickup"),
);
check(
  "the flight promise appears only when a flight number was given",
  everything.includes("flight number") && !text.includes("flight number"),
);
// We collect the flight number, store it, and put it in front of the driver
// and dispatch — nothing anywhere checks whether the flight is late. Until
// something does, no message may imply that it does.
for (const claim of [
  "watch your flight",
  "track your flight",
  "monitor your flight",
  "tracks your flight",
  "we track the flight",
]) {
  check(
    `claims no flight monitoring we do not do: "${claim}"`,
    !everything.toLowerCase().includes(claim),
  );
}
// This used to assert the confirmation said "nothing has been charged yet".
// That was true and it was the whole problem: it told a traveller what had
// not happened and never said that paying is what confirms the vehicle, so a
// customer who was later sent a payment link quoted it back at us. The
// confirmation now carries the policy itself, from one source.
check(
  "says what payment actually buys, not merely that nothing was taken",
  text.includes(PAYMENT_POLICY.messageLine),
  text.slice(0, 0) || "messageLine missing",
);
check(
  "points an unpaid traveller at a way to actually pay",
  text.includes("bank details"),
);
check(
  "does not promise card payment while the gateway is refusing us",
  !text.toLowerCase().includes("pay by card"),
);
check(
  "links the gateway when there is one",
  confirmationText({
    ...base,
    checkoutUrl: "https://pay.example/abc",
  }).includes("https://pay.example/abc"),
);

/* ------------------------------------------------ the address we send from */

/**
 * Production rejected every confirmation email with
 *   553 Sender address rejected: not owned by user
 * against `<Namibia Transport  bookings@namibiatransport.com>` — the display
 * name and the address inside one pair of brackets, which is what nodemailer
 * makes of a MAIL_FROM pasted without them. The booking still saved; the
 * traveller just never heard from us.
 */
console.log("\nthe From header survives being typed by a human");

const FALLBACK = "bookings@namibiatransport.com";

check(
  "a correctly formed value is left alone",
  normaliseFrom("Namibia Transport <bookings@namibiatransport.com>", FALLBACK) ===
    "Namibia Transport <bookings@namibiatransport.com>",
);
check(
  "THE BUG: missing angle brackets are put back",
  normaliseFrom("Namibia Transport bookings@namibiatransport.com", FALLBACK) ===
    '"Namibia Transport" <bookings@namibiatransport.com>',
  normaliseFrom("Namibia Transport bookings@namibiatransport.com", FALLBACK),
);
check(
  "and so is the double space the log showed",
  normaliseFrom("Namibia Transport  bookings@namibiatransport.com", FALLBACK) ===
    '"Namibia Transport" <bookings@namibiatransport.com>',
  normaliseFrom("Namibia Transport  bookings@namibiatransport.com", FALLBACK),
);
check(
  "a bare address needs no name",
  normaliseFrom("bookings@namibiatransport.com", FALLBACK) ===
    "bookings@namibiatransport.com",
  normaliseFrom("bookings@namibiatransport.com", FALLBACK),
);
check(
  "quotes someone added by hand do not stack",
  normaliseFrom('"Namibia Transport" bookings@namibiatransport.com', FALLBACK) ===
    '"Namibia Transport" <bookings@namibiatransport.com>',
  normaliseFrom('"Namibia Transport" bookings@namibiatransport.com', FALLBACK),
);
check(
  "a value with no address at all falls back rather than sending nothing",
  normaliseFrom("Namibia Transport", FALLBACK) === FALLBACK,
);
check(
  "an empty value falls back too",
  normaliseFrom("   ", FALLBACK) === FALLBACK,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
