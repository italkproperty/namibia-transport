"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb, isDatabaseConfigured } from "@/db";
import { charterQuotePayments, charterQuotes } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { issueInvoiceForBooking, issueInvoiceForCharter } from "@/lib/invoices/issue";
import { BANK_TRANSFER_PROVIDER } from "@/lib/payments/transfer";

export type InvoiceActionState =
  | { ok: true; invoiceNumber: string; url: string; created: boolean }
  | { ok: false; message: string }
  | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Issue (or re-find) the invoice for a paid booking by hand.
 *
 * The automatic issue runs when a payment is confirmed; this exists for the
 * bookings paid before invoices existed, and for the day the automatic one
 * failed — a missing table, a dead connection — and the operator needs the
 * document now.
 */
export async function issueBookingInvoiceAction(
  _previous: InvoiceActionState,
  form: FormData,
): Promise<InvoiceActionState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in first." };
  const bookingId = String(form.get("bookingId") ?? "");
  if (!UUID.test(bookingId)) return { ok: false, message: "No booking was named." };

  const result = await issueInvoiceForBooking(bookingId);
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/admin/bookings");
  const { publicInvoiceUrl } = await import("@/lib/invoices/issue");
  return { ok: true, invoiceNumber: result.invoice.invoiceNumber, url: publicInvoiceUrl(result.invoice.publicToken), created: result.created };
}

/**
 * An operator saw a charter's bank transfer on the statement.
 *
 * The charter ledger only ever heard from the gateway, so a traveller who
 * paid the way every traveller currently pays — by transfer — had no way
 * to be marked paid, and no invoice. This records the transfer as a paid
 * ledger row, which is what the public page and the invoice read, and
 * issues the invoice. Only a human marks money received; the gate above
 * is the whole of that rule.
 */
export async function confirmCharterTransferAction(
  _previous: InvoiceActionState,
  form: FormData,
): Promise<InvoiceActionState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in first." };
  if (!isDatabaseConfigured()) return { ok: false, message: "No database is configured on this deployment." };
  const quoteId = String(form.get("quoteId") ?? "");
  if (!UUID.test(quoteId)) return { ok: false, message: "The quote reference is invalid." };

  try {
    const db = getDb();
    const [quote] = await db.select().from(charterQuotes).where(eq(charterQuotes.id, quoteId)).limit(1);
    if (!quote) return { ok: false, message: "Charter quote not found." };
    if (quote.status !== "sent") {
      return { ok: false, message: `This quote is ${quote.status}, not issued to the customer. Issue it first, then record the payment.` };
    }
    const [alreadyPaid] = await db
      .select({ id: charterQuotePayments.id })
      .from(charterQuotePayments)
      .where(and(eq(charterQuotePayments.quoteId, quote.id), eq(charterQuotePayments.status, "paid")))
      .orderBy(desc(charterQuotePayments.createdAt))
      .limit(1);
    if (!alreadyPaid) {
      const now = new Date();
      await db.insert(charterQuotePayments).values({
        quoteId: quote.id,
        provider: BANK_TRANSFER_PROVIDER,
        providerReference: quote.quoteNumber,
        status: "paid",
        amount: quote.total,
        currency: quote.currency,
        paidAt: now,
        raw: { confirmedAt: now.toISOString(), confirmedBy: "admin" },
      });
    }
  } catch (error) {
    console.error("[charter-payment] recording a transfer failed", error);
    return { ok: false, message: "The database refused that. Nothing has been marked paid — check the logs." };
  }

  const result = await issueInvoiceForCharter(quoteId);
  revalidatePath(`/admin/quotes/charter/drafts/${quoteId}`);
  if (!result.ok) return { ok: false, message: `Payment recorded, but no invoice: ${result.error}` };
  const { publicInvoiceUrl } = await import("@/lib/invoices/issue");
  return { ok: true, invoiceNumber: result.invoice.invoiceNumber, url: publicInvoiceUrl(result.invoice.publicToken), created: result.created };
}
