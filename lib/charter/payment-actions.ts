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

/** Create or resume a PayToday checkout for the saved charter total. */
export async function startCharterPaymentAction(formData: FormData): Promise<never> {
  const token = String(formData.get("token") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(token)) redirect("/");

  if (!isDatabaseConfigured()) redirect(`/charter-quote/${token}?payment=unavailable`);
  if (!isLiveGatewayConfigured()) redirect(`/charter-quote/${token}?payment=contact`);

  const db = getDb();
  const [quote] = await db.select().from(charterQuotes)
    .where(eq(charterQuotes.publicToken, token)).limit(1);
  if (!quote || quote.status !== "sent" || !quote.validUntil || quote.validUntil.getTime() <= Date.now()) {
    redirect("/");
  }

  const [settled] = await db.select({ id: charterQuotePayments.id })
    .from(charterQuotePayments).where(and(eq(charterQuotePayments.quoteId, quote.id), eq(charterQuotePayments.status, "paid")))
    .limit(1);
  if (settled) redirect(`/charter-quote/${token}?payment=received`);

  const [existing] = await db.select().from(charterQuotePayments)
    .where(and(eq(charterQuotePayments.quoteId, quote.id), eq(charterQuotePayments.status, "pending")))
    .orderBy(desc(charterQuotePayments.createdAt)).limit(1);

  if (existing?.checkoutUrl && existing.expiresAt && existing.expiresAt.getTime() > Date.now()) {
    redirect(existing.checkoutUrl);
  }

  try {
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
      redirect(`/charter-quote/${token}?payment=unavailable`);
    }

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
    // Next.js redirect() throws; preserve redirects instead of swallowing them.
    if (error && typeof error === "object" && "digest" in error &&
        typeof (error as { digest?: unknown }).digest === "string" &&
        (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")) throw error;
    console.error("[charter-payment] checkout initiation failed", error);
    redirect(`/charter-quote/${token}?payment=unavailable`);
  }
}
