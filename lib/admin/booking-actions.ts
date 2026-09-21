"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";

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

  // Back to pending_payment rather than to whatever it was: the money state is
  // re-derived from the payments rows, and guessing "confirmed" here would
  // mark a trip paid on the strength of an undo.
  const target = booking.groupRef
    ? and(eq(bookings.groupRef, booking.groupRef), eq(bookings.status, "cancelled"))
    : eq(bookings.id, booking.id);

  await db
    .update(bookings)
    .set({ status: "pending_payment", cancellationReason: null, updatedAt: new Date() })
    .where(target);

  revalidatePath("/admin/bookings");
  revalidatePath(`/booking/${booking.ref}`);
  if (booking.groupRef) revalidatePath(`/quote/${booking.groupRef}`);
  return { ok: true };
}
