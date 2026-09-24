"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveVehicleCost, type SaveResult } from "@/lib/pricing/actions";
import type { VehicleCostProfile } from "@/lib/pricing/cost-model";
import { CLASS_BOUNDS } from "@/lib/pricing/bounds";

/** Per-kilometre costs for one class — the only dimension a vehicle moves. */
export function VehicleCostForm({
  slug,
  name,
  multiplier,
  costed,
  profile,
}: {
  slug: string;
  name: string;
  multiplier: string;
  costed: boolean;
  profile: VehicleCostProfile;
}) {
  const [state, action, pending] = useActionState<SaveResult | null, FormData>(
    saveVehicleCost,
    null,
  );

  const errorFor = (key: string) =>
    state && !state.ok ? state.errors?.find((e) => e.field === key)?.message : undefined;

  const fields = [
    { key: "runningCostTar", value: profile.runningCost.tar },
    { key: "runningCostGravel", value: profile.runningCost.gravel },
    { key: "minimumDriverNeed", value: profile.minimumDriverNeed },
  ] as const;

  return (
    <form action={action} className="bg-card rounded-xl border p-4">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{name}</h3>
        {!costed && (
          <span className="text-muted-foreground text-xs">
            not costed — priced at ×{multiplier}
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {fields.map(({ key, value }) => {
          const bound = CLASS_BOUNDS[key];
          const error = errorFor(key);
          return (
            <div key={key} className="space-y-1">
              <label
                htmlFor={`${slug}-${key}`}
                className="block text-xs font-medium"
              >
                {bound.label}
                <span className="text-muted-foreground ml-1 font-normal">
                  {bound.unit}
                </span>
              </label>
              <Input
                id={`${slug}-${key}`}
                name={key}
                type="number"
                inputMode="decimal"
                step={bound.step}
                min={bound.min}
                max={bound.max}
                defaultValue={Number(value.toFixed(2))}
                aria-invalid={Boolean(error)}
                className="h-9"
              />
              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state && !state.ok && !state.errors?.length && (
          <span role="alert" className="text-destructive text-xs">
            {state.message}
          </span>
        )}
        {state?.ok && (
          <span role="status" className="text-brand text-xs">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
