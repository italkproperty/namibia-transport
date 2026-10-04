"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { isSettled } from "@/lib/admin/settled";
import { reconcileBookingPayment } from "@/lib/payments/reconcile";

/**
 * Voiding a booking, and why it needed to exist.
 *
 * Until now nothing in the admin UI could set a booking to `cancelled`. The
 * status existed in the enum and no code path reached it, which meant a quote
 * typed with the wrong fare, the wrong date or the wrong traveller was
 * permanent — still live at its link, still payable, still on the dispatch
 * board — and the only remedy was a hand-written UPDATE against production.
 *
 * At one quote a week that is an annoyance. At fifty a day it is a guarantee
 * that somebody eventually pays a cancelled trip.
 *
 * Cancelling is deliberately reversible and deliberately does not delete: a
 * booking someone may have paid against is evidence, and the payments rows
 * hang off it. It flips a status, writes down the reason, and the public page
 * then declines to take money for it.
 */

export type VoidState = { ok: true } | { ok: false; message: string } | null;

export async function cancelBooking(
  _previous: VoidState,
  formData: FormData,
): Promise<VoidState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in first." };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured." };
  }

  const id = String(formData.get("bookingId") ?? "").trim();
  if (!id) return { ok: false, message: "Which booking?" };

  const reason =
    String(formData.get("reason") ?? "").trim().slice(0, 300) ||
    "Cancelled by the operator.";

  const db = getDb();

  const [booking] = await db
    .select({ id: bookings.id, ref: bookings.ref, groupRef: bookings.groupRef, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking) return { ok: false, message: "Booking not found." };
  if (booking.status === "completed") {
    return {
      ok: false,
      message: "That trip has already run — cancelling it would rewrite history.",
    };
  }

  // A multi-leg quote is cancelled whole. Leaving one leg of an itinerary live
  // would send a car for the middle of a trip nobody is taking.
  if (booking.groupRef) {
    await db
      .update(bookings)
      .set({
        status: "cancelled",
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.groupRef, booking.groupRef),
          ne(bookings.status, "completed"),
        ),
      );
    revalidatePath(`/quote/${booking.groupRef}`);
  } else {
    await db
      .update(bookings)
      .set({
        status: "cancelled",
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/booking/${booking.ref}`);
  return { ok: true };
}

/**
 * Puts a cancelled booking back. Someone will cancel the wrong row, and a
 * one-way door on an operations board is how a small mistake becomes a
 * re-typed quote and a confused traveller.
 */
export async function reinstateBooking(
  _previous: VoidState,
  formData: FormData,
): Promise<VoidState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in first." };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured." };
  }

  const id = String(formData.get("bookingId") ?? "").trim();
  if (!id) return { ok: false, message: "Which booking?" };

  const db = getDb();
  const [booking] = await db
    .select({ id: bookings.id, ref: bookings.ref, groupRef: bookings.groupRef, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking) return { ok: false, message: "Booking not found." };
  if (booking.status !== "cancelled") {
    return { ok: false, message: "That booking is not cancelled." };
  }

  // The money state is read back off the payments rows rather than guessed.
  // Assuming "pending_payment" would ask a traveller who has already paid to
  // pay again; assuming "confirmed" would mark a trip paid on the strength of
  // an undo. Only the payments table knows.
  const status = (await isSettled(db, booking)) ? "confirmed" : "pending_payment";

  const target = booking.groupRef
    ? and(eq(bookings.groupRef, booking.groupRef), eq(bookings.status, "cancelled"))
    : eq(bookings.id, booking.id);

  await db
    .update(bookings)
    .set({ status, cancellationReason: null, updatedAt: new Date() })
    .where(target);

  revalidatePath("/admin/bookings");
  revalidatePath(`/booking/${booking.ref}`);
  if (booking.groupRef) revalidatePath(`/quote/${booking.groupRef}`);
  return { ok: true };
}

/**
 * Marks a trip as having run.
 *
 * `completed` was in the enum and no code path reached it, so every trip ever
 * sold stayed `assigned` for ever. That is not a cosmetic gap: it is the
 * difference between revenue we expect and revenue we earned, it leaves the
 * dispatch board carrying jobs that happened weeks ago, and it means the
 * driver payout ledger has no idea which payouts are actually owed.
 *
 * Only a trip that has departed can be completed. Marking a future trip done
 * is always a mis-click, never an intention — and unlike cancelling, this one
 * is a door that does not reopen, because a completed trip is what the driver
 * gets paid against.
 */
export async function completeBooking(
  _previous: VoidState,
  formData: FormData,
): Promise<VoidState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in first." };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured." };
  }

  const id = String(formData.get("bookingId") ?? "").trim();
  if (!id) return { ok: false, message: "Which booking?" };

  const db = getDb();
  const [booking] = await db
    .select({
      id: bookings.id,
      ref: bookings.ref,
      groupRef: bookings.groupRef,
      status: bookings.status,
      scheduledAt: bookings.scheduledAt,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking) return { ok: false, message: "Booking not found." };
  if (booking.status === "completed") return { ok: true };
  if (booking.status === "cancelled") {
    return { ok: false, message: "That booking was cancelled." };
  }
  if (booking.status === "pending_payment") {
    return {
      ok: false,
      message:
        "Nobody has paid for that trip. Confirm the money first — completing it is what the driver is paid against.",
    };
  }
  if (booking.scheduledAt.getTime() > Date.now()) {
    return {
      ok: false,
      message: "That trip has not run yet.",
    };
  }

  // One leg at a time, unlike cancelling: an itinerary finishes leg by leg,
  // and a driver who has done the first two should not be waiting on the
  // third to be paid for them.
  await db
    .update(bookings)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(bookings.id, booking.id));

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/calendar");
  revalidatePath(`/booking/${booking.ref}`);
  if (booking.groupRef) revalidatePath(`/quote/${booking.groupRef}`);
  return { ok: true };
}


/**
 * Re-checks PayToday for one pending booking.
 *
 * This is intentionally an operator action rather than a "mark paid" control:
 * the gateway is queried and its reported amount must still match the payment
 * row before reconciliation can confirm the booking.
 */
export type PaymentReconcileState =
  | { ok: true; message: string; status: string }
  | { ok: false; message: string; status?: string }
  | null;

/**
 * Automatically re-checks a small set of pending bookings while the admin
 * bookings page is open. The client may trigger this action, but the server
 * still performs the admin authorization check and re-reads each booking
 * before asking PayToday anything.
 */
export type AutoPaymentReconcileResult = {
  ok: boolean;
  checked: number;
  changed: number;
  paid: number;
};

const AUTO_PAYMENT_TIMEOUT_MS = 5_000;

async function reconcileWithTimeout(bookingRef: string) {
  return Promise.race([
    reconcileBookingPayment(bookingRef),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("payment reconciliation timed out")),
        AUTO_PAYMENT_TIMEOUT_MS,
      ),
    ),
  ]);
}

export async function autoReconcilePayments(
  bookingRefs: string[],
): Promise<AutoPaymentReconcileResult> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, checked: 0, changed: 0, paid: 0 };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, checked: 0, changed: 0, paid: 0 };
  }

  const refs = [...new Set(
    bookingRefs
      .filter((ref): ref is string => typeof ref === "string")
      .map((ref) => ref.trim())
      .filter(Boolean),
  )].slice(0, 5);

  let checked = 0;
  let changed = 0;
  let paid = 0;

  for (const ref of refs) {
    try {
      const result = await reconcileWithTimeout(ref);
      checked += 1;
      if (result.changed) changed += 1;
      if (result.payment?.status === "paid") paid += 1;
    } catch (error) {
      console.error("[admin] automatic payment reconciliation failed for " + ref, error);
    }
  }

  if (changed > 0) {
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/calendar");
  }

  return { ok: true, checked, changed, paid };
}
export async function reconcilePayment(
  _previous: PaymentReconcileState,
  formData: FormData,
): Promise<PaymentReconcileState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in first." };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured." };
  }

  const id = String(formData.get("bookingId") ?? "").trim();
  if (!id) return { ok: false, message: "Which booking?" };

  const db = getDb();
  const [booking] = await db
    .select({
      id: bookings.id,
      ref: bookings.ref,
      status: bookings.status,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking) return { ok: false, message: "Booking not found." };

  if (booking.status !== "pending_payment") {
    return {
      ok: true,
      status: booking.status,
      message: `Booking is already ${booking.status.replace(/_/g, " ")}.`,
    };
  }

  try {
    const result = await reconcileBookingPayment(booking.ref);
    const status = result.payment?.status ?? "none";

    if (status === "paid") {
      return {
        ok: true,
        status,
        message: "PayToday reports this payment as paid. Booking confirmed.",
      };
    }

    if (status === "failed" || status === "cancelled") {
      return {
        ok: true,
        status,
        message: `PayToday reports the payment as ${status}. The booking remains unpaid.`,
      };
    }

    if (status === "pending" || status === "authorized") {
      return {
        ok: true,
        status,
        message: `PayToday still reports the payment as ${status}.`,
      };
    }

    return {
      ok: true,
      status,
      message: "No PayToday payment could be reconciled for this booking.",
    };
  } catch (error) {
    console.error(`[admin] payment reconciliation failed for ${booking.ref}`, error);
    return {
      ok: false,
      message: "Could not reach the payment gateway. Try again shortly.",
    };
  }
}
