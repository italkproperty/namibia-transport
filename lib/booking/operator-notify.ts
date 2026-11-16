import "server-only";

import { and, asc, eq, ne } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, charterQuotes, customers } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import {
  invoiceLinkForCharter,
  invoiceLinksFor,
  type InvoiceLink,
} from "@/lib/invoices/issue";
import { getMessenger } from "@/lib/messaging";
import { SITE } from "@/lib/site";

/**
 * Tell the operator the instant money lands.
 *
 * The booking-creation path already emails operations; this closes the other
 * half, which had no alert at all: a gateway payment used to confirm a trip,
 * issue an invoice, and tell nobody, so a paid trip could sit without a driver
 * until someone thought to open the admin panel. Money arriving is the one
 * event on the whole site that always needs a person, so it always sends.
 *
 * Like invoice issuance, this must never throw into a payment path — a
 * notification that fails cannot un-confirm a payment that succeeded. Every
 * failure is caught and logged, and a send that only reached the logging stub
 * (no SMTP configured) is logged as loudly as a thrown error, because from the
 * operator's chair "no email" and "email silently stubbed" are the same lost
 * trip.
 */

const ADMIN_URL = `${SITE.url}/admin/bookings`;

function operationsRecipient(): string {
  return process.env.BOOKING_NOTIFICATION_EMAIL?.trim() || "bookings@namibiatransport.com";
}

export type OperatorPaidInput = {
  kind: "transfer" | "charter";
  /** Booking group ref, single booking ref, or charter quote number. */
  reference: string;
  customerName: string;
  customerContact: string;
  /** One line per driving leg, already formatted. */
  legLines: string[];
  total: string;
  currency: string;
  paymentMethod: string;
  invoice: InvoiceLink | null;
};

/** The operator email, built purely so a test can read it without sending. */
export function operatorPaidEmail(input: OperatorPaidInput): { subject: string; body: string } {
  const subject = `PAID · ${input.reference} · ${input.currency} ${input.total} — assign a driver`;
  const body = [
    "PAYMENT RECEIVED",
    "",
    `Reference: ${input.reference}`,
    `Amount: ${input.currency} ${input.total}`,
    `Paid by: ${input.paymentMethod}`,
    `Customer: ${input.customerName}`,
    `Contact: ${input.customerContact}`,
    "",
    input.kind === "charter" ? "Charter itinerary:" : "Trip:",
    ...input.legLines.map((line) => `  ${line}`),
    "",
    input.invoice ? `Invoice: ${input.invoice.invoiceNumber} — ${input.invoice.url}` : "Invoice: not on file yet",
    "",
    "This trip is paid and needs a driver. Open the admin panel to assign one:",
    ADMIN_URL,
  ].join("\n");
  return { subject, body };
}

async function send(subject: string, body: string, context: string): Promise<void> {
  try {
    const to = operationsRecipient();
    const result = await getMessenger().send({
      to: { fullName: "Namibia Transport Operations", email: to },
      channel: "email",
      subject,
      body,
    });
    if (!result.delivered) {
      console.error(
        `[payments] PAID alert for ${context} was NOT emailed (provider=${result.provider}). ` +
          `Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and MAIL_FROM in Vercel, ` +
          `and set BOOKING_NOTIFICATION_EMAIL to a mailbox you watch. Money has arrived for ${context} — assign a driver from ${ADMIN_URL}.`,
      );
    } else {
      console.info(`[payments] PAID alert emailed to operations for ${context} via ${result.provider}`);
    }
  } catch (error) {
    console.error(`[payments] PAID alert for ${context} failed to send`, error);
  }
}

/** A gateway transfer (single booking or whole itinerary) was paid. */
export async function notifyOperatorBookingPaid(bookingId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const db = getDb();
    const [row] = await db
      .select({ booking: bookings, customer: customers })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!row) return;

    const key = row.booking.groupRef ?? row.booking.ref;
    const legs = row.booking.groupRef
      ? await db
          .select()
          .from(bookings)
          .where(and(eq(bookings.groupRef, row.booking.groupRef), ne(bookings.status, "cancelled")))
          .orderBy(asc(bookings.scheduledAt))
      : [row.booking];
    if (legs.length === 0) return;

    const total = legs.reduce((sum, leg) => sum + Number(leg.customerPrice), 0).toFixed(2);
    const invoice = (await invoiceLinksFor([key])).get(key) ?? null;
    const legLines = legs.map(
      (leg) => `${leg.pickupLabel} → ${leg.dropoffLabel} · ${formatDateTime(leg.scheduledAt)} · ${leg.ref}`,
    );

    const { subject, body } = operatorPaidEmail({
      kind: "transfer",
      reference: key,
      customerName: row.customer.fullName,
      customerContact: row.customer.whatsapp || row.customer.email || "no contact on file",
      legLines,
      total,
      currency: row.booking.currency,
      paymentMethod: "card / online gateway",
      invoice,
    });
    await send(subject, body, key);
  } catch (error) {
    console.error(`[payments] PAID alert lookup failed for booking ${bookingId}`, error);
  }
}

/** A charter quote was paid through the gateway. */
export async function notifyOperatorCharterPaid(quoteId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const db = getDb();
    const [quote] = await db.select().from(charterQuotes).where(eq(charterQuotes.id, quoteId)).limit(1);
    if (!quote) return;

    const itinerary = (quote.itinerarySnapshot ?? {}) as { stops?: { label?: unknown }[] };
    const stops = Array.isArray(itinerary.stops)
      ? itinerary.stops.map((stop) => String(stop?.label ?? "").trim()).filter(Boolean)
      : [];
    const legLines = stops.length ? stops.map((stop, i) => `${i + 1}. ${stop}`) : ["See the saved quote for the itinerary."];
    const invoice = await invoiceLinkForCharter(quote.id);

    const { subject, body } = operatorPaidEmail({
      kind: "charter",
      reference: quote.quoteNumber,
      customerName: quote.customerName,
      customerContact: quote.customerWhatsapp || quote.customerEmail || "no contact on file",
      legLines,
      total: quote.total,
      currency: quote.currency,
      paymentMethod: "card / online gateway",
      invoice,
    });
    await send(subject, body, quote.quoteNumber);
  } catch (error) {
    console.error(`[payments] PAID alert lookup failed for charter ${quoteId}`, error);
  }
}
