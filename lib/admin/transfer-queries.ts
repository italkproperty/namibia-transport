import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers, payments } from "@/db/schema";
import { BANK_TRANSFER_PROVIDER } from "@/lib/payments/transfer";

export type PendingTransfer = {
  bookingId: string;
  ref: string;
  customerName: string;
  /** Null when the traveller gave us an email instead. */
  customerWhatsapp: string | null;
  /** The fallback the operator contacts them on when there is no WhatsApp. */
  customerEmail: string | null;
  amount: string;
  currency: string;
  pickupLabel: string;
  dropoffLabel: string;
  scheduledAt: Date;
  declaredAt: string | null;
  note: string | null;
};

/**
 * Transfers a traveller says they have made, which nobody has matched to the
 * statement yet.
 *
 * This is a to-do list, not a ledger: everything on it is money we have been
 * told about and have not seen. It is ordered oldest first deliberately — the
 * one that has been waiting longest is the one most likely to be a traveller
 * wondering whether we received it.
 */
export async function listPendingTransfers(): Promise<PendingTransfer[]> {
  if (!isDatabaseConfigured()) return [];

  const db = getDb();

  const rows = await db
    .select({
      bookingId: bookings.id,
      ref: bookings.ref,
      customerName: customers.fullName,
      customerWhatsapp: customers.whatsapp,
      customerEmail: customers.email,
      amount: payments.amount,
      currency: payments.currency,
      pickupLabel: bookings.pickupLabel,
      dropoffLabel: bookings.dropoffLabel,
      scheduledAt: bookings.scheduledAt,
      raw: payments.raw,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(
      and(
        eq(payments.provider, BANK_TRANSFER_PROVIDER),
        // Anything not yet settled. A refunded or cancelled payment is a
        // different conversation and does not belong on a to-do list.
        eq(payments.status, "pending"),
        ne(bookings.status, "cancelled"),
      ),
    )
    .orderBy(desc(payments.createdAt));

  return rows
    .map((row) => {
      const raw =
        (row.raw as { declaredAt?: string; note?: string } | null) ?? {};
      return {
        bookingId: row.bookingId,
        ref: row.ref,
        customerName: row.customerName,
        customerWhatsapp: row.customerWhatsapp,
        customerEmail: row.customerEmail,
        amount: row.amount,
        currency: row.currency,
        pickupLabel: row.pickupLabel,
        dropoffLabel: row.dropoffLabel,
        scheduledAt: row.scheduledAt,
        declaredAt: raw.declaredAt ?? null,
        note: raw.note ?? null,
      };
    })
    .filter((row) => row.declaredAt !== null)
    .sort((a, b) => (a.declaredAt ?? "").localeCompare(b.declaredAt ?? ""));
}
