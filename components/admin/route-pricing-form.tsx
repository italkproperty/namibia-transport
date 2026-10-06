"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  resetPublishedVehiclePrice,
  savePublishedVehiclePrice,
  type SaveResult,
} from "@/lib/pricing/actions";
import { formatNad } from "@/lib/money";

type VehicleClass = {
  id: string;
  name: string;
  priceMultiplier: string;
};

type PublishedRoute = {
  id: string;
  slug: string;
  originLabel: string;
  destinationLabel: string;
  category: string;
  fixedPrice: string;
  defaultDriverPayout: string;
  vehiclePrices: Record<string, { customerPrice: string; driverPayout: string }>;
};

function VehiclePriceEditor({
  route,
  vehicleClass,
}: {
  route: PublishedRoute;
  vehicleClass: VehicleClass;
}) {
  const [state, action, pending] = useActionState<SaveResult | null, FormData>(
    savePublishedVehiclePrice,
    null,
  );
  const [resetState, resetAction, resetPending] = useActionState<
    SaveResult | null,
    FormData
  >(resetPublishedVehiclePrice, null);

  const override = route.vehiclePrices[vehicleClass.id];
  const automaticPrice = Math.round(
    Number(route.fixedPrice) * Number(vehicleClass.priceMultiplier),
  );
  const currentPrice = override
    ? Number(override.customerPrice)
    : automaticPrice;

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{vehicleClass.name}</p>
        <span
          className={
            override
              ? "text-brand text-[0.68rem] font-medium uppercase"
              : "text-muted-foreground text-[0.68rem] uppercase"
          }
        >
          {override ? "Custom" : "Automatic"}
        </span>
      </div>

      <form action={action} className="mt-2 flex items-end gap-2">
        <input type="hidden" name="routeId" value={route.id} />
        <input type="hidden" name="vehicleClassId" value={vehicleClass.id} />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={route.id + "-" + vehicleClass.id + "-price"}
            className="text-muted-foreground text-xs"
          >
            Customer fare
          </label>
          <Input
            id={route.id + "-" + vehicleClass.id + "-price"}
            name="price"
            type="number"
            inputMode="numeric"
            min={100}
            max={50000}
            step={10}
            defaultValue={currentPrice}
            className="mt-1 h-9"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>

      <div className="text-muted-foreground mt-2 flex items-center justify-between gap-3 text-xs">
        <span>
          {override
            ? "Automatic would be " + formatNad(String(automaticPrice))
            : "Uses ×" + vehicleClass.priceMultiplier + " of " + formatNad(route.fixedPrice)}
        </span>
        {override && (
          <form action={resetAction}>
            <input type="hidden" name="routeId" value={route.id} />
            <input type="hidden" name="vehicleClassId" value={vehicleClass.id} />
            <button
              type="submit"
              disabled={resetPending}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {resetPending ? "Resetting…" : "Reset"}
            </button>
          </form>
        )}
      </div>

      {(state && !state.ok) || (resetState && !resetState.ok) ? (
        <p role="alert" className="text-destructive mt-2 text-xs">
          {state && !state.ok
            ? state.message
            : resetState && !resetState.ok
              ? resetState.message
              : null}
        </p>
      ) : null}
      {(state?.ok || resetState?.ok) && (
        <p role="status" className="text-brand mt-2 text-xs">
          Saved. New bookings use the new fare; existing bookings keep their snapshot.
        </p>
      )}
    </div>
  );
}

export function RoutePricingForm({
  routes,
  classes,
}: {
  routes: PublishedRoute[];
  classes: VehicleClass[];
}) {
  return (
    <section className="bg-card rounded-xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">Published route prices</h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-xs text-pretty">
          Edit the customer-facing fare for each vehicle class on each route.
          If you leave a class on Automatic, it uses the class multiplier.
          Custom fares are stored per route and vehicle, so changing the SUV
          price does not change the Private Car or every other route.
        </p>
      </div>

      {routes.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No active routes are available to edit.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {routes.map((route) => (
            <div key={route.id} className="border-b pb-4 last:border-0 last:pb-0">
              <div className="mb-3">
                <p className="text-sm font-medium">
                  {route.originLabel} → {route.destinationLabel}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {route.category} · {route.slug} · baseline {formatNad(route.fixedPrice)}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {classes.map((vehicleClass) => (
                  <VehiclePriceEditor
                    key={vehicleClass.id}
                    route={route}
                    vehicleClass={vehicleClass}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
