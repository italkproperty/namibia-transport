"use client";

import * as React from "react";
import { CheckCircle2Icon, CopyIcon, ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  AIQuoteDraft,
  MatchedBooking,
} from "@/lib/admin/ai-quote-actions";
import { createCustomQuote } from "@/lib/admin/quote-actions";
import { whatsappLink } from "@/lib/company";
import { formatNad } from "@/lib/money";

/**
 * The whole quote, on one card, when the thread has already priced it.
 *
 * The first version of this filled the agreed-price form further down the
 * page, and the first real use of it went wrong in an instructive way: the
 * operator saw "Fare 4760" on a form with no total anywhere, took it for a
 * mistake, typed the trip total into it, and issued a N$6,660 quote for a
 * N$5,710 trip. A form that takes two fares and shows no sum invites exactly
 * that. It also could not be used twice — once a quote existed the form was
 * gone, so "Fill" did nothing — and the route builder underneath was showing
 * a red error about a road it had never been asked for.
 *
 * So: every leg and its fare where the operator is already looking, the
 * total the customer pays in the largest type on the card, and Create right
 * under it. A corrected quote replaces the wrong one in the same save, so
 * there is never a second live price for one trip.
 */

type Leg = {
  pickupLabel: string;
  dropoffLabel: string;
  at: string;
  vehicleClassId: string;
  price: string;
};

type Created = { ref: string; url: string; total: string; legCount: number };

