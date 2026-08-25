import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers, payments, routes } from "@/db/schema";
import type { Payment, PaymentStatus } from "@/db/schema";
import { parseMoney } from "@/lib/money";

import { INTENT_TTL_MS } from "./paytoday/config";
import { defaultReturnUrl } from "./paytoday/provider";
import { getPaymentProvider } from "./index";
import type { PaymentProvider } from "./types";

/**
 * Everything that happens to a payment after the traveller leaves for the
 * gateway. PayToday's guide is explicit that it does not do this for you:
 * "Reconciliation flows on successful payment ... should be handled by the
 * party performing the integration."
 *
 * Two rules run through all of it:
 *   · The gateway's own query response is the only source of truth. Nothing
 *     here reads a status out of a URL, a form field or a redirect.
 *   · A payment is only marked paid when the amount PayToday reports matches
 *     the amount we recorded. A mismatch parks the booking for a human rather
 *     than confirming a trip that was underpaid.
 */

export type PaymentView = {
  status: PaymentStatus;
  amount: string;
  checkoutUrl: string | null;
  expiresAt: Date | null;
  provider: string;
  /** True when the traveller can be sent to a hosted page right now. */
  isResumable: boolean;
};

/** The most recent payment attempt for a booking, or null if there is none. */
export async function getLatestPayment(
  bookingId: string
): Promise<Payment | null> {
  if (!isDatabaseConfigured()) return null;

  const [row] = await getDb()
    .select()
    .from(payments)
    .where(eq(payments.bookingId, bookingId))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return row ?? null;
}

function isTerminal(status: PaymentStatus): boolean {
  return status === "paid" || status === "refunded";
}

function isExpired(payment: Payment): boolean {
  return payment.expiresAt !== null && payment.expiresAt.getTime() <= Date.now();
}

export function toPaymentView(payment: Payment | null): PaymentView | null {
  if (!payment) return null;

  return {
    status: payment.status,
    amount: payment.amount,
    checkoutUrl: payment.checkoutUrl,
    expiresAt: payment.expiresAt,
    provider: payment.provider,
    isResumable:
      payment.status === "pending" &&
      payment.checkoutUrl !== null &&
      !isExpired(payment),
  };
}

/**
 * Re-reads a booking's payment from the gateway and writes the result down.
 *
 * Safe to call on every confirmation-page view: an already-settled payment
 * short-circuits without touching the network, which also makes it idempotent
 * when PayToday sends the traveller back twice.
 */
export async function reconcileBookingPayment(
  bookingRef: string,
  provider: PaymentProvider = getPaymentProvider()
): Promise<{
  payment: Payment | null;
  changed: boolean;
}> {
  if (!isDatabaseConfigured()) return { payment: null, changed: false };

  const db = getDb();

  const [booking] = await db
    .select({
      id: bookings.id,
      ref: bookings.ref,
      status: bookings.status,
      customerPrice: bookings.customerPrice,
    })
    .from(bookings)
    .where(eq(bookings.ref, bookingRef))
    .limit(1);

  if (!booking) return { payment: null, changed: false };

  const payment = await getLatestPayment(booking.id);
  if (!payment) return { payment: null, changed: false };

  // Already settled, or nothing the gateway can tell us about.
  if (isTerminal(payment.status)) return { payment, changed: false };
  if (!payment.providerReference) return { payment, changed: false };
  if (payment.provider === "stub") return { payment, changed: false };

  let remote;
  try {
    remote = await provider.getPayment(payment.providerReference);
  } catch (error) {
    // A gateway outage must not blank out what we already know.
    console.error(
      `[payments] could not query ${payment.provider} for booking ${bookingRef}`,
      error
    );
    return { payment, changed: false };
  }

  if (!remote) return { payment, changed: false };

  // Guard the one thing an attacker or a bug could turn into a free trip: a
  // "paid" status attached to the wrong amount.
  let status = remote.status;
  let mismatch: string | null = null;

  if (status === "paid") {
    const expected = parseMoney(payment.amount);
    const reported = parseMoney(remote.amount);
    if (Math.abs(expected - reported) > 0.009) {
      mismatch = `expected ${payment.amount}, gateway reported ${remote.amount}`;
      status = "pending";
      console.error(
        `[payments] amount mismatch on booking ${bookingRef} (${mismatch}) — not marking paid`
      );
    }
  }

  if (status === payment.status && !mismatch) {
    return { payment, changed: false };
  }

  const paidAt = status === "paid" ? (payment.paidAt ?? new Date()) : payment.paidAt;

  const [updated] = await db
    .update(payments)
    .set({
      status,
      paidAt,
      // Keep the creation payload alongside the query result — a dispute
      // needs both halves of the story, not just the latest one.
      raw: {
        ...(typeof payment.raw === "object" && payment.raw !== null
          ? (payment.raw as Record<string, unknown>)
          : {}),
        latestQuery: remote.raw ?? {},
        amountMismatch: mismatch,
        reconciledAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id))
    .returning();

  // Payment confirms the booking. A decline does not cancel it — travellers
  // retry with another card, and cancelling their trip under them is hostile.
  if (status === "paid" && booking.status === "pending_payment") {
    await db
      .update(bookings)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, "pending_payment")));
  }

  return { payment: updated ?? payment, changed: true };
}

