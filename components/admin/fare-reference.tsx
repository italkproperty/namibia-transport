"use client";

import * as React from "react";

import { PlaceSearch, type PlaceOption } from "@/components/admin/place-search";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatNad } from "@/lib/money";
import type { PricingConstants } from "@/lib/pricing/cost-model";
import { referenceQuote, type ClassProfile } from "@/lib/pricing/reference";

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
 *
 * ## Every class at once
 *
 * An enquiry is rarely "what does a sedan cost" — it is two people with four
 * bags asking what their options are, and the operator needs both numbers in
 * the same breath to answer. Pricing one class at a time also invited the
 * exact mistake that started this: the fare box and the vehicle dropdown are
 * separate fields, so a quote could say one class above a price computed for
 * another. Taking a price here sets the vehicle with it, which is why `onUse`
 * carries both.
 */
/**
 * A class the panel can price. `costed` is false when it has no per-kilometre
 * costs and is still on the legacy multiplier — worth saying on screen,
 * because the figure is then an estimate of an estimate.
 */
export type QuotableClass = ClassProfile;

export function FareReference({
  places,
  classes,
  constants,
  onUse,
}: {
  places: PlaceOption[];
  classes: QuotableClass[];
  constants: PricingConstants;
  onUse: (amount: number, vehicleClassId: string) => void;
}) {
  const [from, setFrom] = React.useState<string | null>("hosea-kutako");
  const [to, setTo] = React.useState<string | null>(null);
  const [returning, setReturning] = React.useState(true);

  const rows = React.useMemo(
    () => referenceQuote(from, to, returning, classes, constants),
    [from, to, returning, classes, constants],
  );

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

      {rows && rows.rows.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="text-muted-foreground text-left text-xs">
                  <th className="pb-1.5 font-medium">Vehicle</th>
                  <th className="pb-1.5 text-right font-medium">Out</th>
                  {returning && (
                    <th className="pb-1.5 text-right font-medium">Back</th>
                  )}
                  <th className="pb-1.5 text-right font-medium">Total</th>
                  <th className="pb-1.5" />
                </tr>
              </thead>
              <tbody>
                {rows.rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2 pr-3">
                      {row.name}
                      {!row.costed && (
                        <span className="text-muted-foreground block text-xs">
                          not costed — from the old multiplier
                        </span>
                      )}
                    </td>
                    <td className="tabular py-2 text-right">
                      {formatNad(String(row.outbound))}
                    </td>
                    {returning && (
                      <td className="tabular py-2 text-right">
                        {formatNad(String(row.inbound))}
                      </td>
                    )}
                    <td className="tabular py-2 text-right font-semibold">
                      {formatNad(String(row.total))}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="press"
                        onClick={() => onUse(row.total, row.id)}
                      >
                        Use
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-muted-foreground mt-2 text-xs text-pretty">
            {Math.round(rows.km)} km each way
            {rows.gravelKm > 0 &&
              `, ${Math.round(rows.gravelKm)} km of it gravel`}
            , about {rows.hours.toFixed(1)} hours driving
            {rows.nights > 0 &&
              `, ${rows.nights} night${rows.nights === 1 ? "" : "s"} away for the driver`}
            . Pressing Use fills the fare <em>and</em> selects that vehicle, so
            the quote cannot name one class beside another&rsquo;s price.
          </p>
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
