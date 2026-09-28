import type { ConversionKind } from "./google-ads";

/**
 * What to report to Google for a booking somebody is looking at.
 *
 * Pure, and separate from the component that fires it, because the rules
 * below are the ones that decide whether the numbers in the Ads account bear
 * any relation to the money in the bank — and each of them is a way to be
 * confidently wrong rather than merely wrong.
 *
 * ## A trip is one sale
 *
 * An itinerary is several booking rows sharing a `group_ref` and one agreed
 * figure. Reporting the leg the traveller happens to be looking at would tell
 * Google we sold a N$3,675 trip when we sold a N$14,700 one — and, on a
 * four-leg quote, would say it four times. So the transaction is the group
 * and the value is the group's total.
 *
 * ## The transaction id is what stops the double count
 *
 * A confirmation page is reloaded, shared, and opened again from the email a
 * week later. With the conversion action set to count One, Google deduplicates
 * on `transaction_id`, so the same trip reported twice is counted once. That
 * is the mechanism — not a flag in our database, which would be a second
 * source of truth about something Google already tracks.
 *
 * ## The browser never reports a bank transfer
 *
 * A confirmed transfer also makes a booking paid, so the obvious version
 * fires here for both channels — and then `/admin/conversions` uploads the
 * same transfer again by click id, and every bank payment counts twice. The
 * split is on the provider and it is absolute: the browser reports gateway
 * payments, the export reports transfers, and neither ever sees the other's.
 */

export type ConversionEvent = {
  kind: ConversionKind;
  /** `coalesce(group_ref, ref)` — the trip, not the leg. */
  transactionId: string;
  /** Decimal string, as stored. Never a float. */
  value: string;
  currency: string;
};

/** The provider name used for money that arrives by EFT. */
export const TRANSFER_PROVIDER = "bank_transfer";

export type ConversionInput = {
  ref: string;
  groupRef: string | null;
  /** This leg's fare, used only when the booking is not part of a trip. */
  price: string;
  /** The whole trip's total, when this booking belongs to one. */
  groupTotal: string | null;
  currency: string;
  isPaid: boolean;
  /** Which provider the money came through, or null if none has. */
  provider: string | null;
};

export function conversionFor(input: ConversionInput): ConversionEvent {
  const transactionId = input.groupRef ?? input.ref;
  const value = input.groupRef && input.groupTotal ? input.groupTotal : input.price;

  const paidByGateway = input.isPaid && input.provider !== TRANSFER_PROVIDER;

  return {
    kind: paidByGateway ? "booking_paid" : "booking_submitted",
    transactionId,
    value,
    currency: input.currency,
  };
}
