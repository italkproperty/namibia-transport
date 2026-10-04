import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, payments } from "@/db/schema";
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";
import { reconcileBookingPayment } from "@/lib/payments/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BATCH_SIZE = 5;
// Keep outstanding PayToday attempts in the automatic queue for two weeks.
// Payment intents themselves are short-lived, but a customer can complete an
// intent days after the booking was created; the payment row is what tells us
// when the checkout actually existed. Older abandoned quotes are left for the
// explicit admin check rather than being polled forever.
const PAYMENT_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const PER_PAYMENT_TIMEOUT_MS = 5_000;

type Candidate = {
  paymentId: string;
  bookingRef: string;
};

function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function reconcileWithTimeout(bookingRef: string) {
  return Promise.race([
    reconcileBookingPayment(bookingRef),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("payment reconciliation timed out")),
        PER_PAYMENT_TIMEOUT_MS,
      ),
    ),
  ]);
}

/**
 * Scheduled backstop for PayToday payments.
 *
 * The traveller's return URL is useful but cannot be the only trigger: they
 * can pay successfully and close the tab before returning to Namibia Transport.
 * This job re-reads a small outstanding queue from PayToday and applies the same
 * amount-checked, idempotent reconciliation used by the confirmation page.
 *
 * It deliberately does not create payments, cancel bookings, or trust a status
 * supplied by the caller. It only asks PayToday what happened to an existing
 * payment intent.
 */
export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Database is not configured." },
      { status: 503 },
    );
  }

  const cutoff = new Date(Date.now() - PAYMENT_LOOKBACK_MS);

  try {
    const candidates = await withDeadline(
      "payment reconciliation queue",
      READ_DEADLINE_MS,
      () =>
        getDb()
          .select({
            paymentId: payments.id,
            bookingRef: bookings.ref,
          })
          .from(payments)
          .innerJoin(bookings, eq(payments.bookingId, bookings.id))
          .where(
            and(
              eq(payments.provider, "paytoday"),
              inArray(payments.status, ["pending", "authorized"]),
              eq(bookings.status, "pending_payment"),
              isNotNull(payments.providerReference),
              gte(payments.createdAt, cutoff),
            ),
          )
          .orderBy(desc(payments.createdAt))
          .limit(BATCH_SIZE),
    );

    const results: Array<{
      bookingRef: string;
      status: string;
      changed: boolean;
    }> = [];
    let timedOut = 0;

    // Keep the batch small. Each reconciliation performs database reads and a
    // remote PayToday query, so five attempts fit comfortably inside the
    // function deadline without turning a slow gateway into a second timeout.
    for (const candidate of candidates as Candidate[]) {
      try {
        const result = await reconcileWithTimeout(candidate.bookingRef);
        results.push({
          bookingRef: candidate.bookingRef,
          status: result.payment?.status ?? "none",
          changed: result.changed,
        });
      } catch (error) {
        timedOut += 1;
        console.error(
          `[payments] scheduled reconciliation failed for ${candidate.bookingRef}`,
          error,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      checked: results.length,
      changed: results.filter((result) => result.changed).length,
      paid: results.filter((result) => result.status === "paid").length,
      pending: results.filter(
        (result) => result.status === "pending" || result.status === "authorized",
      ).length,
      timedOut,
    });
  } catch (error) {
    console.error("[payments] scheduled reconciliation queue failed", error);
    return NextResponse.json(
      { ok: false, error: "Could not load the reconciliation queue." },
      { status: 500 },
    );
  }
}
