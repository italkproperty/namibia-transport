import "server-only";

import { and, desc, eq } from "drizzle-orm";

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

  if (existing) {
    await db
      .update(payments)
      .set({ raw, amount: booking.amount, updatedAt: new Date() })
      .where(eq(payments.id, existing.id));
  } else {
    await db.insert(payments).values({
      bookingId: booking.id,
      provider: BANK_TRANSFER_PROVIDER,
      // Pending is the truth: we are waiting to see it. There is no status
      // that means "they say so", and inventing one would tempt a future
      // reader into treating it as money.
      status: "pending",
      amount: booking.amount,
      currency: booking.currency,
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

  if (existing) {
    await db
      .update(payments)
      .set({ status: "paid", paidAt: now, raw, updatedAt: now })
      .where(eq(payments.id, existing.id));
  } else {
    // An operator can confirm a transfer the traveller never declared — most
    // people just pay and say nothing.
    await db.insert(payments).values({
      bookingId: booking.id,
      provider: BANK_TRANSFER_PROVIDER,
      status: "paid",
      amount: booking.amount,
      currency: booking.currency,
      paidAt: now,
      raw,
    });
  }

  // Cancelled stays cancelled: money arriving after a cancellation is a
  // refund conversation, not a reinstatement.
  if (booking.status === "pending_payment") {
    await db
      .update(bookings)
      .set({ status: "confirmed", updatedAt: now })
      .where(eq(bookings.id, booking.id));
  }

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
