import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers, payments } from "@/db/schema";
import { BANK_TRANSFER_PROVIDER } from "@/lib/payments/transfer";
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";

export type PendingTransfer = {
  bookingId: string;
  ref: string;
  customerName: string;
  customerWhatsapp: string | null;
  customerEmail: string | null;
  amount: string;
  currency: string;
  pickupLabel: string;
  dropoffLabel: string;
  scheduledAt: Date;
  declaredAt: string | null;
  note: string | null;
};

export async function listPendingTransfers(): Promise<PendingTransfer[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const rows = await withDeadline("pending transfer list", READ_DEADLINE_MS, () =>
      getDb()
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
            eq(payments.status, "pending"),
            ne(bookings.status, "cancelled"),
          ),
        )
        .orderBy(desc(payments.createdAt)),
    );

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
  } catch (error) {
    console.error("[admin] pending transfer list failed", error);
    return [];
  }
}
