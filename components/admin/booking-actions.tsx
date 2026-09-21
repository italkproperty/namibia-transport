"use client";

import * as React from "react";
import { RotateCcwIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  cancelBooking,
  reinstateBooking,
  type VoidState,
} from "@/lib/admin/booking-actions";

/**
 * Void a booking, or put it back.
 *
 * Two-step on the way out and one-step on the way back, which is the right
 * asymmetry: cancelling a trip somebody is expecting is the damaging
 * direction, and undoing a cancellation is the repair. The confirm step also
 * asks why, because "why is this cancelled" is the first question anyone has
 * a week later and nobody remembers.
 */
export function BookingRowActions({
  bookingId,
  isCancelled,
  isGroup,
}: {
  bookingId: string;
  isCancelled: boolean;
  isGroup: boolean;
}) {
  const [cancelState, cancel, cancelling] = React.useActionState<
    VoidState,
    FormData
  >(cancelBooking, null);
  const [, reinstate, reinstating] = React.useActionState<VoidState, FormData>(
    reinstateBooking,
    null,
  );
  const [confirming, setConfirming] = React.useState(false);

  if (isCancelled) {
    return (
      <form action={reinstate}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          disabled={reinstating}
          className="press h-8 gap-1.5 text-xs"
        >
          <RotateCcwIcon className="size-3.5" aria-hidden />
          {reinstating ? "Restoring…" : "Reinstate"}
        </Button>
      </form>
    );
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setConfirming(true)}
        className="press text-muted-foreground hover:text-destructive h-8 gap-1.5 text-xs"
      >
        <XIcon className="size-3.5" aria-hidden />
        Cancel
      </Button>
    );
  }

  return (
    <form action={cancel} className="grid gap-1.5">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input
        name="reason"
        placeholder="Why? e.g. wrong date, traveller changed plans"
        className="border-input bg-background focus-ring h-8 w-56 rounded-md border px-2 text-xs"
      />
      <div className="flex gap-1.5">
        <Button
          type="submit"
          size="sm"
          disabled={cancelling}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 press h-8 text-xs"
        >
          {cancelling
            ? "Cancelling…"
            : isGroup
              ? "Cancel the whole trip"
              : "Cancel it"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
          className="press h-8 text-xs"
        >
          Keep
        </Button>
      </div>
      {isGroup && (
        <p className="text-muted-foreground text-[0.7rem] leading-snug">
          Every leg of this itinerary is cancelled together.
        </p>
      )}
      {cancelState && !cancelState.ok && (
        <p className="text-destructive text-[0.7rem]">{cancelState.message}</p>
      )}
    </form>
  );
}
