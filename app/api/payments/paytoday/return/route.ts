import { NextResponse, type NextRequest } from "next/server";

import { reconcileBookingPayment } from "@/lib/payments/reconcile";

/** node:vm and the Postgres driver both need the Node runtime, not Edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same alphabet as lib/booking/ref.ts — anything else is not one of ours. */
const REF_PATTERN = /^NT-[ABCDEFGHJKLMNPQRTUVWXY2346789]{6}$/;

/**
 * Where PayToday sends the traveller after checkout.
 *
 * PayToday appends a `status` query parameter, and the Developer Guide's own
 * sample reads it to decide whether the payment succeeded. We do not: that
 * value sits in a URL the traveller controls, so anyone could append
 * `?status=success` and walk away with a confirmed trip. The parameter is
 * ignored entirely and the status is re-read from PayToday's servers via
 * queryPaymentIntent before anything is written down.
 */
async function handle(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref")?.trim().toUpperCase();
  const origin = request.nextUrl.origin;

  if (!ref || !REF_PATTERN.test(ref)) {
    return NextResponse.redirect(new URL("/", origin), { status: 303 });
  }

  try {
    await reconcileBookingPayment(ref);
  } catch (error) {
    // Never strand the traveller on an error page over a reconciliation
    // failure — the confirmation page re-checks on load anyway.
    console.error(`[payments] return handler failed for ${ref}`, error);
  }

  return NextResponse.redirect(new URL(`/booking/${ref}`, origin), {
    status: 303,
  });
}

export const GET = handle;
export const POST = handle;
