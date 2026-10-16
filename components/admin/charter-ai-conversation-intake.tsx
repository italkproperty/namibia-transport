"use client";

import * as React from "react";
import { SparklesIcon, ClipboardCopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyseCharterConversationAction, type CharterConversationIntakeState } from "@/lib/admin/charter-ai-intake-actions";

export function CharterAiConversationIntake() {
  const [state, action, pending] = React.useActionState<CharterConversationIntakeState, FormData>(analyseCharterConversationAction, null);
  const [conversation, setConversation] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const copyBrief = async () => {
    if (!state?.ok) return;
    const text = JSON.stringify(state.intake, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-xl border border-primary/20 bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2"><SparklesIcon className="size-5" /></div>
        <div>
          <h2 className="text-base font-semibold">AI conversation intake</h2>
          <p className="mt-1 text-sm text-muted-foreground">Paste the customer's WhatsApp or email thread. AI extracts the trip brief, dates, route, passengers, preferences and unanswered questions for review before you build the charter quote.</p>
        </div>
      </div>
      <form action={action} className="space-y-3">
        <textarea name="conversation" value={conversation} onChange={(event) => setConversation(event.target.value)} rows={8} maxLength={40000} placeholder="Paste the full customer conversation here…" required className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{conversation.length.toLocaleString()} / 40,000 characters · AI will not invent a final price or resolve conflicting dates.</p>
          <Button type="submit" disabled={pending || conversation.trim().length < 30}><SparklesIcon className="mr-2 size-4" />{pending ? "Analysing conversation…" : "Extract charter brief"}</Button>
        </div>
      </form>
      {state && !state.ok && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{state.message}</p>}
      {state?.ok && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-semibold">Extracted trip brief</h3><p className="text-xs text-muted-foreground">Review against the original conversation. Nothing has been quoted or sent to the customer.</p></div>
            <Button type="button" variant="outline" size="sm" onClick={copyBrief}><ClipboardCopyIcon className="mr-1 size-4" />{copied ? "Copied" : "Copy brief"}</Button>
          </div>
          <p className="text-sm">{state.intake.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Customer" value={state.intake.customerName} />
            <Info label="Organisation" value={state.intake.organisation} />
            <Info label="Email" value={state.intake.email} />
            <Info label="WhatsApp" value={state.intake.whatsapp} />
            <Info label="Passengers" value={state.intake.passengers == null ? null : String(state.intake.passengers)} />
            <Info label="Vehicle preference" value={state.intake.vehiclePreference} />
            <Info label="Customer&apos;s requested dates" value={[state.intake.requestedStartDate, state.intake.requestedEndDate].filter(Boolean).join(" to ") || null} />
            <Info label="Itinerary start date" value={state.intake.itineraryStartDate} />
            <Info label="Budget (not necessarily agreed)" value={state.intake.customerBudget} />
            <Info label="Agreed price" value={state.intake.priceAgreed} />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Route / itinerary extracted</h4>
            {state.intake.itinerary.length ? <ol className="mt-2 space-y-2">{state.intake.itinerary.map((leg, index) => <li key={index} className="rounded-md border p-3 text-sm"><p className="font-medium">{leg.dayOrDate || `Stop ${index + 1}`}: {leg.from || "Origin not specified"} → {leg.to || "Destination not specified"}</p>{leg.details && <p className="mt-1 text-muted-foreground">{leg.details}</p>}{leg.nights != null && <p className="mt-1 text-xs text-muted-foreground">Nights: {leg.nights}</p>}</li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">No itinerary legs confidently identified.</p>}
          </div>
          <BulletList title="Requested inclusions" items={state.intake.inclusionsRequested} />
          <BulletList title="Preferences / requirements" items={state.intake.preferences} />
          <BulletList title="Date conflicts to resolve" items={state.intake.dateConflicts} warning />
          <BulletList title="Questions / missing information" items={state.intake.unresolvedQuestions} warning />
          <BulletList title="Assumptions or exclusions mentioned" items={state.intake.exclusionsOrAssumptions} />
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Important: AI extraction is a draft, not a source of truth. Confirm dates and destinations with the customer, then search and select every destination in the planner to verify map coordinates and road routing. No distance, availability or final price is assumed.</p>
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-md bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value || "Not stated"}</p></div>;
}

function BulletList({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  if (!items.length) return null;
  return <div className={warning ? "rounded-md border border-amber-400/50 p-3" : ""}><h4 className="text-sm font-semibold">{title}</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>;
}
