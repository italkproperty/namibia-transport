import { LockIcon, ShieldCheckIcon } from "lucide-react";

/**
 * Reassurance under a booking CTA.
 *
 * This was three chips of the same weight — nothing charged today, free
 * cancellation, confirmed on WhatsApp — and the strongest sentence we have
 * was buried nine screens down inside a collapsed FAQ. One real risk reversal
 * beats three reassurances that every competitor also offers, so the refund
 * promise leads and the housekeeping follows it.
 *
 * It is backed: the cancellation section of our terms says the same thing in
 * the same words. Nothing here is claimed that is not written down.
 *
 * Kept in its own module with no server imports — it is used inside client
 * components, and pulling it from trust.tsx would drag the server-only review
 * queries into the browser bundle.
 */
export function BookingAssurance() {
  return (
    <div className="text-muted-foreground grid gap-1.5 text-xs">
      <p className="text-foreground flex items-start gap-1.5 font-medium">
        <ShieldCheckIcon className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          If nobody comes for you, you pay nothing — anything already paid is
          refunded in full.
        </span>
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <LockIcon className="size-3.5" aria-hidden />
          Nothing charged today
        </span>
        <span>Free cancellation up to 24h before</span>
      </p>
    </div>
  );
}
