"use client";

import * as React from "react";
import { issueCharterQuoteAction, type IssueCharterQuoteState } from "@/lib/admin/charter-quote-actions";
import { Button } from "@/components/ui/button";

export function IssueCharterQuoteForm({ quoteId, existingUrl }: { quoteId: string; existingUrl?: string | null }) {
  const [state, action, pending] = React.useActionState<IssueCharterQuoteState, FormData>(issueCharterQuoteAction, null);
  const url = state?.ok ? state.url : existingUrl || "";
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="rounded-xl border p-4 space-y-3">
      <h2 className="font-semibold">Customer sharing</h2>
      <p className="text-sm text-muted-foreground">Issue a private customer link valid for seven days. Only the approved customer-facing itinerary and total should be shared; internal cost and margin details stay in the admin view.</p>
      {url ? (
        <div className="space-y-2">
          <label className="text-xs font-medium" htmlFor="charter-share-url">Customer quote link</label>
          <input id="charter-share-url" readOnly value={url} className="w-full rounded-md border bg-muted/30 px-3 py-2 text-sm" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copy}>{copied ? "Copied" : "Copy customer link"}</Button>
            <Button type="button" variant="outline" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>Preview customer page</Button>
          </div>
          {state?.ok && <p role="status" className="text-xs text-muted-foreground">Issued until {new Date(state.validUntil).toLocaleString()}.</p>}
        </div>
      ) : (
        <form action={action}>
          <input type="hidden" name="quoteId" value={quoteId} />
          <Button type="submit" disabled={pending}>{pending ? "Issuing…" : "Approve and issue customer link"}</Button>
        </form>
      )}
      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      {url && <p className="text-xs text-muted-foreground">Issuing a link does not itself confirm payment or create a booking. Do not represent this quote as paid.</p>}
    </section>
  );
}
