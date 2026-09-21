import "server-only";

import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, payments } from "@/db/schema";

import { getBankDetails, transferReference } from "./bank";

/**
 * Bank transfers, and the one rule that governs them.
 *
 * **A traveller saying they have paid is not a payment.** It is a claim, and
 * the only thing that settles it is money appearing on the statement. So
 * `declareTransfer` records an assertion and deliberately cannot mark anything
 * paid; `confirmTransfer` is the admin-side action that does, and it exists on
 * a page behind the password.
 *
 * Getting this wrong is not a rounding error — it is dispatching a car for a
 * trip nobody paid for, on the word of whoever had the booking link. The two
 * functions are kept in one file so the asymmetry is impossible to miss while
 * editing either of them.
 */

export const BANK_TRANSFER_PROVIDER = "bank_transfer";

/**
 * Every booking a single transfer settles, and what it comes to.
 *
 * A multi-leg itinerary is several bookings and one thing the traveller
 * agreed to. The quote page shows them the trip total and one reference, so
 * that is what they transfer — and before this, the payment was recorded
 * against the first leg alone at the first leg's price. A traveller sending
 * N$16,050 produced a N$5,786 line on the operator's board, and confirming it
 * flipped one leg of three: money received in full, two driving jobs still
 * unpaid, and the traveller's own page still telling them they had not paid.
 *
 * So a transfer covers the whole group or the single booking, and the amount
 * is the sum of what it covers.
 */
async function payableSet(
  db: ReturnType<typeof getDb>,
  booking: { id: string; groupRef: string | null; amount: string; currency: string },
): Promise<{ ids: string[]; total: string; currency: string }> {
  if (!booking.groupRef) {
    return { ids: [booking.id], total: booking.amount, currency: booking.currency };
  }

  const legs = await db
    .select({ id: bookings.id, price: bookings.customerPrice })
    .from(bookings)
    .where(
      and(
        eq(bookings.groupRef, booking.groupRef),
        ne(bookings.status, "cancelled"),
      ),
    );

  if (legs.length === 0) {
    return { ids: [booking.id], total: booking.amount, currency: booking.currency };
  }

  const total = legs
    .reduce((sum, leg) => sum + Number(leg.price), 0)
    .toFixed(2);

  return { ids: legs.map((leg) => leg.id), total, currency: booking.currency };
}

/** Shape we keep in `payments.raw` for a transfer. */
type TransferRaw = {
  /** When the traveller said they had sent it. Not when it arrived. */
  declaredAt?: string;
  /** Free text the traveller added, e.g. which account they sent from. */
  note?: string;
  /** Who confirmed it and when, once an operator has seen the statement. */
  confirmedAt?: string;
  reference?: string;
};

/**
 * Records that a traveller says they have made the transfer.
 *
 * Idempotent: clicking twice updates the existing declaration rather than
 * stacking rows, because a second click is a person being unsure, not a second
 * payment. Returns quietly on a booking that is already settled — re-declaring
 * against a paid booking is harmless and should not produce an error the
 * traveller has to understand.
 */
