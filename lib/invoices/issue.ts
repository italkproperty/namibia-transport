import "server-only";

import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import {
  bookingGroupPayments,
  bookings,
  charterQuotePayments,
  charterQuotes,
  customers,
  invoices,
  payments,
  type Invoice,
} from "@/db/schema";
import { getVatRate } from "@/lib/company";
import { isMissingSchema, isUniqueViolation } from "@/lib/db-error";
import { formatDate, formatDateTime } from "@/lib/format";
import { getMessenger, invoiceHtml, invoiceSubject, invoiceText } from "@/lib/messaging";
import { SITE } from "@/lib/site";

import { invoiceLine, invoiceTotals, type InvoiceLine } from "./model";

/**
 * Issuing an invoice: the moment money is confirmed, a numbered record of
 * what it paid for, at a private link, emailed if we have an address.
 *
 * Idempotent on purpose. Confirmation runs from four places — an operator
 * pressing "money received", the gateway reconcile on a booking, the same on
 * an itinerary, and the charter return handler — and any of them can run
 * twice. The partial unique indexes on the table are the guarantee; this
 * module reads first to avoid the round trip and catches the violation when
 * two confirmations race, returning the row that won.
 *
 * Nothing here throws into a payment path. A payment confirmation that
 * succeeded must stay succeeded even if the invoice could not be written —
 * the operator sees the invoice missing on the booking and can issue it by
 * hand — so every failure comes back as a result, logged with its cause.
 */
export type IssueResult =
  | { ok: true; invoice: Invoice; created: boolean }
  | { ok: false; error: string; needsMigration: boolean };

export function publicInvoiceUrl(token: string): string {
  return `${SITE.url}/invoice/${encodeURIComponent(token)}`;
}

function failure(error: unknown, context: string): IssueResult {
  const needsMigration = isMissingSchema(error);
  console.error(`[invoices] ${context}`, error);
  return {
    ok: false,
    needsMigration,
    error: needsMigration
      ? "The invoices table does not exist yet. Run the invoices block at the bottom of db/manual/RUN-ME.sql in Supabase, then issue the invoice from the booking."
      : `Could not issue the invoice: ${error instanceof Error ? error.message : String(error)}`,
  };
}

type Draft = {
  kind: "booking" | "charter";
  groupRef: string | null;
  charterQuoteId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerWhatsapp: string | null;
  lines: InvoiceLine[];
  currency: string;
  paymentMethod: string;
  paymentReference: string | null;
  paidAt: Date;
  /** One line for the email, e.g. "Hosea Kutako to Windhoek, 12 Dec 2026". */
  summary: string;
};

async function insertInvoice(draft: Draft): Promise<Invoice> {
  const totals = invoiceTotals(draft.lines, getVatRate());
  const [row] = await getDb()
    .insert(invoices)
    .values({
      // The number is minted by the database inside this statement, so two
      // confirmations in the same second cannot collide and a rolled-back
      // insert leaves a gap rather than a duplicate.
      invoiceNumber: sql`'NT-INV-' || to_char(now() AT TIME ZONE 'Africa/Windhoek', 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 4, '0')`,
      kind: draft.kind,
      groupRef: draft.groupRef,
      charterQuoteId: draft.charterQuoteId,
      publicToken: randomBytes(12).toString("base64url"),
      customerName: draft.customerName,
      customerEmail: draft.customerEmail,
      customerWhatsapp: draft.customerWhatsapp,
      lines: draft.lines,
      subtotal: totals.subtotal,
      vatRate: String(totals.vatRate),
      vatAmount: totals.vatAmount,
      total: totals.total,
      currency: draft.currency,
      paymentMethod: draft.paymentMethod,
      paymentReference: draft.paymentReference,
      paidAt: draft.paidAt,
    })
    .returning();
  return row;
}

/** Best effort, after the row exists. A bounced email never un-issues an invoice. */
async function emailInvoice(invoice: Invoice, summary: string): Promise<void> {
  if (!invoice.customerEmail) return;
  try {
    const details = {
      invoiceNumber: invoice.invoiceNumber,
      fullName: invoice.customerName,
      total: invoice.total,
      currency: invoice.currency,
      url: publicInvoiceUrl(invoice.publicToken),
      paidOn: formatDate(invoice.paidAt),
      summary,
    };
    await getMessenger().send({
      to: { fullName: invoice.customerName, email: invoice.customerEmail, whatsapp: invoice.customerWhatsapp },
      channel: "email",
      subject: invoiceSubject(details),
      body: invoiceText(details),
      html: invoiceHtml(details),
    });
    await getDb()
      .update(invoices)
      .set({ emailedAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, invoice.id));
  } catch (error) {
    console.error(`[invoices] email for ${invoice.invoiceNumber} failed`, error);
  }
}

