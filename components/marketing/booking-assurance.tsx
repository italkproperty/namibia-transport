import { LockIcon, MessageCircleIcon, ShieldCheckIcon } from "lucide-react";

/**
 * Reassurance under a booking CTA. Deliberately kept in its own module with
 * no server imports — it is used inside client components, and pulling it
 * from trust.tsx would drag the server-only review queries into the browser
 * bundle.
 */
export function BookingAssurance() {
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="flex items-center gap-1.5">
        <LockIcon className="size-3.5" aria-hidden />
        Nothing charged today
      </span>
      <span className="flex items-center gap-1.5">
        <ShieldCheckIcon className="size-3.5" aria-hidden />
        Free cancellation up to 24h before
      </span>
      <span className="flex items-center gap-1.5">
        <MessageCircleIcon className="size-3.5" aria-hidden />
        Confirmed on WhatsApp
      </span>
    </p>
  );
}
