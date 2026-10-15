"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveCharterCostSettings, type CharterSettingsSaveResult } from "@/lib/charter/settings-actions";

type VehicleProfile = {
  id: string;
  name: string;
  fuelType: "diesel" | "petrol" | null;
  litresPer100Km: number | null;
  fuelPricePerLitre: number | null;
  nonFuelRunningCostPerKm: number | null;
};

export function CharterCostSettingsForm({
  profiles,
  targetContributionMargin,
  paymentFeeRate,
  migrationReady,
}: {
  profiles: VehicleProfile[];
  targetContributionMargin: number;
  paymentFeeRate: number;
  migrationReady: boolean;
}) {
  const [state, action, pending] = useActionState<CharterSettingsSaveResult | null, FormData>(
    saveCharterCostSettings,
    null,
  );
  const fieldError = (key: string) =>
    state && !state.ok ? state.fieldErrors?.[key] : undefined;

  return (
    <section className="bg-card space-y-4 rounded-xl border p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold">Charter costing profiles</h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-xs leading-relaxed">
          These inputs are isolated from published airport-transfer fares. They
          are used for bespoke multi-stop quotes only. Fuel is calculated from
          driven kilometres × litres per 100 km × current fuel price; non-fuel
          running cost excludes fuel.
        </p>
      </div>

      {!migrationReady && (
        <p className="border-warning/40 bg-warning/10 rounded-lg border p-3 text-sm">
          The database migration is not detected yet. Run <code>db/manual/RUN-ME.sql</code>
          in Supabase before saving charter profiles.
        </p>
      )}

      <form action={action} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="charter-target-margin">
              Target contribution margin (%)
            </label>
            <Input
              id="charter-target-margin"
              name="targetContributionMargin"
              type="number"
              min="5"
              max="75"
              step="1"
              defaultValue={Math.round(targetContributionMargin * 100)}
              aria-invalid={Boolean(fieldError("targetContributionMargin"))}
            />
            {fieldError("targetContributionMargin") && (
              <p className="text-destructive text-xs">{fieldError("targetContributionMargin")}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="charter-payment-fee">
              Payment fee (%)
            </label>
            <Input
              id="charter-payment-fee"
              name="paymentFeeRate"
              type="number"
              min="0"
              max="15"
              step="0.1"
              defaultValue={Number((paymentFeeRate * 100).toFixed(1))}
              aria-invalid={Boolean(fieldError("paymentFeeRate"))}
            />
            {fieldError("paymentFeeRate") && (
              <p className="text-destructive text-xs">{fieldError("paymentFeeRate")}</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {profiles.map((profile) => {
            const prefix = `profile:${profile.id}:`;
            const fields = [
              {
                key: "litresPer100Km",
                label: "Fuel consumption",
                unit: "L/100 km",
                value: profile.litresPer100Km ?? "",
                min: 2,
                max: 40,
                step: 0.1,
              },
              {
                key: "fuelPricePerLitre",
                label: "Fuel price",
                unit: "N$/litre",
                value: profile.fuelPricePerLitre ?? "",
                min: 10,
                max: 80,
                step: 0.01,
              },
              {
                key: "nonFuelRunningCostPerKm",
                label: "Non-fuel running cost",
                unit: "N$/km",
                value: profile.nonFuelRunningCostPerKm ?? "",
                min: 0,
                max: 20,
                step: 0.1,
              },
            ] as const;
            return (
              <div key={profile.id} className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold">{profile.name}</h3>
                <input type="hidden" name={`${prefix}id`} value={profile.id} />
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium" htmlFor={`${profile.id}-fuelType`}>Fuel type</label>
                    <select
                      id={`${profile.id}-fuelType`}
                      name={`${prefix}fuelType`}
                      defaultValue={profile.fuelType ?? ""}
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      aria-invalid={Boolean(fieldError(`${prefix}fuelType`))}
                    >
                      <option value="" disabled>Choose fuel</option>
                      <option value="diesel">Diesel</option>
                      <option value="petrol">Petrol</option>
                    </select>
                    {fieldError(`${prefix}fuelType`) && (
                      <p className="text-destructive text-xs">{fieldError(`${prefix}fuelType`)}</p>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {fields.map((field) => {
                      const name = `${prefix}${field.key}`;
                      return (
                        <div key={field.key} className="space-y-1">
                          <label className="block text-xs font-medium" htmlFor={name}>
                            {field.label}
                          </label>
                          <Input
                            id={name}
                            name={name}
                            type="number"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            defaultValue={field.value}
                            aria-invalid={Boolean(fieldError(name))}
                            className="h-9"
                          />
                          <span className="text-muted-foreground text-[11px]">{field.unit}</span>
                          {fieldError(name) && (
                            <p className="text-destructive text-xs">{fieldError(name)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending || !migrationReady}>
            {pending ? "Saving…" : "Save charter profiles"}
          </Button>
          {state && !state.ok && !state.fieldErrors && (
            <p role="alert" className="text-destructive text-xs">{state.message}</p>
          )}
          {state?.ok && <p role="status" className="text-brand text-xs">Charter profiles saved.</p>}
        </div>
      </form>
    </section>
  );
}
