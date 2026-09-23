import { LockIcon, ShieldCheckIcon } from "lucide-react";

import { PAYMENT_POLICY } from "@/lib/booking/payment-policy";

/**
 * Reassurance under a booking CTA.
 *
 * This was three chips of the same weight — nothing charged today, free
 * cancellation, confirmed on WhatsApp — and the strongest sentence we have
 * was buried nine screens down inside a collapsed FAQ. One real risk reversal
 * beats three reassurances that every competitor also offers, so the refund
 * promise leads and the housekeeping follows it.
 *
 * The second chip used to read "Nothing charged today", which was true and
 * still misleading: it answered "will you take my card now" while implying
 * the trip was secured by booking. It is not — payment confirms the vehicle —
 * and a traveller quoted that chip back at us to argue they should not have
 * to pay in advance. Every word here now comes from PAYMENT_POLICY.
 *
 * Kept in its own module with no server imports — it is used inside client
 * components, and pulling it from trust.tsx would drag the server-only review
 * queries into the browser bundle. PAYMENT_POLICY is plain constants and is
 * safe in a client bundle for the same reason.
 */
export function BookingAssurance() {
  return (
    <div className="text-muted-foreground grid gap-1.5 text-xs">
      <p className="text-foreground flex items-start gap-1.5 font-medium">
        <ShieldCheckIcon className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>{PAYMENT_POLICY.noShowRefund}</span>
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <LockIcon className="size-3.5" aria-hidden />
          {PAYMENT_POLICY.confirmsChip}
        </span>
        <span>{PAYMENT_POLICY.cancellationChip}</span>
      </p>
    </div>
  );
}
