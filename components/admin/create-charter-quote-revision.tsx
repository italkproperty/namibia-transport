"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createCharterQuoteRevisionAction, type CreateCharterQuoteRevisionState } from "@/lib/admin/charter-quote-actions";

export function CreateCharterQuoteRevision({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = React.useActionState<CreateCharterQuoteRevisionState, FormData>(createCharterQuoteRevisionAction, null);
  return (
    <section className="rounded-xl border border-amber-400/40 bg-amber-50/40 p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Need to change an issued quote?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Create a separate private draft using the same customer and itinerary. The existing customer link and issued terms remain unchanged.</p>
      </div>
      <form action={action}>
        <input type="hidden" name="quoteId" value={quoteId} />
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Creating draft revision…" : "Create draft revision"}</Button>
      </form>
      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      {state?.ok && <div role="status" className="space-y-2 text-sm"><p>New private draft created: <strong>{state.quoteNumber}</strong>. Edit its prices there, then issue a new link after review.</p><Button asChild><Link href={`/admin/quotes/charter/drafts/${state.id}`}>Open draft revision</Link></Button></div>}
    </section>
  );
}
