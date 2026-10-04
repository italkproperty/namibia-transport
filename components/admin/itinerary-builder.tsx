"use client";

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  GripVerticalIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";

import { PlaceSearch, type PlaceOption } from "@/components/admin/place-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  priceItineraryAction,
  saveItineraryAction,
  type PriceState,
  type SaveState,
} from "@/lib/admin/itinerary-actions";
import { whatsappLink } from "@/lib/company";
import { formatDuration } from "@/lib/format";
import { formatNad } from "@/lib/money";
import type { AIQuoteDraft } from "@/lib/admin/ai-quote-actions";

type Stop = { key: number; slug: string | null; label: string; nights: number };

/**
 * Building a whole trip, one stop at a time.
 *
 * The shape follows how an enquiry actually arrives: the traveller says where
 * they are going in order, and how long they are staying at each place. The
 * price for the whole thing — including the nights the driver is away, which a
 * per-leg sum quietly loses — comes back from the server on request, because
 * nothing in this codebase lets a browser compute a fare.
 *
 * "Called something else?" is the field that makes this usable in Namibia. The
 * network models roads between towns, not the hundreds of lodges along them,
 * so a stop is routed through the nearest town and displayed under whatever
 * the traveller actually booked.
 */
export function ItineraryBuilder({ places }: { places: PlaceOption[] }) {
  const [vehicleClassId, setVehicleClassId] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [passengers, setPassengers] = React.useState("2");
  const [luggageCount, setLuggageCount] = React.useState("0");
  const [startDate, setStartDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("08:00");
  const [agreedTotal, setAgreedTotal] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [legOverrides, setLegOverrides] = React.useState<Record<number, string>>({});
  const [driverPositioningOrigin, setDriverPositioningOrigin] = React.useState("windhoek");
  const [includeDriverPositioning, setIncludeDriverPositioning] = React.useState(true);
  const [returnDriverToBase, setReturnDriverToBase] = React.useState(true);
  const [draggedKey, setDraggedKey] = React.useState<number | null>(null);
  const [dragOverKey, setDragOverKey] = React.useState<number | null>(null);
  const [stops, setStops] = React.useState<Stop[]>([
    { key: 1, slug: "hosea-kutako", label: "", nights: 0 },
    { key: 2, slug: null, label: "", nights: 2 },
    { key: 3, slug: "hosea-kutako", label: "", nights: 0 },
  ]);
  const nextKey = React.useRef(4);

  React.useEffect(() => {
    const onAIQuote = (event: Event) => {
      const draft = (event as CustomEvent<AIQuoteDraft>).detail;
      if (!draft) return;

      const nextStops = draft.stops
        .filter((stop) => stop.slug)
        .map((stop, index) => ({
          key: index + 1,
          slug: stop.slug,
          label: stop.label ?? "",
          nights: Math.max(0, stop.nights || 0),
        }));

      if (nextStops.length >= 2) {
        setStops(nextStops);
        nextKey.current = nextStops.length + 1;
      }

      if (draft.customer.fullName) setFullName(draft.customer.fullName);
      if (draft.customer.whatsapp) setWhatsapp(draft.customer.whatsapp);
      if (draft.customer.email) setEmail(draft.customer.email);
      if (draft.startDate) setStartDate(draft.startDate);
      if (draft.startTime) setStartTime(draft.startTime);
      if (draft.passengers > 0) setPassengers(String(draft.passengers));
      if (draft.luggageCount >= 0) setLuggageCount(String(draft.luggageCount));
      if (draft.agreedTotal > 0) setAgreedTotal(String(draft.agreedTotal));
      if (draft.notes) setNotes(draft.notes);
      setLegOverrides({});
    };

    window.addEventListener("namibia-transport:ai-quote", onAIQuote);
    return () =>
      window.removeEventListener("namibia-transport:ai-quote", onAIQuote);
  }, []);

  const [priceState, price, pricing] = React.useActionState<
    PriceState,
    FormData
  >(priceItineraryAction, null);
  const [saveState, save, saving] = React.useActionState<SaveState, FormData>(
    saveItineraryAction,
    null,
  );
  const [copied, setCopied] = React.useState(false);

  const payload = JSON.stringify(
    stops
      .filter((stop) => stop.slug)
      .map((stop) => ({
        slug: stop.slug,
        label: stop.label.trim() || undefined,
        nights: stop.nights,
      })),
  );

  const update = (key: number, patch: Partial<Stop>) =>
    setStops((current) =>
      current.map((stop) => (stop.key === key ? { ...stop, ...patch } : stop)),
    );

  const moveStop = (fromKey: number, toKey: number) => {
    if (fromKey === toKey) return;
    setStops((current) => {
      const fromIndex = current.findIndex((stop) => stop.key === fromKey);
      const toIndex = current.findIndex((stop) => stop.key === toKey);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const moveStopByOffset = (key: number, offset: number) => {
    setStops((current) => {
      const index = current.findIndex((stop) => stop.key === key);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  if (saveState?.ok) {
    const message = `Hi — here is your quote from Namibia Transport. The full itinerary, the fare and how to pay are here: ${saveState.url}`;
    return (
      <div className="bg-card rounded-xl border p-6">
        <p className="text-success flex items-center gap-2 font-medium">
          <CheckCircle2Icon className="size-5" aria-hidden />
          Quote {saveState.groupRef} created
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {saveState.legCount} legs, {formatNad(saveState.total)} in total. Each
          leg is its own job on the dispatch board; the traveller sees one page.
        </p>

        <div className="bg-muted mt-4 flex items-center gap-2 rounded-lg p-3">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {saveState.url}
          </code>
          <button
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(saveState.url).then(
                () => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                },
                () => undefined,
              )
            }
            aria-label="Copy the link"
            className="press focus-ring text-muted-foreground hover:text-foreground shrink-0 rounded p-1.5"
          >
            {copied ? (
              <CheckCircle2Icon className="text-success size-4" aria-hidden />
            ) : (
              <CopyIcon className="size-4" aria-hidden />
            )}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {whatsapp && (
            <Button asChild className="press">
              <a
                href={whatsappLink(whatsapp, message)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Send it on WhatsApp
              </a>
            </Button>
          )}
          <Button asChild variant="outline" className="press">
            <a href={saveState.url} target="_blank" rel="noopener noreferrer">
              Open the page
              <ExternalLinkIcon className="size-4" aria-hidden />
            </a>
          </Button>
        </div>
      </div>
    );
  }

  const priced = priceState?.ok ? priceState.quotes : null;

  /**
   * Which vehicle the operator is quoting. Defaults to the first class rather
   * than to nothing: an operator who prices a trip and then forgets to pick a
   * vehicle would otherwise save a quote whose legs name no class at all,
   * which is how the last one came to say "Private Car" beside a figure
   * computed for something else.
   */
  const selected =
    priced?.find((entry) => entry.vehicleClassId === vehicleClassId) ??
    priced?.[0] ??
    null;
  const quote = selected?.quote ?? null;

  const effectiveLegPrices = quote
    ? quote.legs.map((leg, index) => {
        const value = Number(legOverrides[index] ?? leg.price);
        return Number.isFinite(value) && value > 0 ? value : leg.price;
      })
    : [];
  const effectiveTotal = effectiveLegPrices.reduce((sum, value) => sum + value, 0);

  return (
    <div className="grid gap-6">
      {/* ------------------------------------------------------- the route */}
      <section>
        <h2 className="mb-1 text-sm font-semibold">Where they are going</h2>
        <p className="text-muted-foreground mb-3 max-w-2xl text-xs leading-relaxed">
          In order. Nights are how long they stay before the next leg.{" "}
          <span className="text-foreground">
            Staying at a lodge or guest farm?
          </span>{" "}
          Those are not in the search — the road model knows towns, gates and
          airports. Pick the nearest town, then put the real name in{" "}
          <span className="text-foreground">Called something else?</span>: we
          price the drive to the town and the traveller sees the lodge.
        </p>

        <ul className="grid gap-2">
          {stops.map((stop, index) => (
            <li
              key={stop.key}
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedKey !== null && draggedKey !== stop.key) {
                  setDragOverKey(stop.key);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedKey !== null) moveStop(draggedKey, stop.key);
                setDraggedKey(null);
                setDragOverKey(null);
              }}
              className={`bg-card grid gap-2 rounded-lg border p-3 transition sm:grid-cols-[auto_1fr_10rem_5rem_auto] sm:items-center ${
                dragOverKey === stop.key ? "border-brand ring-2 ring-brand/20" : ""
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    setDraggedKey(stop.key);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(stop.key));
                  }}
                  onDragEnd={() => {
                    setDraggedKey(null);
                    setDragOverKey(null);
                  }}
                  aria-label={`Drag ${stop.label || "stop"} to reorder`}
                  title="Drag to reorder"
                  className="text-muted-foreground hover:text-foreground focus-ring hidden cursor-grab rounded p-1 active:cursor-grabbing sm:block"
                >
                  <GripVerticalIcon className="size-4" aria-hidden />
                </button>
                <div className="flex sm:hidden">
                  <button
                    type="button"
                    onClick={() => moveStopByOffset(stop.key, -1)}
                    disabled={index === 0}
                    aria-label="Move stop up"
                    className="text-muted-foreground hover:text-foreground focus-ring rounded p-1 disabled:opacity-30"
                  >
                    <ArrowUpIcon className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStopByOffset(stop.key, 1)}
                    disabled={index === stops.length - 1}
                    aria-label="Move stop down"
                    className="text-muted-foreground hover:text-foreground focus-ring rounded p-1 disabled:opacity-30"
                  >
                    <ArrowDownIcon className="size-4" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="min-w-0">
                <Label
                  htmlFor={`stop-${stop.key}`}
                  className="text-muted-foreground mb-1 text-xs"
                >
                  {index === 0
                    ? "Starting at"
                    : index === stops.length - 1
                      ? "Ending at"
                      : `Stop ${index}`}
                </Label>
                <PlaceSearch
                  id={`stop-${stop.key}`}
                  places={places}
                  value={stop.slug}
                  onSelect={(slug) => update(stop.key, { slug })}
                />
              </div>

              <div>
                <Label
                  htmlFor={`label-${stop.key}`}
                  className="text-muted-foreground mb-1 text-xs"
                >
                  Called something else?
                </Label>
                <Input
                  id={`label-${stop.key}`}
                  value={stop.label}
                  placeholder="Lodge or farm name"
                  onChange={(event) =>
                    update(stop.key, { label: event.target.value })
                  }
                  className="h-10"
                />
              </div>

              <div>
                <Label
                  htmlFor={`nights-${stop.key}`}
                  className="text-muted-foreground mb-1 text-xs"
                >
                  Nights
                </Label>
                <Input
                  id={`nights-${stop.key}`}
                  type="number"
                  min={0}
                  value={stop.nights}
                  onChange={(event) =>
                    update(stop.key, { nights: Number(event.target.value) })
                  }
                  className="h-10"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setStops((current) =>
                    current.length > 2
                      ? current.filter((s) => s.key !== stop.key)
                      : current,
                  )
                }
                disabled={stops.length <= 2}
                aria-label={`Remove stop ${index + 1}`}
                className="press focus-ring text-muted-foreground hover:text-destructive justify-self-end rounded p-2 disabled:opacity-30"
              >
                <TrashIcon className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground mt-2 text-xs">
          Drag the grip to change the driving order. Use the arrows on smaller screens.
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="press mt-2"
          onClick={() =>
            setStops((current) => [
              ...current.slice(0, -1),
              { key: nextKey.current++, slug: null, label: "", nights: 2 },
              current[current.length - 1],
            ])
          }
        >
          <PlusIcon className="size-4" aria-hidden />
          Add a stop
        </Button>
      </section>

      <div className="bg-muted/40 rounded-lg border p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Driver positioning</p>
            <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-relaxed">
              Internal logistics only. The customer itinerary stays separate.
              This accounts for the driver's trip from base to the first pickup
              and, when enabled, back to base after the last drop-off.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeDriverPositioning}
              onChange={(event) => setIncludeDriverPositioning(event.target.checked)}
              className="size-4 rounded border"
            />
            Include in quote cost
          </label>
        </div>

        {includeDriverPositioning && (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label
                htmlFor="driver-positioning-origin"
                className="text-muted-foreground mb-1 text-xs"
              >
                Driver base
              </Label>
              <PlaceSearch
                id="driver-positioning-origin"
                places={places}
                value={driverPositioningOrigin}
                onSelect={setDriverPositioningOrigin}
                placeholder="Where is the driver starting?"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={returnDriverToBase}
                onChange={(event) => setReturnDriverToBase(event.target.checked)}
                className="size-4 rounded border"
              />
              Return driver to base
            </label>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ the price */}
      <form action={price}>
        <input type="hidden" name="stops" value={payload} />
        <Button
          type="submit"
          variant="outline"
          disabled={pricing}
          className="press"
        >
          {pricing ? "Pricing…" : "Price this itinerary"}
        </Button>
      </form>

      {priceState && !priceState.ok && (
        <p className="text-destructive text-sm">{priceState.message}</p>
      )}

      {priced && quote && selected && (
        <section className="bg-card rounded-xl border p-4">
          {/* Every class, priced. The operator picks one and that choice is
              saved onto the legs, so the vehicle named on the quote is always
              the vehicle the fare was computed for. */}
          <div className="mb-4 grid gap-2">
            <p className="text-sm font-semibold">Which vehicle</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {priced.map((entry) => {
                const active = entry.vehicleClassId === selected.vehicleClassId;
                return (
                  <button
                    key={entry.vehicleClassId}
                    type="button"
                    onClick={() => setVehicleClassId(entry.vehicleClassId)}
                    aria-pressed={active}
                    className={`focus-ring press rounded-lg border p-3 text-left transition ${
                      active
                        ? "border-brand bg-brand/5"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{entry.name}</span>
                      <span className="tabular text-sm font-semibold">
                        {formatNad(entry.quote.total)}
                      </span>
                    </span>
                    {!entry.costed && (
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        not costed — from the old multiplier
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3 border-t pt-3">
            <h2 className="text-sm font-semibold">
              Driven, all in — {selected.name}
            </h2>
            <p className="tabular text-brand text-2xl font-semibold">
              {formatNad(quote.total)}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {quote.days} days · {quote.nights} nights · {quote.km} km ·{" "}
            {formatDuration(quote.drivingMinutes)} driving · {quote.gravelKm} km
            gravel
          </p>

          <ul className="mt-3 divide-y border-t">
            {quote.legs.map((leg, index) => (
              <li
                key={`${leg.fromLabel}-${leg.toLabel}-${index}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
              >
                <span className="min-w-0 flex-1">
                  {leg.fromLabel} → {leg.toLabel}
                </span>
                <span className="text-muted-foreground text-xs">
                  {leg.km} km · {formatDuration(leg.minutes)}
                </span>
                <div className="w-28">
                  <Label htmlFor={`leg-price-${index}`} className="sr-only">
                    Price for {leg.fromLabel} to {leg.toLabel}
                  </Label>
                  <Input
                    id={`leg-price-${index}`}
                    value={legOverrides[index] ?? ""}
                    placeholder={String(leg.price)}
                    onChange={(event) =>
                      setLegOverrides((current) => ({
                        ...current,
                        [index]: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    className="h-9 text-right tabular"
                  />
                </div>
              </li>
            ))}
          </ul>

          <details className="mt-3">
            <summary className="text-muted-foreground cursor-pointer text-xs">
              What the same trip costs if they drive it themselves
            </summary>
            <ul className="mt-2 grid gap-1.5">
              {effectiveTotal !== quote.total && (
              <p className="text-muted-foreground mt-2 text-xs">
                Operator-adjusted quote total: <strong>{formatNad(effectiveTotal)}</strong>.
                The generated model total was {formatNad(quote.total)}.
              </p>
            )}

            {quote.selfDrive.map((option) => (
                <li
                  key={option.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm"
                >
                  <span className="text-muted-foreground min-w-0 flex-1">
                    {option.label}
                  </span>
                  <span className="tabular font-medium">
                    {formatNad(option.total)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-2 text-xs">
              Vehicle, tyre-and-glass waiver and fuel over the whole distance.
              They still carry the excess; we carry none of it.
            </p>
          </details>
        </section>
      )}

      {/* ------------------------------------------------------- the save */}
      <form action={save} className="grid gap-4">
        <input type="hidden" name="stops" value={payload} />
        <input
          type="hidden"
          name="vehicleClassId"
          value={selected?.vehicleClassId ?? ""}
        />

        <h2 className="text-sm font-semibold">Who it is for</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="fullName" required value={fullName} onChange={setFullName} />
          <Field
            label="WhatsApp number"
            name="whatsapp"
            required
            placeholder="+264 81 123 4567"
            value={whatsapp}
            onChange={setWhatsapp}
          />
          <Field label="Email" name="email" type="email" hint="Optional." value={email} onChange={setEmail} />
          <Field
            label="Passengers"
            name="passengers"
            type="number"
            value={passengers}
            onChange={setPassengers}
          />
          <Field
            label="First leg departs"
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={setStartDate}
            hint="Later legs fall out of the nights above."
          />
          <Field label="At" name="startTime" type="time" value={startTime} onChange={setStartTime} />
          <Field
            label="Agreed total (N$)"
            name="agreedTotal"
            inputMode="decimal"
            value={agreedTotal}
            onChange={setAgreedTotal}
            hint="Use this only when you want one overall agreed total. Individual leg prices above override the model."
          />
          <Field
            label="Large cases"
            name="luggageCount"
            type="number"
            value={luggageCount}
            onChange={setLuggageCount}
          />
          <Field
            label="Note on the quote"
            name="notes"
            className="sm:col-span-2"
            value={notes}
            onChange={setNotes}
            hint="The traveller sees this — what is included, anything agreed on the call."
          />
        </div>

        {saveState && !saveState.ok && (
          <p className="text-destructive text-sm">{saveState.message}</p>
        )}

        <div>
          <Button type="submit" disabled={saving} className="press h-11">
            {saving ? "Creating…" : "Create the quote and get a link"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  hint,
  className,
  value,
  onChange,
  ...props
}: {
  label: string;
  name: string;
  hint?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "onChange" | "value">) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        {...(onChange
          ? { value, onChange: (e) => onChange(e.target.value) }
          : {})}
        {...props}
      />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