/**
 * Returns a hosted page the traveller can pay on, creating a fresh intent when
 * the previous one has lapsed. The amount is always re-read from the booking
 * row — the fare that was agreed — never from anything the caller supplies.
 */
export async function getOrCreateCheckout(
  bookingRef: string,
  provider: PaymentProvider = getPaymentProvider()
): Promise<{ url: string } | { error: string }> {
  if (!isDatabaseConfigured()) {
    return { error: "Payments are not connected yet." };
  }

  const db = getDb();

  const [row] = await db
    .select({
      booking: bookings,
      customerName: customers.fullName,
      customerEmail: customers.email,
      customerWhatsapp: customers.whatsapp,
      routeOrigin: routes.originLabel,
      routeDestination: routes.destinationLabel,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(routes, eq(bookings.routeId, routes.id))
    .where(eq(bookings.ref, bookingRef))
    .limit(1);

  if (!row) return { error: "We could not find that booking." };
  const { booking } = row;

  if (booking.status === "cancelled") {
    return { error: "That booking has been cancelled." };
  }

  const existing = await getLatestPayment(booking.id);
  if (existing && isTerminal(existing.status)) {
    return { error: "That booking is already paid." };
  }

  // Reuse a live intent rather than burning a new one on every page view.
  if (
    existing &&
    existing.status === "pending" &&
    existing.checkoutUrl &&
    !isExpired(existing)
  ) {
    return { url: existing.checkoutUrl };
  }

  try {
    const intent = await provider.createPayment({
      bookingId: booking.id,
      bookingRef: booking.ref,
      amount: booking.customerPrice,
      currency: booking.currency,
      customer: {
        fullName: row.customerName,
        email: row.customerEmail,
        whatsapp: row.customerWhatsapp,
      },
      description:
        row.routeOrigin && row.routeDestination
          ? `${row.routeOrigin} to ${row.routeDestination}`
          : `${booking.pickupLabel} to ${booking.dropoffLabel}`,
      returnUrl: defaultReturnUrl(booking.ref),
    });

    await db.insert(payments).values({
      bookingId: booking.id,
      provider: intent.provider,
      providerReference: intent.providerReference,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
      checkoutUrl: intent.redirectUrl,
      expiresAt: new Date(Date.now() + INTENT_TTL_MS),
      raw: intent.raw,
    });

    if (!intent.redirectUrl) {
      return { error: "The payment gateway did not return a payment page." };
    }

    return { url: intent.redirectUrl };
  } catch (error) {
    console.error(`[payments] could not start checkout for ${bookingRef}`, error);
    return {
      error:
        "We could not open the payment page. Your booking is saved — please try again or message us on WhatsApp.",
    };
  }
}
