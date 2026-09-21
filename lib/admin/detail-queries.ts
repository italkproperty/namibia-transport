import "server-only";

import { and, desc, gte, isNotNull, ne } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers } from "@/db/schema";
import { eq } from "drizzle-orm";

export type SubmittedDetails = {
  ref: string;
  customerName: string;
  pickupLabel: string;
  dropoffLabel: string;
  scheduledAt: Date;
  detailsUpdatedAt: Date;
  pickupDetail: string | null;
  travellerNotes: string | null;
  flightNumber: string | null;
};

/** How long a submission stays on the board before it is just history. */
const RECENT_DAYS = 14;

/**
 * Details travellers have filled in recently, newest first.
 *
 * Bounded by time rather than by an acknowledged flag: a flag needs somebody
 * to clear it, and an operations board that accumulates unread markers gets
 * ignored wholesale. Anything older than a fortnight is on the booking itself
 * and on the driver's job card, which is where it belongs by then.
 */
export async function listSubmittedDetails(): Promise<SubmittedDetails[]> {
  if (!isDatabaseConfigured()) return [];

  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000);

  try {
    const rows = await getDb()
      .select({
        ref: bookings.ref,
        customerName: customers.fullName,
        pickupLabel: bookings.pickupLabel,
        dropoffLabel: bookings.dropoffLabel,
        scheduledAt: bookings.scheduledAt,
        detailsUpdatedAt: bookings.detailsUpdatedAt,
        pickupDetail: bookings.pickupDetail,
        travellerNotes: bookings.travellerNotes,
        flightNumber: bookings.flightNumber,
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .where(
        and(
          isNotNull(bookings.detailsUpdatedAt),
          gte(bookings.detailsUpdatedAt, since),
          ne(bookings.status, "cancelled"),
        ),
      )
      .orderBy(desc(bookings.detailsUpdatedAt))
      .limit(20);

    return rows.filter(
      (row): row is SubmittedDetails => row.detailsUpdatedAt !== null,
    );
  } catch (error) {
    // A database without the columns yet. The board is worth more up than down.
    console.error("[admin] traveller details lookup failed", error);
    return [];
  }
}
