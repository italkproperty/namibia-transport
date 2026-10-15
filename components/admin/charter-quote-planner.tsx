"use client";

import * as React from "react";
import { PlusIcon, TrashIcon, SearchIcon, RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNad } from "@/lib/money";
import {
  priceCharterItineraryAction,
  searchCharterDestinationAction,
  type CharterPriceState,
} from "@/lib/admin/charter-quote-actions";
import type { ResolvedDestination, DestinationCandidate } from "@/lib/maps/charter-routing";

type VehicleOption = { id: string; name: string; hasProfile: boolean };

function DestinationField({
  index,
  value,
  onSelect,
  onRemove,
  canRemove,
}: {
  index: number;
  value: ResolvedDestination | null;
  onSelect: (value: ResolvedDestination | null) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [query, setQuery] = React.useState(value?.label ?? "");
  const [candidates, setCandidates] = React.useState<DestinationCandidate[]>([]);
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => setQuery(value?.label ?? ""), [value?.label]);

  const search = () => {
    setError("");
    setCandidates([]);
    startTransition(async () => {
      const result = await searchCharterDestinationAction(query);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCandidates(result.candidates);
      if (result.candidates.length === 1) setError("One match found. Confirm it below to use its map coordinates.");
    });
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Stop {index + 1}</p>
        {canRemove && <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove stop ${index + 1}`}><TrashIcon className="size-4" /></Button>}
      </div>
      <div className="flex gap-2">
        <Input value={query} onChange={(event) => { setQuery(event.target.value); onSelect(null); setCandidates([]); }} placeholder="Lodge, town, airport or address" aria-label={`Destination ${index + 1}`} />
        <Button type="button" onClick={search} disabled={pending || query.trim().length < 3}><SearchIcon className="mr-1 size-4" />{pending ? "Searching…" : "Search"}</Button>
      </div>
      {value && <p className="text-xs text-emerald-700">Confirmed location: {value.label} ({value.coordinates.lat.toFixed(5)}, {value.coordinates.lng.toFixed(5)})</p>}
      {error && <p role="status" className="text-xs text-muted-foreground">{error}</p>}
      {candidates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Choose the correct match. A firm price uses the selected map coordinates.</p>
          {candidates.map((candidate) => (
            <button key={candidate.id} type="button" onClick={() => { onSelect({ label: candidate.fullAddress ? `${candidate.name}, ${candidate.fullAddress}` : candidate.name, coordinates: candidate.coordinates, source: "mapbox_geocoding", providerId: candidate.id }); setQuery(candidate.fullAddress ? `${candidate.name}, ${candidate.fullAddress}` : candidate.name); setCandidates([]); setError(""); }} className="block w-full rounded-md border p-2 text-left hover:bg-muted">
              <span className="block text-sm font-medium">{candidate.name}</span>
              {candidate.fullAddress && <span className="block text-xs text-muted-foreground">{candidate.fullAddress}</span>}
              <span className="block text-[11px] text-muted-foreground">{candidate.coordinates.lat.toFixed(5)}, {candidate.coordinates.lng.toFixed(5)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CharterQuotePlanner({ vehicles }: { vehicles: VehicleOption[] }) {
  const [stops, setStops] = React.useState<(ResolvedDestination | null)[]>([null, null]);
  const [state, action, pending] = React.useActionState<CharterPriceState, FormData>(priceCharterItineraryAction, null);
  const [vehicleClassId, setVehicleClassId] = React.useState(vehicles.find((item) => item.hasProfile)?.id ?? "");
  const [positioningKm, setPositioningKm] = React.useState("0");
  const [localKm, setLocalKm] = React.useState("0");

  const serialisedStops = JSON.stringify(stops.filter((stop): stop is ResolvedDestination => Boolean(stop)));
  const updateStop = (index: number, stop: ResolvedDestination | null) => setStops((current) => current.map((item, i) => i === index ? stop : item));

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold"><RouteIcon className="size-5" />Verified charter quote planner</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use actual lodges, camps, gates and addresses. Select each Mapbox match before pricing; this planner does not use town-centre approximations or alter public transfer fares.</p>
      </div>

      <form action={action} className="space-y-5">
        <input type="hidden" name="stops" value={serialisedStops} />
        <div className="space-y-3">
          {stops.map((stop, index) => (
            <DestinationField key={index} index={index} value={stop} onSelect={(value) => updateStop(index, value)} canRemove={stops.length > 2} onRemove={() => setStops((current) => current.filter((_, i) => i !== index))} />
          ))}
          <Button type="button" variant="outline" size="sm" disabled={stops.length >= 10} onClick={() => setStops((current) => [...current, null])}><PlusIcon className="mr-1 size-4" />Add stop</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="charter-vehicle" className="text-sm font-medium">Vehicle class</label>
            <select id="charter-vehicle" name="vehicleClassId" value={vehicleClassId} onChange={(event) => setVehicleClassId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id} disabled={!vehicle.hasProfile}>{vehicle.name}{vehicle.hasProfile ? "" : " — cost profile required"}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="positioningKm" className="text-sm font-medium">Empty positioning distance (km)</label>
            <Input id="positioningKm" name="positioningKm" type="number" min="0" step="1" value={positioningKm} onChange={(event) => setPositioningKm(event.target.value)} />
            <p className="text-xs text-muted-foreground">Only kilometres outside the customer route. Do not count the same distance twice.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="localKm" className="text-sm font-medium">Local excursions / driving (km)</label>
            <Input id="localKm" name="localKm" type="number" min="0" step="1" value={localKm} onChange={(event) => setLocalKm(event.target.value)} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Additional trip costs</h3>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">Enter the total days/nights and rate. Fuel and non-fuel vehicle running costs are calculated separately.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><label htmlFor="driverDays" className="text-xs font-medium">Driver days</label><Input id="driverDays" name="driverDays" type="number" min="0" step="1" defaultValue="1" /></div>
            <div className="space-y-1"><label htmlFor="driverDailyRate" className="text-xs font-medium">Driver cost per day (N$)</label><Input id="driverDailyRate" name="driverDailyRate" type="number" min="0" step="1" defaultValue="0" /></div>
            <div className="space-y-1"><label htmlFor="accommodationNights" className="text-xs font-medium">Driver accommodation nights</label><Input id="accommodationNights" name="accommodationNights" type="number" min="0" step="1" defaultValue="0" /></div>
            <div className="space-y-1"><label htmlFor="accommodationRate" className="text-xs font-medium">Accommodation per night (N$)</label><Input id="accommodationRate" name="accommodationRate" type="number" min="0" step="1" defaultValue="0" /></div>
            <div className="space-y-1"><label htmlFor="parkFees" className="text-xs font-medium">Park / permit fees (N$ total)</label><Input id="parkFees" name="parkFees" type="number" min="0" step="1" defaultValue="0" /></div>
            <div className="space-y-1"><label htmlFor="otherCosts" className="text-xs font-medium">Other supplier costs (N$ total)</label><Input id="otherCosts" name="otherCosts" type="number" min="0" step="1" defaultValue="0" /></div>
          </div>
        </div>
        <Button type="submit" disabled={pending || stops.some((stop) => !stop) || !vehicles.some((vehicle) => vehicle.id === vehicleClassId && vehicle.hasProfile)}>{pending ? "Calculating verified route…" : "Calculate charter cost and price"}</Button>
      </form>

      {state && !state.ok && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{state.message}</p>}
      {state?.ok && (
        <div className="space-y-4 rounded-lg border p-4">
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Suggested customer price · {state.vehicleName}</p><p className="text-3xl font-semibold">{formatNad(state.result.finalPrice.toFixed(2))}</p><p className="text-sm text-muted-foreground">{state.result.route.totalDistanceKm.toFixed(1)} road km · {Math.round(state.result.route.totalDurationMinutes / 60 * 10) / 10} driving hours · {state.result.route.legCount} legs</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Expected operating cost</p><p className="text-lg font-semibold">{formatNad(state.result.costs.expectedCost.toFixed(2))}</p></div>
            <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Contribution after payment fee</p><p className="text-lg font-semibold">{formatNad(state.result.actual.contribution.toFixed(2))}</p><p className="text-xs text-muted-foreground">{(state.result.actual.contributionMargin * 100).toFixed(1)}% contribution margin</p></div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><span>Fuel ({state.result.costs.fuelLitres.toFixed(2)} L)</span><span>{formatNad(state.result.costs.fuelCost.toFixed(2))}</span></div>
            <div className="flex justify-between gap-3"><span>Non-fuel vehicle running cost</span><span>{formatNad(state.result.costs.nonFuelRunningCost.toFixed(2))}</span></div>
            {state.result.costs.itemisedCosts.map((item) => <div key={item.id} className="flex justify-between gap-3"><span>{item.label}</span><span>{formatNad(item.amount.toFixed(2))}</span></div>)}
            <div className="flex justify-between gap-3 border-t pt-2"><span>Estimated payment fee</span><span>{formatNad(state.result.suggested.paymentFee.toFixed(2))}</span></div>
            <div className="flex justify-between gap-3 font-medium"><span>Contribution margin target met</span><span>{state.result.belowTargetMargin ? "No — review required" : "Yes"}</span></div>
          </div>
          {state.result.belowTargetMargin && <p className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900">This price is below the configured target margin. Do not send it without reviewing the economics.</p>}
          <p className="text-xs text-muted-foreground">Routing source: Mapbox. Retrieved {new Date(state.result.route.retrievedAt).toLocaleString()}. This is a pricing preview only; customer details, approval history, saved quote versions and a payment link are not yet persisted by this planner.</p>
        </div>
      )}
    </section>
  );
}
