import { QUOTE_VALID_DAYS } from "@/lib/booking/validity";

/**
 * When money is due, and what paying actually buys — in one place.
 *
 * This exists because it drifted and a customer caught us. The site said four
 * different things across four surfaces: "Nothing charged today" on the quote
 * widget, "One step. Nothing is charged today." on the booking page, "we will
 * message you payment details before your travel date" on the confirmation,
 * and — the damaging one — "your fare is locked in the moment you book" in the
 * route FAQs. Read together they say a booking is secured by booking.
 *
 * It is not. Partner drivers fulfil the trips and an unpaid hold does not
 * reserve anyone. So when an operator sent a payment link, the traveller
 * quoted our own page back at us and asked why they were being asked to pay in
 * advance. That is the worst possible moment to be discovering your own
 * policy, and the customer was right: nothing on the site said payment was
 * what confirmed the car.
 *
 * The rule the project already had — "support hours, prices and inclusions are
 * stated in exactly one place and read from there" — never covered payment
 * timing. It does now, and `tests/payment-policy.test.ts` holds the retired
 * sentences out of the source so they cannot come back one surface at a time.
 *
 * Two things are kept apart deliberately, because conflating them is what
 * caused the confusion:
 *
 *   The FARE is held by booking. It is fixed at the quoted amount and cannot
 *   move under the traveller, for `QUOTE_VALID_DAYS` or until the travel date.
 *
 *   The VEHICLE is held by paying. Before that the booking is provisional.
 *
 * No new window is invented here. "How long is my price good for" was already
 * answered by `QUOTE_VALID_DAYS`, and a second number beside it would be the
 * same drift in a new place.
 */

export const PAYMENT_POLICY = {
  /**
   * The whole policy in one sentence. Use this wherever a traveller is
   * deciding and there is room for exactly one line.
   */
  short: "Payment confirms your vehicle — your fare is fixed either way.",

  /** Chip-length, for the reassurance row under a booking CTA. */
  confirmsChip: "Payment confirms your vehicle",

  /** Chip-length, unchanged and backed by the cancellation terms. */
  cancellationChip: "Free cancellation up to 24h before",

  /**
   * The strongest sentence we have, and it is backed: the cancellation section
   * of the terms says the same thing in the same words.
   */
  noShowRefund:
    "If nobody comes for you, you pay nothing — anything already paid is refunded in full.",

  /**
   * What the booking form does and does not do. Still true, and still worth
   * saying at the CTA — it is the friction-remover that "nothing charged
   * today" used to be, without implying the trip is secured.
   */
  noCardOnSite: "No card details on this page — we send you a payment link.",

  /** For the booking confirmation, where payment can be taken right now. */
  awaitingPaymentOnline:
    "Your fare is held. Pay now to confirm your vehicle and have your driver assigned.",

  /** For the booking confirmation, where bank transfer is the only channel. */
  awaitingPaymentBank:
    "Your fare is held. Settle it by bank transfer below and we will confirm your vehicle.",

  /** For the booking confirmation, where neither channel is available yet. */
  awaitingPaymentLink:
    "Your fare is held. We will message you payment details — payment confirms your vehicle.",

  /** Sent on WhatsApp and email the moment a booking is taken. */
  messageLine:
    "Payment confirms your vehicle and we will assign your driver. Your fare is held at the quoted amount until then.",

  /** The FAQ answer, which is where a considered traveller looks. */
  faqAnswer:
    "You book without entering any card details, and we send you a payment link " +
    "on WhatsApp. Paying is what confirms your vehicle — until then the booking is " +
    "provisional, because an unpaid hold does not reserve a driver. Your fare is " +
    `fixed at the quoted amount from the moment you book and stays good for ${QUOTE_VALID_DAYS} days ` +
    "or until your travel date, whichever comes first.",

  /** The terms page, which is the version that has to survive being quoted. */
  terms:
    "No card details are taken on the site. We send payment instructions on " +
    "WhatsApp once your booking is in, and payment is what confirms your " +
    "vehicle — until then your booking is provisional and we cannot guarantee " +
    "a driver on a busy day. Your fare is fixed at the quoted amount from the " +
    `moment you receive your booking reference, for ${QUOTE_VALID_DAYS} days or until your ` +
    "travel date, whichever comes first. An unpaid booking that lapses simply " +
    "expires: there is nothing to pay and nothing to cancel.",
} as const;