async function issue(
  draft: Draft,
  findExisting: () => Promise<Invoice | undefined>,
  context: string,
): Promise<IssueResult> {
  try {
    const existing = await findExisting();
    if (existing) return { ok: true, invoice: existing, created: false };
    const invoice = await insertInvoice(draft);
    await emailInvoice(invoice, draft.summary);
    console.info(`[invoices] issued ${invoice.invoiceNumber} for ${context}`);
    return { ok: true, invoice, created: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Lost a race with another confirmation; theirs is the invoice.
      const existing = await findExisting().catch(() => undefined);
      if (existing) return { ok: true, invoice: existing, created: false };
    }
    return failure(error, `issuing for ${context}`);
  }
}

/* ------------------------------------------------------------ bookings */

/**
 * The invoice for a booking's payment. A leg of an itinerary invoices the
 * whole itinerary — a trip is paid as a trip — keyed on the group reference;
 * a booking without a group is keyed on its own reference.
 */
export async function issueInvoiceForBooking(bookingId: string): Promise<IssueResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "No database configured.", needsMigration: false };
  const db = getDb();

  try {
    const [row] = await db
      .select({ booking: bookings, customer: customers })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!row) return { ok: false, error: "Booking not found.", needsMigration: false };

    const key = row.booking.groupRef ?? row.booking.ref;
    const legs = row.booking.groupRef
      ? await db
          .select()
          .from(bookings)
          .where(and(eq(bookings.groupRef, row.booking.groupRef), ne(bookings.status, "cancelled")))
          .orderBy(asc(bookings.scheduledAt))
      : [row.booking];
    if (legs.length === 0) return { ok: false, error: "Every leg of this trip is cancelled.", needsMigration: false };

    // The payment that settled it: a per-leg row (bank transfer or a single
    // booking's gateway intent) or the itinerary's gateway row.
    const [legPayment] = await db
      .select()
      .from(payments)
      .where(and(inArray(payments.bookingId, legs.map((leg) => leg.id)), eq(payments.status, "paid")))
      .orderBy(desc(payments.paidAt))
      .limit(1);
    const [groupPayment] = row.booking.groupRef
      ? await db
          .select()
          .from(bookingGroupPayments)
          .where(and(eq(bookingGroupPayments.groupRef, row.booking.groupRef), eq(bookingGroupPayments.status, "paid")))
          .orderBy(desc(bookingGroupPayments.paidAt))
          .limit(1)
      : [];
    const payment = legPayment ?? groupPayment;
    if (!payment) {
      return { ok: false, error: `No confirmed payment is recorded against ${key}, so there is nothing to invoice yet.`, needsMigration: false };
    }

    const lines = legs.map((leg) =>
      invoiceLine(
        `${leg.pickupLabel} to ${leg.dropoffLabel} · ${formatDateTime(leg.scheduledAt)} · ${leg.ref}`,
        leg.customerPrice,
      ),
    );
    const first = legs[0];
    const summary =
      legs.length === 1
        ? `${first.pickupLabel} to ${first.dropoffLabel}, ${formatDate(first.scheduledAt)}`
        : `${legs.length} legs from ${formatDate(first.scheduledAt)}, reference ${key}`;

    return issue(
      {
        kind: "booking",
        groupRef: key,
        charterQuoteId: null,
        customerName: row.customer.fullName,
        customerEmail: row.customer.email,
        customerWhatsapp: row.customer.whatsapp,
        lines,
        currency: row.booking.currency,
        paymentMethod: payment.provider,
        paymentReference: payment.providerReference ?? key,
        paidAt: payment.paidAt ?? new Date(),
        summary,
      },
      async () => (await db.select().from(invoices).where(eq(invoices.groupRef, key)).limit(1))[0],
      key,
    );
  } catch (error) {
    return failure(error, `reading booking ${bookingId}`);
  }
}

