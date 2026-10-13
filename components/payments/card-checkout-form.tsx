"use client";

import { useActionState } from "react";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startCheckout } from "@/lib/payments/actions";

export function CardCheckoutForm({ ref }: { ref: string }) {
  const [state, action, pending] = useActionState(startCheckout, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ref" value={ref} />
      <Button type="submit" className="w-full" disabled={pending}>
        <CreditCard className="mr-2 size-4" aria-hidden />
        {pending ? "Opening secure checkout…" : "Pay securely by card"}
      </Button>
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Card details are entered on the secure PayToday payment page. Namibia Transport never sees or stores your card number.
      </p>
    </form>
  );
}
