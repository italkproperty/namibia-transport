"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePublishedRoutePrice, type SaveResult } from "@/lib/pricing/actions";
import { formatNad } from "@/lib/money";

type PublishedRoute = {
  id: string;
  slug: string;
  originLabel: string;
  destinationLabel: string;
  category: string;
  fixedPrice: string;
  defaultDriverPayout: string;
};

function RoutePriceRow({ route }: { route: PublishedRoute }) {
  const [state, action, pending] = useActionState<SaveResult | null, FormData>(
    savePublishedRoutePrice,
    null,
  );

  const price = Number(route.fixedPrice);
  const payout = Number(route.defaultDriverPayout);
  const contribution = price - payout;
  const margin = price > 0 ? (contribution / price) * 100 : 0;

  return (
    <form
      action={action}
      className="grid gap-3 border-b py-3 last:border-0 md:grid-cols-[1.7fr_0.7fr_0.7fr_0.8fr_auto] md:items-center"
    >
      <input type="hidden" name="routeId" value={route.id} />

      <div className="min-w-0">
        <p className="text-sm font-medium">
          {route.originLabel} → {route.destinationLabel}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {route.category} · {route.slug}
        </p>
      </div>

      <div>
        <p className="text-muted-foreground text-xs">Published fare</p>
        <Input
          name="price"
          type="number"
          inputMode="numeric"
          min={100}
          max={50000}
          step={10}
          defaultValue={price}
          className="mt-1 h-9"
          aria-label={`Published fare for ${route.originLabel} to ${route.destinationLabel}`}
        />
      </div>

      <div>
        <p className="text-muted-foreground text-xs">Driver payout</p>
        <p className="tabular mt-1 text-sm font-medium">
          {formatNad(route.defaultDriverPayout)}
        </p>
      </div>

      <div>
        <p className="text-muted-foreground text-xs">Our contribution</p>
        <p className="tabular mt-1 text-sm font-medium">
          {formatNad(String(contribution.toFixed(2)))}
          <span className="text-muted-foreground ml-1 text-xs">
            ({margin.toFixed(0)}%)
          </span>
        </p>
      </div>

      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>

      {state && !state.ok && (
        <p role="alert" className="text-destructive text-xs md:col-span-5">
          {state.message}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-brand text-xs md:col-span-5">
          Saved. New bookings use the new fare. Existing bookings keep their
          snapshot.
        </p>
      )}
    </form>
  );
}

export function RoutePricingForm({
  routes,
  contributionRate,
}: {
  routes: PublishedRoute[];
  contributionRate: number;
}) {
  return (
    <section className="bg-card rounded-xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">Published route prices</h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-xs text-pretty">
          This is the customer-facing price of record. Change a route here when
          the commercial fare changes. The driver payout is recalculated from
          the current {Math.round(contributionRate * 100)}% contribution target,
          so price and economics cannot silently drift apart.
        </p>
      </div>

      {routes.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No active routes are available to edit.
        </p>
      ) : (
        <div className="mt-3">
          {routes.map((route) => (
            <RoutePriceRow
              key={route.id}
              route={route}
            />
          ))}
        </div>
      )}
    </section>
  );
}
