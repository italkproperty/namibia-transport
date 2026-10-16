"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveCharterCostSettings,
  saveCharterVehicleCostProfile,
  type CharterSettingsSaveResult,
} from "@/lib/charter/settings-actions";

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
  const fieldError = (key: string) => state && !state.ok ? state.fieldErrors?.[key] : undefined;

  return (
    <section className="bg-card space-y-4 rounded-xl border p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold">Charter costing profiles</h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-xs leading-relaxed">
          These settings are isolated from published airport-transfer fares and apply to bespoke multi-stop quotes.
          Fuel cost is calculated from driven kilometres × litres per 100 km × fuel price per litre. Save each vehicle
          separately, so an incomplete SUV profile does not block saving a Polo profile.
        </p>
      </div>

      {!migrationReady && (
        <p className="border-warning/40 bg-warning/10 rounded-lg border p-3 text-sm">
          The database migration is not detected yet. Run <code>db/manual/RUN-ME.sql</code> in Supabase before saving these settings.
        </p>
      )}

      <form action={action} className="space-y-3 rounded-lg border p-3">
        <h3 className="text-sm font-semibold">Shared charter pricing rules</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="charter-target-margin">Target contribution margin (%)</label>
            <Input id="charter-target-margin" name="targetContributionMargin" type="number" min="5" max="75" step="1"
              defaultValue={Math.round(targetContributionMargin * 100)} aria-invalid={Boolean(fieldError("targetContributionMargin"))} />
            {fieldError("targetContributionMargin") && <p className="text-destructive text-xs">{fieldError("targetContributionMargin")}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="charter-payment-fee">Payment fee (%)</label>
            <Input id="charter-payment-fee" name="paymentFeeRate" type="number" min="0" max="15" step="0.1"
              defaultValue={Number((paymentFeeRate * 100).toFixed(1))} aria-invalid={Boolean(fieldError("paymentFeeRate"))} />
            {fieldError("paymentFeeRate") && <p className="text-destructive text-xs">{fieldError("paymentFeeRate")}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending || !migrationReady}>{pending ? "Saving…" : "Save shared charter rules"}</Button>
          {state && !state.ok && !state.fieldErrors && <p role="alert" className="text-destructive text-xs">{state.message}</p>}
          {state?.ok && <p role="status" className="text-brand text-xs">Shared charter rules saved.</p>}
        </div>
      </form>

      <div>
        <h3 className="text-sm font-semibold">Fuel and running costs by vehicle</h3>
        <p className="text-muted-foreground mt-1 text-xs">Enter the actual consumption and current pump price for each vehicle class. Each card saves independently.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {profiles.map((profile) => (
          <VehicleProfileCard key={profile.id} profile={profile} migrationReady={migrationReady} />
        ))}
      </div>
    </section>
  );
}

function VehicleProfileCard({ profile, migrationReady }: { profile: VehicleProfile; migrationReady: boolean }) {
  const [state, action, pending] = useActionState<CharterSettingsSaveResult | null, FormData>(
    saveCharterVehicleCostProfile,
    null,
  );
  const fieldError = (key: string) => state && !state.ok ? state.fieldErrors?.[key] : undefined;

  return (
    <form action={action} className="rounded-lg border p-3 space-y-3">
      <input type="hidden" name="vehicleClassId" value={profile.id} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">{profile.name}</h4>
        <span className="text-muted-foreground text-xs">{profile.fuelPricePerLitre == null ? "Not costed yet" : "Saved profile loaded"}</span>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor={`fuel-type-${profile.id}`}>Fuel type</label>
        <select id={`fuel-type-${profile.id}`} name="fuelType" defaultValue={profile.fuelType ?? ""}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm" aria-invalid={Boolean(fieldError("fuelType"))}>
          <option value="" disabled>Choose fuel</option>
          <option value="diesel">Diesel</option>
          <option value="petrol">Petrol</option>
        </select>
        {fieldError("fuelType") && <p className="text-destructive text-xs">{fieldError("fuelType")}</p>}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <CostInput id={`consumption-${profile.id}`} name="litresPer100Km" label="Fuel consumption" unit="L/100 km"
          value={profile.litresPer100Km} min={2} max={40} step={0.1} error={fieldError("litresPer100Km")} />
        <CostInput id={`fuel-price-${profile.id}`} name="fuelPricePerLitre" label="Fuel price" unit="N$/litre"
          value={profile.fuelPricePerLitre} min={10} max={80} step={0.01} error={fieldError("fuelPricePerLitre")} />
        <CostInput id={`nonfuel-${profile.id}`} name="nonFuelRunningCostPerKm" label="Other running cost" unit="N$/km"
          value={profile.nonFuelRunningCostPerKm} min={0} max={20} step={0.1} error={fieldError("nonFuelRunningCostPerKm")} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !migrationReady}>{pending ? "Saving…" : `Save ${profile.name} costs`}</Button>
        {state && !state.ok && !state.fieldErrors && <p role="alert" className="text-destructive text-xs">{state.message}</p>}
        {state?.ok && <p role="status" className="text-brand text-xs">{profile.name} costs saved.</p>}
      </div>
    </form>
  );
}

function CostInput({ id, name, label, unit, value, min, max, step, error }: {
  id: string; name: string; label: string; unit: string; value: number | null;
  min: number; max: number; step: number; error?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium" htmlFor={id}>{label}</label>
      <Input id={id} name={name} type="number" min={min} max={max} step={step}
        defaultValue={value ?? ""} aria-invalid={Boolean(error)} className="h-9" required />
      <span className="text-muted-foreground text-[11px]">{unit}</span>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
