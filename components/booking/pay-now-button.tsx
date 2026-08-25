"use client";

import * as React from "react";
import { CreditCardIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startCheckout, type CheckoutActionState } from "@/lib/payments/actions";

/**
 * A form rather than a link: creating a payment intent is a side effect, and a
 * browser or crawler that prefetches a link would burn one every time.
 */
export function PayNowButton({
  bookingRef,
  label = "Pay now",
}: {
  bookingRef: string;
  label?: string;
}) {
  const [state, action, isPending] = React.useActionState<
    CheckoutActionState,
    FormData
  >(async (previous, formData) => startCheckout(previous, formData), null);

  React.useEffect(() => {
    if (state?.error) {
      toast.error("We could not open the payment page", {
        description: state.error,
      });
    }
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="ref" value={bookingRef} />
      <Button type="submit" className="press" disabled={isPending}>
        {isPending ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : (
          <CreditCardIcon className="size-4" aria-hidden />
        )}
        {isPending ? "Opening secure checkout…" : label}
      </Button>
    </form>
  );
}
