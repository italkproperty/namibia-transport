"use client";

import * as React from "react";
import {
  BotIcon,
  CheckCircle2Icon,
  ClipboardPasteIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  analyseQuoteConversation,
  type AIQuoteChatMessage,
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
  const [activeDraft, setActiveDraft] = React.useState<AIQuoteDraft | null>(null);
  const [chatInput, setChatInput] = React.useState("");
  const [chatHistory, setChatHistory] = React.useState<AIQuoteChatMessage[]>([]);
  const [pendingOperatorMessage, setPendingOperatorMessage] = React.useState<string | null>(null);

  const displayDraft = activeDraft ?? (state?.ok ? state.draft : null);
  const displayBookings = state?.ok ? state.matchedBookings : [];

  React.useEffect(() => {
    if (pending || !state?.ok) return;
    setActiveDraft(state.draft);
    if (pendingOperatorMessage && state.assistantReply) {
      setChatHistory((current) => [
        ...current,
        { role: "operator", content: pendingOperatorMessage },
        { role: "claude", content: state.assistantReply },
      ].slice(-12));
      setPendingOperatorMessage(null);
    }
  }, [state, pending, pendingOperatorMessage]);

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
        <input type="hidden" name="mode" value="initial" />
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

      {displayDraft && (
        <div className="mt-5 grid gap-4 border-t pt-4">
          <div className="flex items-start gap-3">
            <CheckCircle2Icon className="text-success mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{displayDraft.summary}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {displayDraft.intent.replace(/_/g, " ")} · {displayDraft.confidence} confidence
              </p>
            </div>
          </div>

          {displayBookings.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider">
                Existing customer history found
              </p>
              <ul className="mt-2 grid gap-2">
                {displayBookings.map((booking) => (
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

          {displayDraft.missing.length > 0 && (
            <div className="border-warning/30 bg-warning/10 rounded-lg border p-3">
              <p className="text-xs font-semibold">Still needs confirmation</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {displayDraft.missing.join(" · ")}
              </p>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Customer</p>
              <p className="mt-1 text-sm font-medium">
                {displayDraft.customer.fullName || "Not identified"}
              </p>
              <p className="text-muted-foreground text-xs">
                {displayDraft.customer.whatsapp || displayDraft.customer.email || "No contact found"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Existing / additional money</p>
              <p className="mt-1 text-sm font-medium">
                {formatNad(displayDraft.existingPaidAmount)} payment context
              </p>
              <p className="text-muted-foreground text-xs">
                {displayDraft.existingPaidAmount > 0
                  ? "Operator/customer context — not a gateway verification."
                  : "No payment amount confirmed in the quote context."}
              </p>
              <p className="text-muted-foreground text-xs">
                {displayDraft.additionalAmountRequested > 0
                  ? `${formatNad(displayDraft.additionalAmountRequested)} additional amount mentioned`
                  : "No additional amount explicitly requested"}
              </p>
            </div>
          </div>

          {displayDraft.stops.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Detected itinerary</p>
              <ol className="mt-2 grid gap-1 text-sm">
                {displayDraft.stops.map((stop, index) => (
                  <li key={`${stop.slug}-${index}`}>
                    {index + 1}. {stop.label || stop.slug}
                    {stop.nights > 0 ? ` · ${stop.nights} nights` : ""}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-lg border border-brand/20 bg-brand/[0.03] p-3">
            <p className="text-xs font-semibold">Claude&apos;s interpretation</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {state?.ok ? state.assistantReply : null}
            </p>
          </div>

          <div className="rounded-xl border bg-background/60 p-4">
            <div className="flex items-start gap-3">
              <BotIcon className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">Talk to Claude about this quote</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Correct facts, clarify the customer&apos;s request, or change the itinerary.
                  Your instructions update the quote context; they do not silently change payment records.
                </p>
              </div>
            </div>

            {chatHistory.length > 0 && (
              <div className="mt-3 grid gap-2 border-t pt-3">
                {chatHistory.map((message, index) => (
                  <div
                    key={index}
                    className={message.role === "operator"
                      ? "ml-8 rounded-lg border bg-muted/40 p-2.5 text-xs"
                      : "mr-8 rounded-lg border border-brand/20 bg-brand/[0.03] p-2.5 text-xs"}
                  >
                    <p className="font-semibold">
                      {message.role === "operator" ? "You" : "Claude"}
                    </p>
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <form
              action={action}
              className="mt-3 grid gap-2"
              onSubmit={() => {
                const message = chatInput.trim();
                if (message) {
                  setPendingOperatorMessage(message);
                  setChatInput("");
                }
              }}
            >
              <input type="hidden" name="mode" value="chat" />
              <input
                type="hidden"
                name="draft"
                value={JSON.stringify(activeDraft ?? displayDraft)}
              />
              <input
                type="hidden"
                name="history"
                value={JSON.stringify(chatHistory)}
              />
              <label htmlFor="ai-quote-chat" className="sr-only">
                Clarification for Claude
              </label>
              <textarea
                id="ai-quote-chat"
                name="message"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder='e.g. "The client already paid the N$8,500 for NT-XPG4H4. Treat that as paid."'
                rows={3}
                disabled={pending}
                className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm leading-relaxed focus-visible:ring-[3px] focus-visible:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  Claude will keep the current quote context in mind.
                </span>
                <Button type="submit" disabled={pending || !chatInput.trim()} className="press">
                  <SendIcon className="size-4" aria-hidden />
                  {pending ? "Thinking…" : "Send clarification"}
                </Button>
              </div>
            </form>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => applyDraft(activeDraft ?? displayDraft)} className="press">
              <ClipboardPasteIcon className="size-4" aria-hidden />
              Apply final context to quote builder
            </Button>
            {displayDraft.agreedTotal > 0 && (
              <span className="text-muted-foreground self-center text-xs">
                Conversation contains an agreed total of{" "}
                <strong>{formatNad(displayDraft.agreedTotal)}</strong>.
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
