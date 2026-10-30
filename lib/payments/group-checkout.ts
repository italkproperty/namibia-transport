"use server";

import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookingGroupPayments, bookings, customers } from "@/db/schema";
import { parseMoney, toMoneyString } from "@/lib/money";
import { groupValidity } from "@/lib/booking/validity";
import { SITE } from "@/lib/site";

import { INTENT_TTL_MS } from "./paytoday/config";
import { getPaymentProvider } from "./index";
import type { PaymentProvider } from "./types";

const GROUP_REF_PATTERN = /^NT-G-[ABCDEFGHJKLMNPQRTUVWXY2346789]{6}$/;

function groupReturnUrl(groupRef: string): string {
  const base = SITE.url.replace(/\/+$/, "");
  if (
    process.env.NODE_ENV === "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)/.test(base)
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be set to the production domain.");
  }
  return `${base}/api/payments/paytoday/group-return?ref=${encodeURIComponent(groupRef)}`;
}

function isExpired(expiresAt: Date | null): boolean {
  return expiresAt !== null && expiresAt.getTime() <= Date.now();
}

export type GroupCheckoutState = { error: string } | null;

/**
 * Server-side checkout for a whole itinerary. The amount is recomputed from
 * every booking row; the browser supplies only the opaque group reference.
 */
