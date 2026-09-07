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

check("the subject carries the reference", confirmationSubject(base).includes("NT-4KQ8ZP"));
check("the text carries the reference", text.includes("NT-4KQ8ZP"));
check("the html carries the reference", html.includes("NT-4KQ8ZP"));
check("the text formats the fare as NAD", text.includes("N$1,300"));
check("the html formats the fare as NAD", html.includes("N$1,300"));
check("the text names the vehicle class", text.includes("Private Car"));
check("the text names both ends", text.includes("Arrivals hall") && text.includes("Windhoek Country Club Resort"));

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
check(
  "one pin does not say 'either'",
  !withPin.includes("If either is wrong"),
);

const withBoth = confirmationText({
  ...base,
  pickupPin: { lat: -22.4799, lng: 17.4709 },
  dropoffPin: { lat: -22.6018, lng: 17.0842 },
});
check("two pins read as plural", withBoth.includes("The spots you pinned"));
check("two pins both appear", withBoth.includes("17.4709") && withBoth.includes("17.0842"));
check(
  "no pins means no pin section",
  !text.includes("pinned"),
);
check(
  "the html says 'that link' for a single pin",
  confirmationHtml({ ...base, dropoffPin: { lat: -22.6, lng: 17.08 } }).includes("that link"),
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
check(
  "says nothing is charged when there is no checkout url",
  text.includes("nothing has been charged"),
);
check(
  "links the gateway when there is one",
  confirmationText({ ...base, checkoutUrl: "https://pay.example/abc" }).includes(
    "https://pay.example/abc",
  ),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
