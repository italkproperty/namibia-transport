import "server-only";

import { and, desc, gte, isNotNull, ne } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";

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

const RECENT_DAYS = 14;

export async function listSubmittedDetails(): Promise<SubmittedDetails[]> {
  if (!isDatabaseConfigured()) return [];

  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000);

  try {
    const rows = await withDeadline("traveller details list", READ_DEADLINE_MS, () =>
      getDb()
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
        .limit(20),
    );

    return rows.filter(
      (row): row is SubmittedDetails => row.detailsUpdatedAt !== null,
    );
  } catch (error) {
    console.error("[admin] traveller details lookup failed", error);
    return [];
  }
}
