"use client";

import * as React from "react";
import { BotIcon, CheckCircle2Icon, ClipboardPasteIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  analyseQuoteConversation,
  type AIQuoteDraft,
  type AIQuoteState,
} from "@/lib/admin/ai-quote-actions";
import { formatNad } from "@/lib/money";

export function AIQuoteAssistant() {
  const [state, action, pending] = React.useActionState<
    AIQuoteState,
    FormData
  >(analyseQuoteConversation, null);
  const [conversation, setConversation] = React.useState("");

  const applyDraft = (draft: AIQuoteDraft) => {
    window.dispatchEvent(
      new CustomEvent("namibia-transport:ai-quote", {
        detail: draft,
      }),
    );
  };

  return (
    <section className="border-brand/20 bg-brand/[0.03] rounded-xl border p-5">
      <div className="flex items-start gap-3">
        <div className="bg-brand/10 text-brand rounded-lg p-2">
          <BotIcon className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold">AI quote assistant</h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Paste the customer&apos;s WhatsApp or email thread. Claude will
            identify the trip, existing bookings and payments, additional
            requests, dates, passengers and stops — then prepare the quote
            builder. It does not set the final price.
          </p>
        </div>
      </div>

      <form action={action} className="mt-4 grid gap-3">
        <label htmlFor="ai-conversation" className="text-xs font-medium">
          Customer conversation
        </label>
        <textarea
          id="ai-conversation"
          name="conversation"
          value={conversation}
          onChange={(event) => setConversation(event.target.value)}
          placeholder="Paste the full WhatsApp/email thread here…"
          rows={9}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm leading-relaxed focus-visible:ring-[3px] focus-visible:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            disabled={pending || conversation.trim().length === 0}
            className="press"
          >
            <SparklesIcon className="size-4" aria-hidden />
            {pending ? "Analysing conversation…" : "Analyse with Claude"}
          </Button>
          <span className="text-muted-foreground text-xs">
            The API key stays server-side.
          </span>
        </div>
      </form>

      {state && !state.ok && (
        <p className="text-destructive mt-3 text-sm">{state.message}</p>
      )}

      {state?.ok && (
        <div className="mt-5 grid gap-4 border-t pt-4">
          <div className="flex items-start gap-3">
            <CheckCircle2Icon className="text-success mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{state.draft.summary}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {state.draft.intent.replace(/_/g, " ")} · {state.draft.confidence} confidence
              </p>
            </div>
          </div>

          {state.matchedBookings.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider">
                Existing customer history found
              </p>
              <ul className="mt-2 grid gap-2">
                {state.matchedBookings.map((booking) => (
                  <li
                    key={booking.ref}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
                  >
                    <span>
                      <strong>{booking.ref}</strong> · {booking.pickup} → {booking.dropoff}
                    </span>
                    <span className="text-muted-foreground">
                      {booking.status} · {formatNad(booking.customerPrice)}
                      {booking.paidAmount > 0
                        ? ` · ${formatNad(booking.paidAmount)} paid`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.draft.missing.length > 0 && (
            <div className="border-warning/30 bg-warning/10 rounded-lg border p-3">
              <p className="text-xs font-semibold">Still needs confirmation</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {state.draft.missing.join(" · ")}
              </p>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Customer</p>
              <p className="mt-1 text-sm font-medium">
                {state.draft.customer.fullName || "Not identified"}
              </p>
              <p className="text-muted-foreground text-xs">
                {state.draft.customer.whatsapp || state.draft.customer.email || "No contact found"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Existing / additional money</p>
              <p className="mt-1 text-sm font-medium">
                {formatNad(state.draft.existingPaidAmount)} already paid
              </p>
              <p className="text-muted-foreground text-xs">
                {state.draft.additionalAmountRequested > 0
                  ? `${formatNad(state.draft.additionalAmountRequested)} additional amount mentioned`
                  : "No additional amount explicitly requested"}
              </p>
            </div>
          </div>

          {state.draft.stops.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Detected itinerary</p>
              <ol className="mt-2 grid gap-1 text-sm">
                {state.draft.stops.map((stop, index) => (
                  <li key={`${stop.slug}-${index}`}>
                    {index + 1}. {stop.label || stop.slug}
                    {stop.nights > 0 ? ` · ${stop.nights} nights` : ""}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => applyDraft(state.draft)} className="press">
              <ClipboardPasteIcon className="size-4" aria-hidden />
              Apply to quote builder
            </Button>
            {state.draft.agreedTotal > 0 && (
              <span className="text-muted-foreground self-center text-xs">
                Conversation contains an agreed total of 
                <strong>{formatNad(state.draft.agreedTotal)}</strong>.
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