export async function getOrCreateGroupCheckout(
  groupRef: string,
  provider?: PaymentProvider,
): Promise<{ url: string } | { error: string }> {
  if (!GROUP_REF_PATTERN.test(groupRef)) {
    return { error: "We could not find that quote." };
  }
  if (!isDatabaseConfigured()) {
    return { error: "Online payments are temporarily unavailable. Please use the bank transfer option." };
  }

  const db = getDb();
  const rows = await db
    .select({
      booking: bookings,
      customerName: customers.fullName,
      customerEmail: customers.email,
      customerWhatsapp: customers.whatsapp,
      customerId: customers.id,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(eq(bookings.groupRef, groupRef))
    .orderBy(asc(bookings.scheduledAt));

  if (rows.length === 0) return { error: "We could not find that quote." };
  if (rows.some(({ booking }) => booking.status === "cancelled")) {
    return { error: "This itinerary has been cancelled. Please contact us for assistance." };
  }
  if (groupValidity(rows.map(({ booking }) => ({ scheduledAt: booking.scheduledAt, createdAt: booking.createdAt, status: booking.status }))).expired) {
    return { error: "This quote has expired. Please contact us for an updated price." };
  }
  if (rows.some(({ booking }) => booking.status !== "pending_payment")) {
    return { error: "This itinerary is not awaiting payment. Please contact us if you believe this is incorrect." };
  }
  if (new Set(rows.map((row) => row.customerId)).size !== 1) {
    return { error: "The traveller details for this itinerary need attention. Please contact us." };
  }
  if (new Set(rows.map((row) => row.booking.currency)).size !== 1) {
    return { error: "The itinerary contains inconsistent currencies. Please contact us." };
  }

  // Sum integer cents to avoid floating-point accumulation across legs.
  const totalCents = rows.reduce(
    (sum, row) => sum + Math.round(parseMoney(row.booking.customerPrice) * 100),
    0,
  );
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    return { error: "The quote total is invalid. Please contact us." };
  }
  const total = toMoneyString(totalCents / 100);
  const currency = rows[0].booking.currency;
  if (currency !== "NAD") {
    return { error: "Online card checkout is currently available in Namibian dollars only." };
  }

  const [existing] = await db
    .select()
    .from(bookingGroupPayments)
    .where(eq(bookingGroupPayments.groupRef, groupRef))
    .orderBy(desc(bookingGroupPayments.createdAt))
    .limit(1);

  if (existing?.status === "paid") {
    return { error: "This itinerary has already been paid." };
  }
  if (existing?.status === "pending" && existing.checkoutUrl && !isExpired(existing.expiresAt)) {
    return { url: existing.checkoutUrl };
  }

  try {
    const first = rows[0];
    const paymentProvider = provider ?? getPaymentProvider();
    const intent = await paymentProvider.createPayment({
      bookingId: first.booking.id,
      // PayToday uses this as its invoice reference. The group reference is
      // stable, unique to the itinerary, and returned unchanged by the gateway.
      bookingRef: groupRef,
      amount: total,
      currency,
      customer: {
        fullName: first.customerName,
        email: first.customerEmail,
        whatsapp: first.customerWhatsapp,
      },
      description: `Namibia Transport itinerary ${groupRef} (${rows.length} legs)`,
      returnUrl: groupReturnUrl(groupRef),
    });

    if (!intent.redirectUrl) {
      return { error: "The payment gateway did not return a secure payment page. Please use bank transfer or contact us." };
    }

    await db.insert(bookingGroupPayments).values({
      groupRef,
      provider: intent.provider,
      providerReference: intent.providerReference,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
      checkoutUrl: intent.redirectUrl,
      expiresAt: new Date(Date.now() + INTENT_TTL_MS),
      raw: intent.raw,
    });

    return { url: intent.redirectUrl };
  } catch (error) {
    console.error(`[payments] could not start itinerary checkout for ${groupRef}`, error);
    return {
      error: "We could not open the secure payment page. Your quote is unchanged — please try again or use bank transfer.",
    };
  }
}

/** Reconcile only against PayToday's server-side query response, never URL status. */
export async function reconcileGroupPayment(
  groupRef: string,
  provider?: PaymentProvider,
): Promise<void> {
  if (!GROUP_REF_PATTERN.test(groupRef) || !isDatabaseConfigured()) return;

  const db = getDb();
  const [payment] = await db
    .select()
    .from(bookingGroupPayments)
    .where(eq(bookingGroupPayments.groupRef, groupRef))
    .orderBy(desc(bookingGroupPayments.createdAt))
    .limit(1);

  if (!payment || !payment.providerReference || payment.provider !== "paytoday") return;
  if (payment.status === "paid" || payment.status === "refunded") return;

  let remote;
  try {
    remote = await (provider ?? getPaymentProvider()).getPayment(payment.providerReference);
  } catch (error) {
    console.error(`[payments] could not reconcile itinerary ${groupRef}`, error);
    return;
  }
  if (!remote) return;

  let status = remote.status;
  let mismatch: string | null = null;
  if (status === "paid") {
    const expected = Math.round(parseMoney(payment.amount) * 100);
    const reported = Math.round(parseMoney(remote.amount) * 100);
    if (expected !== reported || remote.currency !== payment.currency) {
      mismatch = `expected ${payment.amount} ${payment.currency}, gateway reported ${remote.amount} ${remote.currency}`;
      status = "pending";
      console.error(`[payments] itinerary amount/currency mismatch for ${groupRef}: ${mismatch}`);
    }
  }

  await db
    .update(bookingGroupPayments)
    .set({
      status,
      paidAt: status === "paid" ? (payment.paidAt ?? new Date()) : payment.paidAt,
      raw: {
        ...(typeof payment.raw === "object" && payment.raw !== null
          ? (payment.raw as Record<string, unknown>)
          : {}),
        latestQuery: remote.raw ?? {},
        amountMismatch: mismatch,
        reconciledAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(bookingGroupPayments.id, payment.id));

  if (status === "paid") {
    await db
      .update(bookings)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(and(eq(bookings.groupRef, groupRef), eq(bookings.status, "pending_payment")));
  }
}

export async function startGroupCheckout(
  _previous: GroupCheckoutState,
  formData: FormData,
): Promise<GroupCheckoutState> {
  const groupRef = String(formData.get("groupRef") ?? "").trim().toUpperCase();
  if (!GROUP_REF_PATTERN.test(groupRef)) {
    return { error: "We could not find that quote." };
  }

  let result: Awaited<ReturnType<typeof getOrCreateGroupCheckout>>;
  try {
    result = await getOrCreateGroupCheckout(groupRef);
  } catch (error) {
    console.error(`[payments] group checkout action failed for ${groupRef}`, error);
    return { error: "Online checkout is temporarily unavailable. Your quote is unchanged — please use bank transfer or contact us." };
  }

  if ("error" in result) return result;

  // Next.js redirect() throws a framework control-flow signal. Keep it outside
  // the catch above so a successful PayToday URL is not mistaken for failure.
  redirect(result.url);
}
