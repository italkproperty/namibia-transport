"use client";

import * as React from "react";
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  cancelBooking,
  completeBooking,
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
  isCompleted,
  /** Sold, departed, and not yet marked as run. */
  canComplete,
  isGroup,
}: {
  bookingId: string;
  isCancelled: boolean;
  isCompleted: boolean;
  canComplete: boolean;
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
  const [doneState, complete, completing] = React.useActionState<
    VoidState,
    FormData
  >(completeBooking, null);
  const [confirming, setConfirming] = React.useState(false);

  // A trip that has run is finished in both directions: it cannot be cancelled
  // without rewriting history, and it is already complete.
  if (isCompleted) {
    return <span className="text-muted-foreground text-xs">Ran</span>;
  }

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
      <div className="grid justify-items-start gap-0.5">
        {/* Only offered once the trip has actually departed — marking a future
            trip run is always a mis-click, and the server refuses it anyway. */}
        {canComplete && (
          <form action={complete}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={completing}
              className="press text-muted-foreground hover:text-success h-8 gap-1.5 text-xs"
            >
              <CheckIcon className="size-3.5" aria-hidden />
              {completing ? "Marking…" : "Mark as run"}
            </Button>
          </form>
        )}
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
        {doneState && !doneState.ok && (
          <p className="text-destructive max-w-48 text-[0.7rem] leading-snug">
            {doneState.message}
          </p>
        )}
      </div>
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
