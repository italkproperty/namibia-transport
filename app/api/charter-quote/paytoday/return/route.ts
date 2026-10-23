import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { charterQuotes, charterQuotePayments } from "@/db/schema";
import { getPaymentProvider, isLiveGatewayConfigured } from "@/lib/payments";
import { parseMoney } from "@/lib/money";
import { sendPaymentNotification } from "@/lib/payments/payment-notification";
import { issuePaidInvoice } from "@/lib/payments/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Return URL parameters are untrusted; settlement comes only from PayToday's query API. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(token)) {
    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  }
  const pageUrl = new URL(`/q/${token}`, request.url);
  if (!isDatabaseConfigured() || !isLiveGatewayConfigured()) {
    pageUrl.searchParams.set("payment", "contact");
    return NextResponse.redirect(pageUrl, { status: 303 });
  }

  try {
    const db = getDb();
    const [quote] = await db.select().from(charterQuotes)
      .where(eq(charterQuotes.publicToken, token)).limit(1);
    if (!quote) return NextResponse.redirect(new URL("/", request.url), { status: 303 });

    const [payment] = await db.select().from(charterQuotePayments)
      .where(and(eq(charterQuotePayments.quoteId, quote.id), eq(charterQuotePayments.status, "pending")))
      .orderBy(desc(charterQuotePayments.createdAt)).limit(1);

    if (payment?.providerReference) {
      const remote = await getPaymentProvider().getPayment(payment.providerReference);
      if (remote) {
        const matches = Math.abs(parseMoney(payment.amount) - parseMoney(remote.amount)) <= 0.009 &&
          remote.currency === payment.currency;
        const status = remote.status === "paid" && matches ? "paid" :
          remote.status === "failed" ? "failed" :
          remote.status === "cancelled" ? "cancelled" : "pending";
        const paidAt = status === "paid" ? (payment.paidAt ?? new Date()) : payment.paidAt;
        const [updated] = await db.update(charterQuotePayments).set({
          status,
          paidAt,
          raw: {
            ...(typeof payment.raw === "object" && payment.raw !== null ? payment.raw as Record<string, unknown> : {}),
            latestQuery: remote.raw ?? {},
            amountMismatch: remote.status === "paid" && !matches,
            reconciledAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        }).where(and(eq(charterQuotePayments.id, payment.id), eq(charterQuotePayments.status, "pending"))).returning();

        // Notify only for the request that successfully changes PENDING to PAID.
        if (updated && status === "paid") {
          await sendPaymentNotification({
            kind: "charter quote",
            reference: quote.quoteNumber,
            amount: updated.amount,
            currency: updated.currency,
            customerName: quote.customerName,
            customerEmail: quote.customerEmail,
            description: `Charter quotation ${quote.quoteNumber}`,
            paidAt: updated.paidAt,
          });
          await issuePaidInvoice({
            paymentType: "charter_quote",
            paymentId: updated.id,
            reference: quote.quoteNumber,
            amount: updated.amount,
            currency: updated.currency,
            customerName: quote.customerName,
            customerEmail: quote.customerEmail,
            description: `Charter quotation ${quote.quoteNumber}`,
            paidAt: updated.paidAt,
          });
        }
        pageUrl.searchParams.set("payment", status === "paid" ? "received" : status === "pending" ? "pending" : "contact");
      } else {
        pageUrl.searchParams.set("payment", "pending");
      }
    } else {
      pageUrl.searchParams.set("payment", "pending");
    }
  } catch (error) {
    console.error("[charter-payment] return reconciliation failed", error);
    pageUrl.searchParams.set("payment", "pending");
  }

  return NextResponse.redirect(pageUrl, { status: 303 });
}
