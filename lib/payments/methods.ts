import { SUPPORT } from "@/lib/company";

/**
 * How a traveller can pay, who handles it, and what we never see.
 *
 * This did not exist anywhere a traveller could read it. The site asked
 * people to pay — by a link, or by transfer to a bank account shown on their
 * booking page — without ever stating which methods it accepts, in what
 * currency, or who processes the card. Every card scheme's merchant rules
 * require exactly that disclosure, and so does anybody assessing whether a
 * site that asks strangers for money is what it claims to be.
 *
 * One source, for the same reason payment *timing* has one: the moment this
 * is typed on two pages it says two things, and the page a traveller happens
 * to read is the one they will quote back.
 *
 * ## What is deliberately not claimed here
 *
 * No PCI DSS claim. We are not assessed, and "PCI compliant" on a page is a
 * certification claim, not a description of an architecture. What is true and
 * checkable is narrower and says more: no card field exists on this site, so
 * there is no card data here to secure.
 *
 * No card brand names until somebody confirms what PayToday actually accepts.
 * Listing Visa and Mastercard because every payment page does is exactly the
 * kind of borrowed claim that has cost this project rework before.
 */

export const PAYMENT_CURRENCY = {
  code: "NAD",
  name: "Namibian dollar",
  /**
   * Every charge is in NAD because that is what we bank in. Other currencies
   * on the site are indicative conversions shown beside the fare, never
   * instead of it.
   */
  statement:
    "Every fare is charged in Namibian dollars (NAD). Prices shown in other " +
    "currencies are dated conversions for guidance and are never what is charged.",
} as const;

export const CARD_PAYMENT = {
  label: "Card",
  processor: "PayToday",
  /** What actually happens, in the order it happens. */
  how:
    "You are taken to PayToday's own payment page to enter your card details. " +
    "The payment is completed there and you are returned to your booking.",
  /**
   * The strongest true sentence available, and stronger than a compliance
   * badge: there is no card field on this site to attack.
   */
  security:
    "No card number, expiry date or security code is ever entered on this " +
    "site, and we have nowhere to store one. What we record is the amount, " +
    "the currency, the provider and whether the payment succeeded.",
  /** Confirmed only after the gateway is re-read server-side. */
  confirmation:
    "A card payment is confirmed only after we re-read it from PayToday and " +
    "the amount matches what we recorded — never from the address you are " +
    "returned to.",
  refundTiming:
    "Card refunds are returned by PayToday, typically within three to five " +
    "business days.",
} as const;

export const BANK_PAYMENT = {
  label: "Bank transfer (EFT)",
  how:
    "Our account details are shown on your own booking page, with your " +
    "booking reference as the payment reference.",
  /**
   * Real advice and a real signal. Invoice-redirection fraud works by sending
   * a convincing follow-up with different account details, and it works best
   * on somebody paying an operator abroad for the first time.
   */
  fraudWarning:
    "Our bank details never change. We will never message you to say our " +
    "account has changed — if you receive anything that does, it is not from " +
    "us. Check with us before sending money.",
  confirmation:
    "A transfer is marked received only by a person here, after it appears on " +
    "our statement. Nothing you click can mark a booking paid.",
} as const;

/** Where a complaint goes, and what happens to it. */
export const COMPLAINTS = {
  route:
    "Write to us with your booking reference. Complaints are handled by the " +
    "same people who run the trips — there is no queue to be passed along.",
  hours: `We read and reply during coordination hours, ${SUPPORT.officeHoursShort}, daily.`,
} as const;
