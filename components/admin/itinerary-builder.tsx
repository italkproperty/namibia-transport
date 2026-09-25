"use client";

import * as React from "react";
import {
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
  const [stops, setStops] = React.useState<Stop[]>([
    { key: 1, slug: "hosea-kutako", label: "", nights: 0 },
    { key: 2, slug: null, label: "", nights: 2 },
    { key: 3, slug: "hosea-kutako", label: "", nights: 0 },
  ]);
  const nextKey = React.useRef(4);

  const [priceState, price, pricing] = React.useActionState<
    PriceState,
    FormData
  >(priceItineraryAction, null);
  const [saveState, save, saving] = React.useActionState<SaveState, FormData>(
    saveItineraryAction,
    null,
  );
  const [copied, setCopied] = React.useState(false);
  const [whatsapp, setWhatsapp] = React.useState("");

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
              className="bg-card grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr_10rem_5rem_auto] sm:items-center"
            >
              <span
                className="text-muted-foreground hidden sm:block"
                aria-hidden
              >
                <GripVerticalIcon className="size-4" />
              </span>

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
                <span className="tabular w-24 text-right font-medium">
                  {formatNad(leg.price)}
                </span>
              </li>
            ))}
          </ul>

          <details className="mt-3">
            <summary className="text-muted-foreground cursor-pointer text-xs">
              What the same trip costs if they drive it themselves
            </summary>
            <ul className="mt-2 grid gap-1.5">
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
          <Field label="Full name" name="fullName" required />
          <Field
            label="WhatsApp number"
            name="whatsapp"
            required
            placeholder="+264 81 123 4567"
            value={whatsapp}
            onChange={setWhatsapp}
          />
          <Field label="Email" name="email" type="email" hint="Optional." />
          <Field
            label="Passengers"
            name="passengers"
            type="number"
            defaultValue="2"
          />
          <Field
            label="First leg departs"
            name="startDate"
            type="date"
            required
            hint="Later legs fall out of the nights above."
          />
          <Field label="At" name="startTime" type="time" defaultValue="08:00" />
          <Field
            label="Agreed total (N$)"
            name="agreedTotal"
            inputMode="decimal"
            hint="Only if you settled on a different number. Blank uses the price above."
          />
          <Field
            label="Large cases"
            name="luggageCount"
            type="number"
            defaultValue="0"
          />
          <Field
            label="Note on the quote"
            name="notes"
            className="sm:col-span-2"
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
