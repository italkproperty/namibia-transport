/**
 * What the site says about paying, held to one story.
 *
 * This suite exists because of a real conversation. The site told a traveller
 * "Nothing charged today" and "your fare is locked in the moment you book";
 * an operator then sent them a payment link; and the traveller quoted our own
 * page back at us to ask why they were being asked to pay in advance. Nothing
 * on the site was false — but nothing on it said that *payment* is what
 * confirms the vehicle, and four surfaces each phrased the gap differently.
 *
 * The project already had the rule that "support hours, prices and inclusions
 * are stated in exactly one place and read from there". Payment timing was
 * never covered by it, so it drifted across seven files without anything
 * noticing.
 *
 * So the checks below are deliberately mechanical: the retired sentences are
 * banned from the source, and each surface is required to read from
 * PAYMENT_POLICY. A phrase test is crude, but it fails on exactly the way this
 * broke — someone editing one page in isolation — which a type cannot.
 */
import { readFileSync } from "node:fs";

import { PAYMENT_POLICY } from "@/lib/booking/payment-policy";
import { QUOTE_VALID_DAYS } from "@/lib/booking/validity";

let passed = 0;
let failed = 0;

/**
 * Comments are not copy.
 *
 * The first version of this suite failed on `booking-assurance.tsx`, whose
 * doc comment records that the chip used to read "nothing charged today" and
 * why it changed. That note is exactly what the project asks for — the
 * attempts that failed belong beside the one that worked — and a test that
 * forbids writing the history down would push it out of the file and into
 * nowhere. So the ban applies to what renders, and the reasoning stays.
 */
function copyOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Every file that tells a traveller when money is due. */
const SURFACES = [
  "components/marketing/booking-assurance.tsx",
  "components/booking/booking-details-form.tsx",
  "app/(booking)/book/page.tsx",
  "app/(booking)/booking/[ref]/page.tsx",
  "app/(marketing)/terms/page.tsx",
  "lib/route-content.ts",
  "lib/booking/actions.ts",
  "lib/messaging/templates.ts",
];

/* ------------------------------------------------------- one source */

console.log("every surface reads from one source");

for (const surface of SURFACES) {
  const text = readFileSync(surface, "utf8");
  check(
    `${surface.split("/").pop()} imports PAYMENT_POLICY`,
    /payment-policy/.test(text),
  );
}

/* --------------------------------------------- the retired sentences */

/**
 * The exact claims that caused the confusion. Each one is banned rather than
 * merely replaced, because the failure mode is a future edit reintroducing the
 * comfortable version on one page.
 */
console.log("\nthe sentences that cost us a customer are gone");

const RETIRED: { phrase: RegExp; why: string }[] = [
  {
    phrase: /locked in the moment you book/i,
    why: "said booking secures the trip — it does not, payment does",
  },
  {
    phrase: /Nothing charged today/i,
    why: "true, but read as 'the trip is secured and payment is optional'",
  },
  {
    phrase: /Nothing is charged today/i,
    why: "same claim on the booking page",
  },
  {
    phrase: /Nothing is charged when you book/i,
    why: "same claim in the terms, which is the version that gets quoted",
  },
  {
    phrase: /payment details before your travel date/i,
    why: "implied any time before travel is fine, with the car held throughout",
  },
];

for (const surface of SURFACES) {
  const text = readFileSync(surface, "utf8");
  for (const { phrase, why } of RETIRED) {
    const hit = copyOnly(text).match(phrase);
    check(
      `${surface.split("/").pop()} — "${hit?.[0] ?? phrase.source}" — ${why}`,
      hit === null,
      hit ? `found "${hit[0]}"` : "",
    );
  }
}

/* ------------------------------------------------ what it now claims */

console.log("\nthe policy says the thing that was missing");

check(
  "payment is named as what confirms the vehicle",
  /payment confirms your vehicle/i.test(PAYMENT_POLICY.short) &&
    /payment confirms your vehicle/i.test(PAYMENT_POLICY.confirmsChip),
);
check(
  "and the fare is still promised as fixed, so booking is worth doing",
  /fixed/i.test(PAYMENT_POLICY.short),
  PAYMENT_POLICY.short,
);
check(
  "the terms admit the consequence rather than burying it",
  /provisional/i.test(PAYMENT_POLICY.terms) &&
    /cannot guarantee/i.test(PAYMENT_POLICY.terms),
);
check(
  "an unpaid booking that lapses costs the traveller nothing",
  /nothing to pay/i.test(PAYMENT_POLICY.terms),
);

/**
 * No second validity window. "How long is my price good for" was already
 * answered by QUOTE_VALID_DAYS, and inventing a separate hold period beside it
 * would be this same drift in a new place.
 */
check(
  "the quoted window is the one already in the code, not a new number",
  PAYMENT_POLICY.terms.includes(String(QUOTE_VALID_DAYS)) &&
    PAYMENT_POLICY.faqAnswer.includes(String(QUOTE_VALID_DAYS)),
  `expected ${QUOTE_VALID_DAYS}`,
);

const numbers = (PAYMENT_POLICY.terms.match(/\b\d+\b/g) ?? []).filter(
  (n) => n !== String(QUOTE_VALID_DAYS),
);
check(
  "and no other period is invented alongside it",
  numbers.length === 0,
  numbers.join(", "),
);

/* ------------------------------------------- the refund promise holds */

/**
 * The strongest sentence on the site, and the one a traveller is most likely
 * to rely on. It is only sayable because the terms page says the same thing.
 */
console.log("\nthe refund promise is still backed by the terms");

const terms = readFileSync("app/(marketing)/terms/page.tsx", "utf8");
check(
  "the no-show refund is promised",
  /anything already paid is refunded in full/i.test(PAYMENT_POLICY.noShowRefund),
);
check(
  "and the terms say it in the same words",
  /Anything already paid is refunded in full/i.test(terms),
);
check(
  "free cancellation is promised at the window the terms state",
  /24h before/.test(PAYMENT_POLICY.cancellationChip) &&
    /More than 24 hours before pickup/i.test(terms),
);

/* --------------------------------------------------- paying is possible */

/**
 * The policy says payment confirms the vehicle, so a traveller who wants to
 * pay must be able to. When a gateway is live the link belongs in the message
 * they actually read; the previous version told them payment was coming and
 * gave them no way to make it.
 */
console.log("\nsomeone told to pay is given a way to pay");

const actions = readFileSync("lib/booking/actions.ts", "utf8");
check(
  "the WhatsApp confirmation carries the checkout link when there is one",
  /checkoutUrl \? ` Pay here: \$\{checkoutUrl\}`/.test(actions),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
