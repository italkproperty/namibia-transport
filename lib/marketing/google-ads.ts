/**
 * The Google Ads tag, and what it is allowed to count.
 *
 * Direct `gtag.js` rather than a Tag Manager container, deliberately. A GTM
 * container is a remote code execution channel by design: anyone who can sign
 * into the Tag Manager account can publish JavaScript onto `/book` and
 * `/booking/[ref]` — the pages where a traveller types their name and contact
 * details and then leaves for the gateway — with no deploy, no review and no
 * test run. That is a fair trade on a marketing site. It is not one on the
 * money path, and GTM would not have saved any work here anyway: a booking
 * submit is a Server Action result, not a DOM click a container can observe,
 * so the events would still be pushed from our own code.
 *
 * The identifiers are not secret — they are readable in any page source of
 * any site that advertises — so they take `NEXT_PUBLIC_` and are read here
 * once rather than typed into components.
 *
 * ## Why a missing label is silence rather than a guess
 *
 * A conversion label is created in the Google Ads UI and cannot be derived
 * from the account id. Until one is set, the matching event is not sent at
 * all: an event posted to the wrong label would be counted against the wrong
 * conversion action, and a bidding strategy learning from it would be worse
 * than one learning from nothing. `missingLabels()` exists so an operator can
 * be told which are unset, rather than discovering it as an empty report six
 * weeks later — which is exactly how the currency rates failed twice.
 */

export type ConversionKind = "booking_submitted" | "booking_paid";

/**
 * Read at module scope on purpose.
 *
 * `NEXT_PUBLIC_` values are inlined at build, so `process.env.X` only works
 * where the compiler can see the literal key. A lookup by variable returns
 * undefined in the browser bundle, silently, which is the shape this project
 * has already been bitten by twice.
 */
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || null;

const LABELS: Record<ConversionKind, string | null> = {
  booking_submitted:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_BOOKING?.trim() || null,
  booking_paid: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_PAID?.trim() || null,
};

/** The account tag, e.g. `AW-18418844449`. Null when unconfigured. */
export function adsId(): string | null {
  return ADS_ID;
}

export function isAdsConfigured(): boolean {
  return ADS_ID !== null;
}

/**
 * `AW-18418844449/AbC-D_efGh`, the value gtag wants in `send_to`.
 *
 * Null when either half is missing, which is the whole point: half of this
 * string is not a usable destination, and sending to the account id alone
 * counts the event against no conversion action while looking like it worked.
 */
export function sendTo(kind: ConversionKind): string | null {
  const label = LABELS[kind];
  return ADS_ID && label ? `${ADS_ID}/${label}` : null;
}

/** Which conversion actions cannot be reported yet, for an operator to see. */
export function missingLabels(): ConversionKind[] {
  return (Object.keys(LABELS) as ConversionKind[]).filter(
    (kind) => LABELS[kind] === null,
  );
}
