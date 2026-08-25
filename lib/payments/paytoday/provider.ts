import "server-only";

import { toMoneyString } from "@/lib/money";
import { SITE } from "@/lib/site";

import { getPayTodayConfig, INTENT_TTL_MS } from "./config";
import { getPayTodaySdk } from "./sdk";
import {
  mapTransactionStatus,
  normalisePhone,
  splitName,
  type QueryIntentResponse,
} from "./types";
import type {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
} from "../types";

/**
 * PayToday (Nedbank Namibia) — the live gateway.
 *
 * Stripe and Paddle do not serve Namibian entities; PayToday settles in NAD
 * and takes international cards, which is why it replaced the DPO Pay plan.
 * Everything here runs server-side: the traveller's browser only ever receives
 * the hosted `payment_url`, never a credential.
 *
 * Two things this adapter does NOT do, deliberately:
 *   · trust the `?status=` PayToday appends to the return URL — anyone can type
 *     that. Status is only ever read back from queryPaymentIntent().
 *   · treat an unrecognised status as terminal. See mapTransactionStatus.
 */
export class PayTodayPaymentProvider implements PaymentProvider {
  readonly name = "paytoday";

  async createPayment(input: PaymentIntentInput): Promise<PaymentIntent> {
    const config = getPayTodayConfig();
    if (!config) {
      throw new Error("PayToday is not configured.");
    }

    const sdk = await getPayTodaySdk();
    const { firstName, lastName } = splitName(input.customer.fullName);

    // PayToday requires an e-mail on the intent, but our booking form keeps it
    // optional to stay at two taps. Fall back to the operator's address so the
    // receipt lands somewhere real rather than failing the payment outright.
    const email =
      input.customer.email?.trim() ||
      process.env.PAYTODAY_FALLBACK_EMAIL?.trim() ||
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
      "";

    if (!email) {
      throw new Error(
        "PayToday needs an e-mail address on the payment intent — set PAYTODAY_FALLBACK_EMAIL or collect one on the form."
      );
    }

    const response = await sdk.createPaymentIntent({
      // Major units. The Business Portal reference reports transaction amounts
      // as "150.00", so PayToday counts rands, not cents.
      amount: Number(input.amount),
      invoice_number: input.bookingRef,
      user_first_name: firstName,
      user_last_name: lastName,
      user_email: email,
      user_phone_number: normalisePhone(input.customer.whatsapp),
      return_url: input.returnUrl ?? defaultReturnUrl(input.bookingRef),
    });

    const token = response?.data?.payment_intent_token;
    const paymentUrl = response?.data?.payment_url ?? null;

    // Without the token there is no way to ever reconcile this payment, so a
    // missing one is a hard failure rather than something to paper over.
    if (typeof token !== "string" || token.length === 0) {
      throw new Error(
        "PayToday did not return a payment_intent_token; the payment cannot be tracked."
      );
    }

    return {
      provider: this.name,
      providerReference: token,
      status: "pending",
      amount: input.amount,
      currency: input.currency,
      redirectUrl: typeof paymentUrl === "string" ? paymentUrl : null,
      raw: {
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + INTENT_TTL_MS).toISOString(),
        bookingRef: input.bookingRef,
        environment: config.environment,
        response: response as Record<string, unknown>,
      },
    };
  }

  /**
   * The authoritative read. The Payment Intent Query guide calls this the way
   * to settle the case the return URL cannot cover: the traveller pays, then
   * closes the tab before being redirected back.
   */
  async getPayment(providerReference: string): Promise<PaymentIntent | null> {
    const sdk = await getPayTodaySdk();
    const response: QueryIntentResponse =
      await sdk.queryPaymentIntent(providerReference);

    const intent = response?.data?.intent;
    if (!intent) return null;

    const status = mapTransactionStatus(intent.transaction_status);
    const amount =
      intent.amount === undefined || intent.amount === null
        ? "0.00"
        : safeMoney(intent.amount);

    return {
      provider: this.name,
      providerReference:
        typeof intent.payment_token === "string"
          ? intent.payment_token
          : providerReference,
      status,
      amount,
      currency: "NAD",
      redirectUrl: null,
      raw: {
        queriedAt: new Date().toISOString(),
        transactionStatus: intent.transaction_status ?? null,
        transactionData: intent.transaction_data ?? null,
        invoiceNumber: intent.invoice_number ?? null,
        response: response as Record<string, unknown>,
      },
    };
  }
}

function safeMoney(value: number | string): string {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? toMoneyString(amount) : "0.00";
}

/** Where PayToday sends the traveller once they are done paying. */
export function defaultReturnUrl(bookingRef: string): string {
  const base = SITE.url.replace(/\/+$/, "");

  // Localhost is correct in development — the redirect happens in the
  // traveller's own browser. In production it means NEXT_PUBLIC_SITE_URL was
  // never set, and every payment would come back to a machine that is not
  // ours. Loud, because the symptom otherwise appears days later as an
  // unexplained pile of unreconciled bookings.
  if (
    process.env.NODE_ENV === "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)/.test(base)
  ) {
    console.error(
      `[payments] NEXT_PUBLIC_SITE_URL is unset or local (${base}) — PayToday will return travellers to localhost and payments will not reconcile.`
    );
  }

  return `${base}/api/payments/paytoday/return?ref=${encodeURIComponent(bookingRef)}`;
}
