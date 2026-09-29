/**
 * What a site that takes money has to say about itself.
 *
 * The site had a payment flow and no payment page. A traveller could be sent
 * to a card gateway, or shown a bank account and asked to transfer to it,
 * without any page stating which methods we accept, in what currency, who
 * processes the card, or what happens to a refund. Every card scheme's
 * merchant rules require that disclosure — and so does anybody deciding
 * whether a site asking strangers for money is what it claims to be. Google
 * Safe Browsing decided it was not, and flagged the homepage as deceptive.
 *
 * So the disclosure is enforced rather than remembered. Each check below is
 * one requirement, and a page that stops making one of these statements fails
 * here rather than in somebody's security review.
 *
 * The second half is the opposite job: the claims a payment page must NOT
 * make. A security badge is the cheapest thing on the internet to type and
 * the most expensive to be caught with.
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

/**
 * Comments are not copy.
 *
 * The first run of this suite failed itself: the doc comment in
 * `methods.ts` explaining *why* we make no PCI claim contains the string
 * "PCI DSS", and the one explaining why card brands are not listed contains
 * "Visa and Mastercard". Scanning raw source would therefore ban writing
 * down the reasoning — which is how a rule loses the record of why it
 * exists. `payment-policy.test.ts` already solved this; the same fix
 * applies. Required statements are still matched against the raw source,
 * because a constant's name is not copy either.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const page = readFileSync("app/(marketing)/payments/page.tsx", "utf8");
const methods = readFileSync("lib/payments/methods.ts", "utf8");
const privacy = readFileSync("app/(marketing)/privacy/page.tsx", "utf8");
const footer = readFileSync("components/marketing/site-footer.tsx", "utf8");
const terms = readFileSync("app/(marketing)/terms/page.tsx", "utf8");

/* ------------------------------------------------- the required statements */

console.log("every merchant disclosure is present");

const REQUIRED: { name: string; test: RegExp; source: string }[] = [
  { name: "who is being paid, by legal name", test: /SITE\.name/, source: page },
  { name: "the company registration, where set", test: /company\.registration/, source: page },
  { name: "the currency every fare is charged in", test: /PAYMENT_CURRENCY/, source: page },
  { name: "Namibian dollars named explicitly", test: /Namibian dollars \(NAD\)/, source: methods },
  { name: "which payment methods are accepted", test: /CARD_PAYMENT[\s\S]*BANK_PAYMENT/, source: page },
  { name: "who processes the card payment", test: /processor:\s*"PayToday"/, source: methods },
  { name: "that card details never reach us", test: /No card number, expiry date or security code/, source: methods },
  { name: "how a refund is returned, and when", test: /refundTiming/, source: page },
  { name: "a link to the cancellation terms", test: /href="\/terms"/, source: page },
  { name: "what the traveller is actually buying", test: /whole car/, source: page },
  { name: "the territory served", test: /within Namibia only/, source: page },
  { name: "a complaints route", test: /COMPLAINTS/, source: page },
  { name: "the hours a complaint is read in", test: /officeHoursShort/, source: methods },
  { name: "a contact address for money questions", test: /company\.email/, source: page },
  { name: "the bank-detail fraud warning", test: /never change/, source: methods },
];

for (const requirement of REQUIRED) {
  check(requirement.name, requirement.test.test(requirement.source));
}

/* ---------------------------------------------------------- reachability */

/**
 * A disclosure nobody can reach is not a disclosure. These are the three
 * pages a person assessing the site goes looking for, and all three have to
 * be one click from every page.
 */
console.log("\nand reachable from every page");

for (const [label, href] of [
  ["how to pay", "/payments"],
  ["privacy", "/privacy"],
  ["booking terms", "/terms"],
] as const) {
  check(`the footer links to ${label}`, footer.includes(`href="${href}"`), href);
}

check(
  "THE RULE: the footer states the country of domicile",
  /operating in Namibia/.test(footer),
);
check(
  "and the currency fares are charged in",
  /Namibian\s*\n?\s*dollars/.test(footer),
);

/* ------------------------------------------- the claims we must not make */

/**
 * Every one of these is a sentence somebody reaches for when a payment page
 * feels thin, and every one is a claim we cannot produce evidence for. A
 * compliance badge nobody audited is worse than no badge: it converts an
 * honest gap into a false statement.
 */
console.log("\nno security claim we cannot evidence");

const BANNED: { phrase: RegExp; why: string }[] = [
  { phrase: /PCI[\s-]?DSS|PCI compliant/i, why: "we are not assessed" },
  { phrase: /100% secure|completely secure|totally secure/i, why: "nothing is" },
  { phrase: /bank[- ]level security|military[- ]grade/i, why: "borrowed, unmeasured" },
  { phrase: /guaranteed safe|guarantee your (?:card|data)/i, why: "a guarantee we cannot honour" },
  { phrase: /fully encrypted end to end/i, why: "describes somebody else's system" },
];

for (const { phrase, why } of BANNED) {
  const hit = [page, methods, privacy, terms]
    .map(withoutComments)
    .find((s) => phrase.test(s));
  check(`no "${phrase.source.split("|")[0]}" claim — ${why}`, !hit);
}

/**
 * Card brand names, until somebody has actually confirmed with PayToday which
 * ones they accept.
 *
 * Every payment page on the internet lists Visa and Mastercard, which is
 * exactly why it is so easy to type them without checking. Delete this check
 * when the answer is in hand — deleting it is the confirmation.
 */
check(
  "THE RULE: no card brand is named until PayToday confirms which they accept",
  !/\bVisa\b|\bMastercard\b|\bAmerican Express\b/i.test(
    withoutComments(page) + withoutComments(methods),
  ),
);

/* ----------------------------------------------- privacy covers the money */

console.log("\nthe privacy page covers payment data specifically");

check(
  "it says no card details are stored",
  /never entered on this[\s\S]{0,40}site|never see them/i.test(privacy),
);
check(
  "it names what IS kept about a payment",
  /the amount, the currency, the provider/i.test(privacy),
);
check(
  "it says who else sees a traveller's data",
  /Who else sees it/i.test(privacy),
);
check(
  "it states a retention position",
  /How long we keep it/i.test(privacy),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
