"use client";

import * as React from "react";

import { PlaceSearch, type PlaceOption } from "@/components/admin/place-search";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { modelJourney } from "@/lib/network/journey";
import { formatNad } from "@/lib/money";

/**
 * What the road model says this trip is worth, beside the box an operator
 * types a fare into.
 *
 * ## Why this exists
 *
 * The manual quote form had no number on it. An operator quoting Hosea Kutako
 * to a lodge near Sossusvlei — a pair the model prices to the rand — typed a
 * figure from memory, and typed a different one the next time. Three separate
 * failures came out of that, and a traveller found all three:
 *
 *   The fare varied between attempts at the same trip, because nothing
 *   anchored it.
 *
 *   The vehicle named on the quote had no relationship to the fare. The class
 *   dropdown and the price box are independent fields, so a quote can say
 *   "Private Car" above a number priced for anything at all.
 *
 *   A return leg went into the notes as a sentence. The traveller read the
 *   quote, saw one journey and a note, and emailed to ask whether the return
 *   was included — which is the quote failing at the only job it has.
 *
 * ## Why it is a reference and not the price
 *
 * It does not overwrite anything. An agreed fare is an agreed fare: a partner
 * may have quoted something specific, a repeat client may have a number, and
 * the operator is on the phone. What it removes is the *blind* part — the
 * model's figure is on screen, one press fills the box, and a fare far from it
 * is a deliberate choice rather than an accident.
 *
 * The model runs in the browser here, which is safe because
 * `lib/pricing/cost-model.ts` and the road network are pure data with no
 * server-only import. This is a reference shown to staff behind the admin
 * gate, never a price sent to a traveller: the fare that reaches the booking
 * is the one typed into the form and re-read server-side, exactly as before.
 */
export function FareReference({
  places,
  onUse,
}: {
  places: PlaceOption[];
  onUse: (amount: number) => void;
}) {
  const [from, setFrom] = React.useState<string | null>("hosea-kutako");
  const [to, setTo] = React.useState<string | null>(null);
  const [returning, setReturning] = React.useState(true);

  const quote = React.useMemo(() => {
    if (!from || !to || from === to) return null;

    const out = modelJourney(from, to);
    if (!out) return null;

    // The return is priced as its own leg rather than doubled: the backhaul
    // differs by direction, so a car going back to Windhoek is not the same
    // economics as one going out to the desert, and doubling would overcharge
    // the way home.
    const back = returning ? modelJourney(to, from) : null;

    const outbound = Number(out.route.fixedPrice);
    const inbound = back ? Number(back.route.fixedPrice) : 0;

    return {
      outbound,
      inbound,
      total: outbound + inbound,
      km: out.road.km,
      gravelKm: out.road.gravelKm,
      hours: out.road.minutes / 60,
    };
  }, [from, to, returning]);

  return (
    <div className="border-border/70 bg-muted/30 rounded-xl border p-4">
      <p className="text-sm font-semibold">What the model says</p>
      <p className="text-muted-foreground mt-1 text-xs text-pretty">
        Pick the nearest modelled places to price the trip. The traveller still
        sees whatever you typed in the labels above — this only produces a
        figure to start from.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ref-from">Price from</Label>
          <PlaceSearch
            id="ref-from"
            places={places}
            value={from}
            onSelect={setFrom}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ref-to">Price to</Label>
          <PlaceSearch id="ref-to" places={places} value={to} onSelect={setTo} />
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={returning}
          onChange={(event) => setReturning(event.target.checked)}
          className="size-4"
        />
        Include the return leg
      </label>

      {quote && (
        <div className="mt-4 space-y-2 border-t pt-3">
          <Row label="Outbound" value={quote.outbound} />
          {returning && <Row label="Return" value={quote.inbound} />}
          <div className="flex items-baseline justify-between gap-4 border-t pt-2 text-sm font-semibold">
            <span>{returning ? "Both legs" : "One way"}</span>
            <span className="tabular">{formatNad(String(quote.total))}</span>
          </div>
          <p className="text-muted-foreground text-xs text-pretty">
            {Math.round(quote.km)} km each way
            {quote.gravelKm > 0 &&
              `, ${Math.round(quote.gravelKm)} km of it gravel`}
            , about {quote.hours.toFixed(1)} hours driving. Baseline vehicle;
            a costed class prices higher on the distance, not on the hours.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="press mt-1"
            onClick={() => onUse(quote.total)}
          >
            Use {formatNad(String(quote.total))} as the fare
          </Button>
        </div>
      )}

      {from && to && from === to && (
        <p className="text-muted-foreground mt-3 text-xs">
          Pick two different places.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-muted-foreground flex items-baseline justify-between gap-4 text-sm">
      <span>{label}</span>
      <span className="tabular">{formatNad(String(value))}</span>
    </div>
  );
}
