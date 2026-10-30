"use client";
import { useActionState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startGroupCheckout } from "@/lib/payments/group-checkout";

export function GroupCardCheckoutForm({ groupRef, totalLabel }: { groupRef: string; totalLabel: string }) {
  const [state, action, pending] = useActionState(startGroupCheckout, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="groupRef" value={groupRef} />
      <Button type="submit" className="w-full" disabled={pending}>
        <CreditCard className="mr-2 size-4" aria-hidden />
        {pending ? "Opening secure checkout…" : `Pay ${totalLabel} securely by card`}
      </Button>
      {state?.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
      <p className="text-muted-foreground text-xs leading-relaxed">
        One secure card payment covers every leg of this itinerary. Card details are entered on PayToday’s hosted payment page; Namibia Transport never sees or stores your card number.
      </p>
    </form>
  );
}
