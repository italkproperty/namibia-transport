import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers } from "@/db/schema";

export type QuoteGroup = {
  groupRef: string;
  customerName: string;
  customerWhatsapp: string;
  notes: string | null;
  legs: {
    /** Row id, for looking up the payment against this leg. */
    id: string;
    ref: string;
    pickupLabel: string;
    dropoffLabel: string;
    scheduledAt: Date;
    price: string;
    distanceKm: string | null;
    durationMin: number | null;
    status: string;
    /** `a-to-b` node pair, so an airport leg is identified by the node rather
     *  than by a display label that may name a lodge instead. */
    journeySlug: string | null;
    pickupDetail: string | null;
    travellerNotes: string | null;
    flightNumber: string | null;
    detailsUpdatedAt: Date | null;
  }[];
  total: string;
  currency: string;
  /** Every leg paid, so the trip is settled. */
  isPaid: boolean;
  isCancelled: boolean;
};

/**
 * One itinerary, read back as the traveller sees it.
 *
 * The legs are separate bookings because each is a separate driving job, and
 * they are summed here rather than stored as a total — a stored total is a
 * number that can drift away from the rows it is supposed to describe.
 */
export async function getQuoteGroup(
  groupRef: string,
): Promise<QuoteGroup | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const rows = await getDb()
      .select({
        booking: bookings,
        customerName: customers.fullName,
        customerWhatsapp: customers.whatsapp,
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .where(eq(bookings.groupRef, groupRef))
      .orderBy(asc(bookings.scheduledAt));

    if (rows.length === 0) return null;

    const total = rows
      .reduce((sum, row) => sum + Number(row.booking.customerPrice), 0)
      .toFixed(2);

    return {
      groupRef,
      customerName: rows[0].customerName,
      customerWhatsapp: rows[0].customerWhatsapp,
      notes: rows.find((row) => row.booking.notes)?.booking.notes ?? null,
      legs: rows.map((row) => ({
        id: row.booking.id,
        ref: row.booking.ref,
        pickupLabel: row.booking.pickupLabel,
        dropoffLabel: row.booking.dropoffLabel,
        scheduledAt: row.booking.scheduledAt,
        price: row.booking.customerPrice,
        distanceKm: row.booking.distanceKm,
        durationMin: row.booking.durationMin,
        status: row.booking.status,
        journeySlug: row.booking.journeySlug,
        pickupDetail: row.booking.pickupDetail,
        travellerNotes: row.booking.travellerNotes,
        flightNumber: row.booking.flightNumber,
        detailsUpdatedAt: row.booking.detailsUpdatedAt,
      })),
      total,
      currency: rows[0].booking.currency,
      isPaid: rows.every((row) =>
        ["confirmed", "assigned", "completed"].includes(row.booking.status),
      ),
      isCancelled: rows.every((row) => row.booking.status === "cancelled"),
    };
  } catch (error) {
    // A database without the group_ref column yet. Better a clean "not found"
    // than a 500 in front of someone holding a payment link.
    console.error("[quote] group lookup failed", error);
    return null;
  }
}