/* ------------------------------------------------------------- charter */

export async function issueInvoiceForCharter(quoteId: string): Promise<IssueResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "No database configured.", needsMigration: false };
  const db = getDb();

  try {
    const [quote] = await db.select().from(charterQuotes).where(eq(charterQuotes.id, quoteId)).limit(1);
    if (!quote) return { ok: false, error: "Charter quote not found.", needsMigration: false };

    const [payment] = await db
      .select()
      .from(charterQuotePayments)
      .where(and(eq(charterQuotePayments.quoteId, quote.id), eq(charterQuotePayments.status, "paid")))
      .orderBy(desc(charterQuotePayments.paidAt))
      .limit(1);
    if (!payment) {
      return { ok: false, error: `No confirmed payment is recorded against ${quote.quoteNumber}, so there is nothing to invoice yet.`, needsMigration: false };
    }

    const itinerary = (quote.itinerarySnapshot ?? {}) as { stops?: { label?: unknown }[] };
    const stops = Array.isArray(itinerary.stops)
      ? itinerary.stops.map((stop) => String(stop?.label ?? "").trim()).filter(Boolean)
      : [];
    const route = stops.length >= 2 ? `${stops[0]} to ${stops[stops.length - 1]}, ${stops.length} stops` : "as proposed";
    const lines = [invoiceLine(`Private charter ${quote.quoteNumber} · ${route}`, quote.total)];

    return issue(
      {
        kind: "charter",
        groupRef: null,
        charterQuoteId: quote.id,
        customerName: quote.customerName,
        customerEmail: quote.customerEmail,
        customerWhatsapp: quote.customerWhatsapp,
        lines,
        currency: quote.currency,
        paymentMethod: payment.provider,
        paymentReference: payment.providerReference ?? quote.quoteNumber,
        paidAt: payment.paidAt ?? new Date(),
        summary: `private charter ${quote.quoteNumber}`,
      },
      async () => (await db.select().from(invoices).where(eq(invoices.charterQuoteId, quote.id)).limit(1))[0],
      quote.quoteNumber,
    );
  } catch (error) {
    return failure(error, `reading charter quote ${quoteId}`);
  }
}

/* ------------------------------------------------------------- reading */

export async function getInvoiceByToken(token: string): Promise<Invoice | null> {
  if (!isDatabaseConfigured() || !/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  try {
    const [row] = await getDb().select().from(invoices).where(eq(invoices.publicToken, token)).limit(1);
    return row ?? null;
  } catch (error) {
    console.error("[invoices] read by token failed", error);
    return null;
  }
}

export type InvoiceLink = { invoiceNumber: string; url: string };

/**
 * Invoice links for a set of booking keys (group refs, or refs for bookings
 * without a group), for the admin list and the traveller's page. Empty, not
 * an error, when the table has not been created yet — the pages still
 * render, and issuing says what is missing.
 */
export async function invoiceLinksFor(keys: string[]): Promise<Map<string, InvoiceLink>> {
  const out = new Map<string, InvoiceLink>();
  const wanted = Array.from(new Set(keys.filter(Boolean)));
  if (!isDatabaseConfigured() || wanted.length === 0) return out;
  try {
    const rows = await getDb()
      .select({ groupRef: invoices.groupRef, invoiceNumber: invoices.invoiceNumber, token: invoices.publicToken })
      .from(invoices)
      .where(inArray(invoices.groupRef, wanted));
    for (const row of rows) {
      if (row.groupRef) out.set(row.groupRef, { invoiceNumber: row.invoiceNumber, url: publicInvoiceUrl(row.token) });
    }
  } catch (error) {
    if (!isMissingSchema(error)) console.error("[invoices] link lookup failed", error);
  }
  return out;
}

export async function invoiceLinkForCharter(quoteId: string): Promise<InvoiceLink | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const [row] = await getDb()
      .select({ invoiceNumber: invoices.invoiceNumber, token: invoices.publicToken })
      .from(invoices)
      .where(eq(invoices.charterQuoteId, quoteId))
      .limit(1);
    return row ? { invoiceNumber: row.invoiceNumber, url: publicInvoiceUrl(row.token) } : null;
  } catch (error) {
    if (!isMissingSchema(error)) console.error("[invoices] charter link lookup failed", error);
    return null;
  }
}
