"use client";

import * as React from "react";
import { SparklesIcon, ClipboardCopyIcon, SendIcon, RouteIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyseCharterConversationAction, type CharterConversationIntake, type CharterConversationIntakeState } from "@/lib/admin/charter-ai-intake-actions";

export function CharterAiConversationIntake() {
  const [state, action, pending] = React.useActionState<CharterConversationIntakeState, FormData>(analyseCharterConversationAction, null);
  const [conversation, setConversation] = React.useState("");
  const [activeIntake, setActiveIntake] = React.useState<CharterConversationIntake | null>(null);
  const [feedback, setFeedback] = React.useState("");
  const [feedbackHistory, setFeedbackHistory] = React.useState<string[]>([]);
  const [pendingFeedback, setPendingFeedback] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const lastHandledState = React.useRef<CharterConversationIntakeState>(null);
  const storageKey = "namibia-transport:charter-ai-intake:v1";

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { conversation?: string; intake?: CharterConversationIntake; feedbackHistory?: string[] };
      if (typeof saved.conversation === "string") setConversation(saved.conversation);
      if (saved.intake && typeof saved.intake === "object" && Array.isArray(saved.intake.itinerary)) setActiveIntake(saved.intake);
      if (Array.isArray(saved.feedbackHistory)) setFeedbackHistory(saved.feedbackHistory.filter((item): item is string => typeof item === "string").slice(-12));
    } catch {
      // Corrupt or unavailable browser storage must not prevent using intake.
    }
  }, []);

  React.useEffect(() => {
    if (!activeIntake && !conversation && feedbackHistory.length === 0) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ conversation, intake: activeIntake, feedbackHistory: feedbackHistory.slice(-12) }));
    } catch {
      // Private browsing or a full storage quota should not break the workflow.
    }
  }, [conversation, activeIntake, feedbackHistory]);

  React.useEffect(() => {
    if (pending || !state || state === lastHandledState.current) return;
    lastHandledState.current = state;
    if (!state.ok) return;
    setActiveIntake(state.intake);
    if (pendingFeedback) {
      setFeedbackHistory((current) => [...current, pendingFeedback].slice(-12));
      setPendingFeedback(null);
      setFeedback("");
    }
  }, [state, pending, pendingFeedback]);

  const copyBrief = async () => {
    if (!activeIntake) return;
    const text = JSON.stringify(activeIntake, null, 2);
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
          <p className="mt-1 text-sm text-muted-foreground">Paste the customer&apos;s WhatsApp or email thread. AI extracts the trip brief, dates, route, passengers, preferences and unanswered questions for review before you build the charter quote.</p>
        </div>
      </div>
      <form action={action} className="space-y-3" onSubmit={() => { setActiveIntake(null); setFeedbackHistory([]); }}>
        <input type="hidden" name="mode" value="analyse" />
        <textarea name="conversation" value={conversation} onChange={(event) => setConversation(event.target.value)} rows={8} maxLength={40000} placeholder="Paste the full customer conversation here…" required className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{conversation.length.toLocaleString()} / 40,000 characters · This browser saves the conversation and extracted brief so a refresh does not erase your work.</p>
          <Button type="submit" disabled={pending || conversation.trim().length < 30}><SparklesIcon className="mr-2 size-4" />{pending ? "Analysing conversation…" : "Extract charter brief"}</Button>
        </div>
      </form>
      {state && !state.ok && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{state.message}</p>}
      {activeIntake && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-semibold">Extracted trip brief</h3><p className="text-xs text-muted-foreground">Review against the original conversation. Nothing has been quoted or sent to the customer.</p></div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyBrief}><ClipboardCopyIcon className="mr-1 size-4" />{copied ? "Copied" : "Copy brief"}</Button>
              <Button type="button" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("namibia-transport:charter-intake", { detail: { intake: activeIntake } }))}><RouteIcon className="mr-1 size-4" />Use in quote planner</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setActiveIntake(null); setConversation(""); setFeedbackHistory([]); setFeedback(""); window.localStorage.removeItem(storageKey); }}><TrashIcon className="mr-1 size-4" />Clear saved brief</Button>
            </div>
          </div>
          <p className="text-sm">{activeIntake.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Customer" value={activeIntake.customerName} />
            <Info label="Organisation" value={activeIntake.organisation} />
            <Info label="Email" value={activeIntake.email} />
            <Info label="WhatsApp" value={activeIntake.whatsapp} />
            <Info label="Passengers" value={activeIntake.passengers == null ? null : String(activeIntake.passengers)} />
            <Info label="Vehicle preference" value={activeIntake.vehiclePreference} />
            <Info label="Customer&apos;s requested dates" value={[activeIntake.requestedStartDate, activeIntake.requestedEndDate].filter(Boolean).join(" to ") || null} />
            <Info label="Itinerary start date" value={activeIntake.itineraryStartDate} />
            <Info label="Budget (not necessarily agreed)" value={activeIntake.customerBudget} />
            <Info label="Agreed price" value={activeIntake.priceAgreed} />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Route / itinerary extracted</h4>
            {activeIntake.itinerary.length ? <ol className="mt-2 space-y-2">{activeIntake.itinerary.map((leg, index) => <li key={index} className="rounded-md border p-3 text-sm"><p className="font-medium">{leg.dayOrDate || `Stop ${index + 1}`}: {leg.from || "Origin not specified"} → {leg.to || "Destination not specified"}</p>{leg.details && <p className="mt-1 text-muted-foreground">{leg.details}</p>}{leg.nights != null && <p className="mt-1 text-xs text-muted-foreground">Nights: {leg.nights}</p>}</li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">No itinerary legs confidently identified.</p>}
          </div>
          <BulletList title="Requested inclusions" items={activeIntake.inclusionsRequested} />
          <BulletList title="Preferences / requirements" items={activeIntake.preferences} />
          <BulletList title="Date conflicts to resolve" items={activeIntake.dateConflicts} warning />
          <BulletList title="Questions / missing information" items={activeIntake.unresolvedQuestions} warning />
          <BulletList title="Assumptions or exclusions mentioned" items={activeIntake.exclusionsOrAssumptions} />
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Important: AI extraction is a draft, not a source of truth. Confirm dates and destinations with the customer, then search and select every destination in the planner to verify map coordinates and road routing. No distance, availability or final price is assumed. The saved brief is stored in this browser only.</p>

          <div className="rounded-lg border p-3 space-y-3">
            <div>
              <h4 className="text-sm font-semibold">Correct or refine the AI understanding</h4>
              <p className="mt-1 text-xs text-muted-foreground">Tell Claude what it misunderstood or what context to reconsider. It will update the full brief without silently inventing missing facts.</p>
            </div>
            {feedbackHistory.length > 0 && <ul className="space-y-1 text-xs text-muted-foreground">{feedbackHistory.map((item, index) => <li key={index}>• {item}</li>)}</ul>}
            <form action={action} className="space-y-2" onSubmit={() => { if (feedback.trim()) setPendingFeedback(feedback.trim()); }}>
              <input type="hidden" name="mode" value="refine" />
              <input type="hidden" name="conversation" value={conversation} />
              <input type="hidden" name="currentIntake" value={JSON.stringify(activeIntake)} />
              <textarea name="feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={3} maxLength={4000} placeholder='e.g. "They said 4 passengers, not 2. The 12 October date is the itinerary date, not the requested pickup date."' className="border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm" />
              <div className="flex justify-end"><Button type="submit" disabled={pending || !feedback.trim()}><SendIcon className="mr-2 size-4" />{pending ? "Updating brief…" : "Update understanding"}</Button></div>
            </form>
          </div>
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