function money(raw: string): number {
  const value = Number(raw.replace(/[\s,]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Unpaid quotes this conversation's customer already holds, as whole trips. */
function replaceable(matched: MatchedBooking[]) {
  const groups = new Map<
    string,
    { ref: string; legs: number; total: number; dates: string[] }
  >();
  for (const booking of matched) {
    if (booking.status !== "pending_payment" || booking.paidAmount > 0) continue;
    const ref = booking.groupRef ?? booking.ref;
    const entry = groups.get(ref) ?? { ref, legs: 0, total: 0, dates: [] };
    entry.legs += 1;
    entry.total += booking.customerPrice;
    // Namibia is UTC+2 all year, so the local date is the instant plus two hours.
    entry.dates.push(
      new Date(new Date(booking.scheduledAt).getTime() + 2 * 3_600_000)
        .toISOString()
        .slice(0, 10),
    );
    groups.set(ref, entry);
  }
  return [...groups.values()];
}

export function AgreedQuoteCard({
  draft,
  matchedBookings,
  vehicleClasses,
}: {
  draft: AIQuoteDraft;
  matchedBookings: MatchedBooking[];
  vehicleClasses: { id: string; name: string }[];
}) {
  const classFor = React.useCallback(
    (vehicle: string) =>
      vehicleClasses.find((vc) =>
        vehicle === "suv"
          ? /suv|4x4/i.test(vc.name)
          : vehicle === "private-car"
            ? /car|sedan/i.test(vc.name)
            : false,
      )?.id ?? "",
    [vehicleClasses],
  );

  const [fullName, setFullName] = React.useState(draft.customer.fullName);
  const [whatsapp, setWhatsapp] = React.useState(draft.customer.whatsapp);
  const [email, setEmail] = React.useState(draft.customer.email);
  const [notes, setNotes] = React.useState(draft.notes ?? "");
  const [legs, setLegs] = React.useState<Leg[]>(() =>
    draft.quotedLegs.slice(0, 2).map((leg) => ({
      pickupLabel: leg.pickupLabel,
      dropoffLabel: leg.dropoffLabel,
      at: `${leg.date}T${leg.time}`,
      vehicleClassId: classFor(leg.vehicle),
      price: String(leg.price),
    })),
  );

  const candidates = React.useMemo(() => replaceable(matchedBookings), [matchedBookings]);
  // Ticked by default only when the old quote is for the same travel day. An
  // agent's address matches every traveller they have ever booked, and
  // cancelling another client's quote by default would be far worse than
  // leaving one unticked.
  const [replaces, setReplaces] = React.useState<string[]>(() => {
    const days = new Set(draft.quotedLegs.map((leg) => leg.date));
    return candidates
      .filter((c) => c.dates.some((date) => days.has(date)))
      .map((c) => c.ref);
  });

  const [created, setCreated] = React.useState<Created | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const total = legs.reduce((sum, leg) => sum + money(leg.price), 0);
  const quotedTotal = draft.quotedLegs
    .slice(0, 2)
    .reduce((sum, leg) => sum + leg.price, 0);
  const differs = Math.round(total * 100) !== Math.round(quotedTotal * 100);
  const needsCountryCode = whatsapp.trim() !== "" && !whatsapp.trim().startsWith("+");

  const patch = (index: number, change: Partial<Leg>) =>
    setLegs((current) =>
      current.map((leg, i) => (i === index ? { ...leg, ...change } : leg)),
    );

  const create = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const [first, second] = legs;
    const data = new FormData();
    data.set("fullName", fullName);
    data.set("whatsapp", whatsapp);
    data.set("email", email);
    data.set("pickupLabel", first.pickupLabel);
    data.set("dropoffLabel", first.dropoffLabel);
    data.set("scheduledAt", first.at);
    data.set("price", first.price);
    data.set("vehicleClassId", first.vehicleClassId);
    data.set("passengers", String(Math.max(1, draft.passengers || 1)));
    data.set("luggageCount", String(Math.max(0, draft.luggageCount || 0)));
    data.set("notes", notes);
    if (second) {
      data.set("leg2PickupLabel", second.pickupLabel);
      data.set("leg2DropoffLabel", second.dropoffLabel);
      data.set("leg2ScheduledAt", second.at);
      data.set("leg2Price", second.price);
      data.set("leg2VehicleClassId", second.vehicleClassId);
    }
    data.set("replaces", JSON.stringify(replaces));
    try {
      const result = await createCustomQuote(null, data);
      if (result?.ok) {
        setCreated({
          ref: result.ref,
          url: result.url,
          total: result.total,
          legCount: result.legCount,
        });
      } else {
        setError(result?.message ?? "Could not create the quote.");
      }
    } catch {
      setError(
        "The request did not complete. Check Bookings for this traveller before creating it again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    const message = `Hi — here is your quote from Namibia Transport. Review your trip and pay securely on this link: ${created.url}`;
    return (
      <div className="border-success/30 bg-success/5 rounded-lg border p-4">
        <p className="text-success flex items-center gap-2 font-medium">
          <CheckCircle2Icon className="size-5" aria-hidden />
          Quote {created.ref} created
        </p>
        <p className="mt-1 text-sm">
          {created.legCount} {created.legCount === 1 ? "leg" : "legs"},{" "}
          <strong>{formatNad(created.total)}</strong> in total, on one link and
          one payment.
        </p>
        <div className="bg-background mt-3 flex items-center gap-2 rounded-lg border p-3">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {created.url}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(created.url).then(
                () => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                },
                () => undefined,
              );
            }}
            className="press focus-ring text-muted-foreground hover:text-foreground shrink-0 rounded p-1.5"
            aria-label="Copy the link"
          >
            {copied ? (
              <CheckCircle2Icon className="text-success size-4" aria-hidden />
            ) : (
              <CopyIcon className="size-4" aria-hidden />
            )}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild className="press">
            <a href={created.url} target="_blank" rel="noopener noreferrer">
              Open the page
              <ExternalLinkIcon className="size-4" aria-hidden />
            </a>
          </Button>
          {whatsapp.trim().startsWith("+") && (
            <Button asChild variant="outline" className="press">
              <a
                href={whatsappLink(whatsapp, message)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Send it on WhatsApp
              </a>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="press"
            onClick={() => {
              // Back to the same figures, with this quote ticked to be
              // replaced — so fixing a mistake never leaves two live links.
              setReplaces([created.ref]);
              setCreated(null);
            }}
          >
            Something wrong? Fix and re-issue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-success/30 bg-success/5 grid gap-4 rounded-lg border p-4">
      <div>
        <p className="text-sm font-semibold">
          Already priced in this conversation
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Copied from the thread, not calculated. Check each line against what
          you sent, then create the quote here — there is nothing else to fill
          in further down the page.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CardField id="aq-name" label="Traveller" value={fullName} onChange={setFullName} />
        <div className="grid gap-1.5">
          <CardField
            id="aq-whatsapp"
            label="WhatsApp / phone"
            value={whatsapp}
            onChange={setWhatsapp}
          />
          {needsCountryCode && (
            <p className="text-warning-foreground bg-warning/15 rounded px-2 py-1 text-xs">
              No country code. Add it (for example +1 or +264) so the driver
              can reach them.
            </p>
          )}
        </div>
        <CardField id="aq-email" label="Send the quote to" value={email} onChange={setEmail} type="email" />
      </div>

      <ol className="grid gap-3">
        {legs.map((leg, index) => (
          <li key={index} className="bg-background grid gap-3 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-semibold">
              Leg {index + 1} of {legs.length}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CardField
                id={`aq-from-${index}`}
                label="From"
                value={leg.pickupLabel}
                onChange={(v) => patch(index, { pickupLabel: v })}
              />
              <CardField
                id={`aq-to-${index}`}
                label="To"
                value={leg.dropoffLabel}
                onChange={(v) => patch(index, { dropoffLabel: v })}
              />
              <CardField
                id={`aq-at-${index}`}
                label="Pickup date and time"
                type="datetime-local"
                value={leg.at}
                onChange={(v) => patch(index, { at: v })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor={`aq-vehicle-${index}`}>Vehicle</Label>
                  <select
                    id={`aq-vehicle-${index}`}
                    className="border-input bg-background focus-ring h-10 rounded-md border px-2 text-sm"
                    value={leg.vehicleClassId}
                    onChange={(event) =>
                      patch(index, { vehicleClassId: event.target.value })
                    }
                  >
                    <option value="">Decide later</option>
                    {vehicleClasses.map((vc) => (
                      <option key={vc.id} value={vc.id}>
                        {vc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <CardField
                  id={`aq-price-${index}`}
                  label={`Leg ${index + 1} fare (N$)`}
                  inputMode="decimal"
                  value={leg.price}
                  onChange={(v) => patch(index, { price: v })}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="border-t pt-3">
        <p className="text-muted-foreground text-xs">
          Total the customer pays
          {legs.length > 1 ? ` (${legs.map((leg) => formatNad(money(leg.price))).join(" + ")})` : ""}
        </p>
        <p className="tabular text-brand text-2xl font-semibold">
          {formatNad(total)}
        </p>
        {differs && (
          <p className="bg-warning/15 mt-2 rounded px-2 py-1 text-xs">
            This is not the {formatNad(quotedTotal)} quoted in the conversation.
            Each box is the fare for that leg alone, not the trip total.
          </p>
        )}
      </div>

      <CardField
        id="aq-notes"
        label="Note on the quote (the customer sees this)"
        value={notes}
        onChange={setNotes}
      />

      {candidates.length > 0 && (
        <fieldset className="bg-background rounded-lg border p-3">
          <legend className="px-1 text-xs font-semibold">
            Unpaid quotes this customer already has
          </legend>
          {candidates.map((candidate) => (
            <label key={candidate.ref} className="flex items-start gap-2 py-1 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={replaces.includes(candidate.ref)}
                onChange={(event) =>
                  setReplaces((current) =>
                    event.target.checked
                      ? [...current, candidate.ref]
                      : current.filter((ref) => ref !== candidate.ref),
                  )
                }
              />
              <span>
                Cancel <span className="font-mono text-xs">{candidate.ref}</span>{" "}
                ({candidate.legs} {candidate.legs === 1 ? "leg" : "legs"},{" "}
                {formatNad(candidate.total)}) and replace it with this one
              </span>
            </label>
          ))}
          <p className="text-muted-foreground mt-1 text-xs">
            A cancelled quote&apos;s link stops taking payment. Untick to keep
            both.
          </p>
        </fieldset>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button
        type="button"
        onClick={create}
        disabled={saving || total <= 0}
        className="press h-11"
      >
        {saving
          ? "Creating…"
          : `Create the quote for ${formatNad(total)} and get a link`}
      </Button>
    </div>
  );
}

function CardField({
  id,
  label,
  value,
  onChange,
  ...props
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "onChange" | "value" | "id">) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </div>
  );
}