export async function declareTransfer(
  bookingRef: string,
  note?: string,
): Promise<{ ok: true } | { error: string }> {
  if (!isDatabaseConfigured()) {
    return { error: "We cannot record that right now. Please message us." };
  }
  if (!getBankDetails()) {
    return { error: "Bank transfer is not available on this deployment." };
  }

  const db = getDb();

  const [booking] = await db
    .select({
      id: bookings.id,
      ref: bookings.ref,
      status: bookings.status,
      amount: bookings.customerPrice,
      currency: bookings.currency,
      groupRef: bookings.groupRef,
    })
    .from(bookings)
    .where(eq(bookings.ref, bookingRef))
    .limit(1);

  if (!booking) return { error: "We could not find that booking." };
  if (booking.status === "cancelled") {
    return { error: "That booking has been cancelled." };
  }

  const [existing] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, booking.id),
        eq(payments.provider, BANK_TRANSFER_PROVIDER),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  // Already confirmed by a human. Nothing a traveller clicks should touch it.
  if (existing && existing.status === "paid") return { ok: true };

  const raw: TransferRaw = {
    ...(existing?.raw as TransferRaw | null),
    declaredAt: new Date().toISOString(),
    reference: transferReference(booking.ref),
    ...(note ? { note: note.slice(0, 500) } : {}),
  };

  // The amount is what the traveller was actually asked to send, which for an
  // itinerary is the whole trip rather than the leg carrying the reference.
  const payable = await payableSet(db, booking);

  if (existing) {
    await db
      .update(payments)
      .set({ raw, amount: payable.total, updatedAt: new Date() })
      .where(eq(payments.id, existing.id));
  } else {
    await db.insert(payments).values({
      bookingId: booking.id,
      provider: BANK_TRANSFER_PROVIDER,
      // Pending is the truth: we are waiting to see it. There is no status
      // that means "they say so", and inventing one would tempt a future
      // reader into treating it as money.
      status: "pending",
      amount: payable.total,
      currency: payable.currency,
      raw,
    });
  }

  return { ok: true };
}

/**
 * Marks a transfer as received. Admin-only — the caller is responsible for
 * having checked the password, and every current caller is inside the admin
 * shell, which cannot render without it.
 *
 * Confirming a payment is also what confirms the booking: until the money is
 * seen, a booking sits at `pending_payment` no matter what anyone has clicked.
 */
export async function confirmTransfer(
  bookingId: string,
): Promise<{ ok: true } | { error: string }> {
  if (!isDatabaseConfigured()) return { error: "No database configured." };

  const db = getDb();

  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      groupRef: bookings.groupRef,
      amount: bookings.customerPrice,
      currency: bookings.currency,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) return { error: "Booking not found." };

  const [existing] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, booking.id),
        eq(payments.provider, BANK_TRANSFER_PROVIDER),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  const now = new Date();
  const raw: TransferRaw = {
    ...((existing?.raw as TransferRaw | null) ?? {}),
    confirmedAt: now.toISOString(),
  };

  const payable = await payableSet(db, booking);

  if (existing) {
    await db
      .update(payments)
      .set({ status: "paid", paidAt: now, raw, amount: payable.total, updatedAt: now })
      .where(eq(payments.id, existing.id));
  } else {
    // An operator can confirm a transfer the traveller never declared — most
    // people just pay and say nothing.
    await db.insert(payments).values({
      bookingId: booking.id,
      provider: BANK_TRANSFER_PROVIDER,
      status: "paid",
      amount: payable.total,
      currency: payable.currency,
      paidAt: now,
      raw,
    });
  }

  // Every leg the money covers, not just the one carrying the reference.
  // Cancelled stays cancelled: money arriving after a cancellation is a refund
  // conversation, not a reinstatement.
  await db
    .update(bookings)
    .set({ status: "confirmed", updatedAt: now })
    .where(
      and(
        inArray(bookings.id, payable.ids),
        eq(bookings.status, "pending_payment"),
      ),
    );

  return { ok: true };
}

export type TransferState = {
  /** The traveller has said they sent it. */
  declaredAt: string | null;
  /** An operator has seen it on the statement. */
  confirmedAt: string | null;
  note: string | null;
  status: "none" | "declared" | "confirmed";
};

export async function getTransferState(
  bookingId: string,
): Promise<TransferState> {
  const none: TransferState = {
    declaredAt: null,
    confirmedAt: null,
    note: null,
    status: "none",
  };
  if (!isDatabaseConfigured()) return none;

  const db = getDb();
  const [row] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, bookingId),
        eq(payments.provider, BANK_TRANSFER_PROVIDER),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (!row) return none;

  const raw = (row.raw as TransferRaw | null) ?? {};
  return {
    declaredAt: raw.declaredAt ?? null,
    confirmedAt: raw.confirmedAt ?? null,
    note: raw.note ?? null,
    status:
      row.status === "paid"
        ? "confirmed"
        : raw.declaredAt
          ? "declared"
          : "none",
  };
}
