"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  confirmCharterTransferAction,
  issueBookingInvoiceAction,
  type InvoiceActionState,
} from "@/lib/admin/invoice-actions";

function Outcome({ state }: { state: InvoiceActionState }) {
  if (!state) return null;
  if (!state.ok) {
    return <p role="alert" className="text-destructive text-xs leading-snug">{state.message}</p>;
  }
  return (
    <p role="status" className="text-xs">
      {state.created ? "Issued" : "Already issued"}{" "}
      <a href={state.url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
        {state.invoiceNumber}
      </a>
    </p>
  );
}

/** For a paid booking with no invoice yet: issue it now. */
export function IssueInvoiceButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(issueBookingInvoiceAction, null);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Button type="submit" size="sm" variant="outline" className="press" disabled={pending}>
        {pending ? "Issuing…" : "Issue invoice"}
      </Button>
      <Outcome state={state} />
    </form>
  );
}

/** The charter's "money received": records the transfer and issues the invoice. */
export function ConfirmCharterTransferButton({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(confirmCharterTransferAction, null);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="quoteId" value={quoteId} />
      <Button type="submit" size="sm" className="press" disabled={pending}>
        {pending ? "Recording…" : "Money received — bank transfer"}
      </Button>
      <Outcome state={state} />
    </form>
  );
}
