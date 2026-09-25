import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { bookings, payments } from "@/db/schema";

/**
 * Whether money has landed for this booking, or for the trip it belongs to.
 *
 * Lives here rather than in `booking-actions.ts` because that file is
 * `"use server"`, and every export in one of those is a public endpoint
 * whether or not a page calls it. This is a guard the edit path and the
 * cancel path both rely on; publishing it as an action was an accident of
 * needing it in two places, and an accident is exactly how a guard becomes
 * something an attacker can call.
 *
 * It reads the `payments` table rather than the booking's own status, because
 * a booking's status is overwritten by assignment and cancellation and cannot
 * be trusted to remember whether money arrived.
 */
/** Whether money has landed for this booking, or for the trip it belongs to. */
export async function isSettled(
  db: ReturnType<typeof getDb>,
  booking: { id: string; groupRef: string | null },
): Promise<boolean> {
  const ids = booking.groupRef
    ? (
        await db
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.groupRef, booking.groupRef))
      ).map((row) => row.id)
    : [booking.id];

  const [paid] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(inArray(payments.bookingId, ids), eq(payments.status, "paid")))
    .limit(1);

  return Boolean(paid);
}

