"use client";

import { useActionState } from "react";

import { confirmTransferAction } from "@/lib/admin/quote-actions";
import { Button } from "@/components/ui/button";

/**
 * The one press on the dispatch board that moves money.
 *
 * It is a client component only so that a refusal has somewhere to appear.
 * Confirming a transfer is irreversible in practice — a car gets dispatched —
 * so a failure that looks like a no-op is worse here than anywhere else on the
 * page: the operator presses again, and if the second press succeeds they have
 * no idea whether the first one did too.
 */
export function ConfirmTransferButton({
  bookingId,
  // Not `ref`: React treats that name specially, and it would never arrive.
  bookingRef,
}: {
  bookingId: string;
  bookingRef: string;
}) {
  const [state, action, pending] = useActionState(confirmTransferAction, null);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Button type="submit" size="sm" className="press" disabled={pending}>
        {pending ? "Confirming…" : "Money received"}
      </Button>
      {state && !state.ok ? (
        <p
          role="alert"
          className="text-destructive max-w-56 text-right text-xs leading-snug"
        >
          {state.message}
        </p>
      ) : null}
      {/* Named so a screen reader hears which booking was confirmed, not just
          that something was. */}
      <span className="sr-only" role="status">
        {state?.ok ? `${bookingRef} confirmed.` : ""}
      </span>
    </form>
  );
}
