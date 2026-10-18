"use server";

import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, isDatabaseConfigured } from "@/db";
import { charterQuotes, charterQuotePayments } from "@/db/schema";
import { getPaymentProvider, isLiveGatewayConfigured } from "@/lib/payments";
import { INTENT_TTL_MS } from "@/lib/payments/paytoday/config";

function publicOrigin(): string {
  const previewHost = process.env.VERCEL_URL?.trim();
  if (process.env.VERCEL_ENV !== "production" && previewHost) return `https://${previewHost}`;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) throw new Error("NEXT_PUBLIC_SITE_URL must be configured before taking payments.");
  const url = new URL(configured);
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("The public site URL must use HTTPS for payments.");
  }
  return url.origin;
}

function preserveRedirect(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT"),
  );
}

function returnToQuote(token: string, reason: string): never {
  redirect(`/charter-quote/${token}?payment=${encodeURIComponent(reason)}`);
}

/** Create or resume a PayToday checkout for the saved charter total. */
export async function startCharterPaymentAction(formData: FormData): Promise<never> {
  const token = String(formData.get("token") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(token)) redirect("/");

  if (!isDatabaseConfigured()) {
    console.error("[charter-payment] checkout blocked: database_not_configured");
    returnToQuote(token, "database");
  }
  if (!isLiveGatewayConfigured()) {
    console.error("[charter-payment] checkout blocked: gateway_not_configured");
    returnToQuote(token, "gateway");
  }

  let stage = "database_read";
  try {
    const db = getDb();
    const [quote] = await db.select().from(charterQuotes)
      .where(eq(charterQuotes.publicToken, token)).limit(1);

    if (!quote || quote.status !== "sent" || !quote.validUntil || quote.validUntil.getTime() <= Date.now()) {
      console.error("[charter-payment] checkout blocked: quote_invalid_or_expired");
      redirect("/");
    }

    stage = "customer_validation";
    if (!quote.customerWhatsapp?.trim() || !/^\\+?[0-9 ()-]{7,20}$/.test(quote.customerWhatsapp.trim())) {
      console.error("[charter-payment] checkout blocked: customer_mobile_missing_or_invalid", { quoteNumber: quote.quoteNumber });
      returnToQuote(token, "mobile");
    }
    if (!quote.customerEmail?.trim() && !process.env.PAYTODAY_FALLBACK_EMAIL?.trim() && !process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()) {
      console.error("[charter-payment] checkout blocked: customer_email_missing", { quoteNumber: quote.quoteNumber });
      returnToQuote(token, "email");
    }

    stage = "payment_ledger_read";
    const [settled] = await db.select({ id: charterQuotePayments.id })
      .from(charterQuotePayments)
      .where(and(eq(charterQuotePayments.quoteId, quote.id), eq(charterQuotePayments.status, "paid")))
      .limit(1);
    if (settled) returnToQuote(token, "received");

    const [existing] = await db.select().from(charterQuotePayments)
      .where(and(eq(charterQuotePayments.quoteId, quote.id), eq(charterQuotePayments.status, "pending")))
      .orderBy(desc(charterQuotePayments.createdAt)).limit(1);

    if (existing?.checkoutUrl && existing.expiresAt && existing.expiresAt.getTime() > Date.now()) {
      redirect(existing.checkoutUrl);
    }

    stage = "gateway_create_intent";
    const origin = publicOrigin();
    const provider = getPaymentProvider();
    const intent = await provider.createPayment({
      bookingId: quote.id,
      bookingRef: quote.quoteNumber,
      amount: quote.total,
      currency: quote.currency,
      customer: {
        fullName: quote.customerName,
        email: quote.customerEmail,
        whatsapp: quote.customerWhatsapp,
      },
      description: `Charter proposal ${quote.quoteNumber}`,
      returnUrl: `${origin}/api/charter-quote/paytoday/return?token=${encodeURIComponent(token)}`,
    });

    if (!intent.redirectUrl || !intent.providerReference) {
      console.error("[charter-payment] gateway returned incomplete checkout intent", {
        quoteNumber: quote.quoteNumber,
        provider: intent.provider,
        hasRedirectUrl: Boolean(intent.redirectUrl),
        hasProviderReference: Boolean(intent.providerReference),
      });
      returnToQuote(token, "gateway_response");
    }

    stage = "payment_ledger_write";
    await db.insert(charterQuotePayments).values({
      quoteId: quote.id,
      provider: intent.provider,
      providerReference: intent.providerReference,
      status: intent.status === "paid" ? "paid" : "pending",
      amount: quote.total,
      currency: quote.currency,
      checkoutUrl: intent.redirectUrl,
      expiresAt: new Date(Date.now() + INTENT_TTL_MS),
      raw: intent.raw,
      paidAt: intent.status === "paid" ? new Date() : null,
    });

    redirect(intent.redirectUrl);
  } catch (error) {
    if (preserveRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : "Unknown checkout error";
    console.error("[charter-payment] checkout initiation failed", {
      stage,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: message.slice(0, 500),
    });
    returnToQuote(token, stage === "payment_ledger_read" || stage === "payment_ledger_write" ? "ledger" : "gateway_error");
  }
}
