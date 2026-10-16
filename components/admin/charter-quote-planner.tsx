"use client";

import * as React from "react";
import { PlusIcon, TrashIcon, SearchIcon, RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNad } from "@/lib/money";
import {
  priceCharterItineraryAction,
  saveCharterQuoteDraftAction,
  searchCharterDestinationAction,
  type CharterPriceState,
  type SaveCharterDraftState,
} from "@/lib/admin/charter-quote-actions";
import type { ResolvedDestination, DestinationCandidate } from "@/lib/maps/charter-routing";

type VehicleOption = { id: string; name: string; hasProfile: boolean };

function DestinationField({
  index,
  value,
  initialQuery,
  onSelect,
  onRemove,
  canRemove,
}: {
  index: number;
  value: ResolvedDestination | null;
  initialQuery: string;
  onSelect: (value: ResolvedDestination | null) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [query, setQuery] = React.useState(value?.label ?? "");
  const [candidates, setCandidates] = React.useState<DestinationCandidate[]>([]);
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => setQuery(value?.label ?? initialQuery), [value?.label, initialQuery]);

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
            <button key={candidate.id} type="button" onClick={() => { onSelect({ label: candidate.fullAddress ? `${candidate.name}, ${candidate.fullAddress}` : candidate.name, coordinates: candidate.coordinates, source: candidate.source, providerId: candidate.id }); setQuery(candidate.fullAddress ? `${candidate.name}, ${candidate.fullAddress}` : candidate.name); setCandidates([]); setError(""); }} className="block w-full rounded-md border p-2 text-left hover:bg-muted">
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
  const [stopQueries, setStopQueries] = React.useState<string[]>(["", ""]);
  const [customerName, setCustomerName] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = React.useState("");
  const [changeReason, setChangeReason] = React.useState("");
  const [aiBrief, setAiBrief] = React.useState<Record<string, unknown> | null>(null);
  const [state, action, pending] = React.useActionState<CharterPriceState, FormData>(priceCharterItineraryAction, null);
  const [savedDraft, saveAction, saving] = React.useActionState<SaveCharterDraftState, FormData>(saveCharterQuoteDraftAction, null);
  const [vehicleClassId, setVehicleClassId] = React.useState(vehicles.find((item) => item.hasProfile)?.id ?? "");
  const [positioningKm, setPositioningKm] = React.useState("0");
  const [localKm, setLocalKm] = React.useState("0");
  const [vehicleDays, setVehicleDays] = React.useState("10");
  const [vehicleDailyRate, setVehicleDailyRate] = React.useState("3500");
  const [driverDays, setDriverDays] = React.useState("10");
  const [supplierItems, setSupplierItems] = React.useState<{ label: string; quantity: string; unitCost: string; unit: string }[]>([
    { label: "", quantity: "1", unitCost: "0", unit: "trip" },
  ]);

  const serialisedStops = JSON.stringify(stops.filter((stop): stop is ResolvedDestination => Boolean(stop)));
  const serialisedSupplierItems = JSON.stringify(supplierItems.filter((item) => item.label.trim()).map((item) => ({
    label: item.label.trim(), quantity: Number(item.quantity || 0), unitCost: Number(item.unitCost || 0), unit: item.unit || "item",
  })));
  const updateStop = (index: number, stop: ResolvedDestination | null) => setStops((current) => current.map((item, i) => i === index ? stop : item));

  React.useEffect(() => {
    const handleIntake = (event: Event) => {
      const detail = (event as CustomEvent<{ intake?: Record<string, unknown> }>).detail;
      const intake = detail?.intake;
      if (!intake) return;
      const itinerary = Array.isArray(intake.itinerary) ? intake.itinerary as { from?: string | null; to?: string | null; details?: string | null; nights?: number | null; dayOrDate?: string | null }[] : [];
      const labels: string[] = [];
      const addLabel = (value: unknown) => {
        const label = typeof value === "string" ? value.trim().replace(/[.;,]+$/, "") : "";
        if (label && !labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) labels.push(label);
      };
      // Accommodation names often live in the itinerary's Reservations/details
      // text, not in the town-level from/to fields. Prefer the named property
      // for an overnight stop, while retaining the first origin and final airport.
      if (itinerary.length) addLabel(itinerary[0].from);
      for (const leg of itinerary) {
        const details = typeof leg.details === "string" ? leg.details : "";
        const reservation = details.match(/(?:reservation|stay at|overnight at|accommodation(?: at)?|booked at)\s*[:\-]?\s*([^.;\n]+)/i);
        const lodging = reservation?.[1]?.trim();
        if (lodging && !/^(none|not stated|tbc|to be confirmed)$/i.test(lodging)) {
          addLabel(lodging.replace(/\s+(?:evening|morning|next day|for \d+ nights).*$/i, ""));
        } else if (typeof leg.to === "string") {
          addLabel(leg.to);
        }
      }
      if (itinerary.length) addLabel(itinerary[itinerary.length - 1].to);
      const usableLabels = labels.slice(0, 10);
      if (usableLabels.length >= 2) {
        setStops(usableLabels.map(() => null));
        setStopQueries(usableLabels);
      } else if (usableLabels.length === 1) {
        setStops([null, null]);
        setStopQueries([usableLabels[0], ""]);
      }
      setCustomerName(String(intake.customerName || intake.organisation || ""));
      setCustomerEmail(String(intake.email || ""));
      setCustomerWhatsapp(String(intake.whatsapp || ""));
      const requestedVehicle = String(intake.vehiclePreference || "");
      if (/suv|4x4|land cruiser|safari vehicle/i.test(requestedVehicle)) {
        const suv = vehicles.find((item) => /suv|4x4/i.test(item.name));
        if (suv) setVehicleClassId(suv.id);
      }
      const start = typeof intake.requestedStartDate === "string" ? Date.parse(intake.requestedStartDate + "T00:00:00Z") : NaN;
      const end = typeof intake.requestedEndDate === "string" ? Date.parse(intake.requestedEndDate + "T00:00:00Z") : NaN;
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        const inclusiveDays = String(Math.floor((end - start) / 86400000) + 1);
        setDriverDays(inclusiveDays);
        setVehicleDays(inclusiveDays);
      }
      setChangeReason("Prepared from AI intake. Confirm dates, route, inclusions and price against the original conversation.");
      setAiBrief(intake);
      document.getElementById("charter-quote-planner")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("namibia-transport:charter-intake", handleIntake);
    return () => window.removeEventListener("namibia-transport:charter-intake", handleIntake);
  }, [vehicles]);

  return (
    <section id="charter-quote-planner" className="rounded-xl border bg-card p-4 sm:p-5 space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold"><RouteIcon className="size-5" />Verified charter quote planner</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use actual lodges, camps, gates and addresses. Select each Mapbox match before pricing; this planner does not use town-centre approximations or alter public transfer fares.</p>
      </div>

      <form action={action} className="space-y-5">
        <input type="hidden" name="stops" value={serialisedStops} />
        <input type="hidden" name="supplierItems" value={serialisedSupplierItems} />
        <div className="space-y-3">
          {stops.map((stop, index) => (
            <DestinationField key={index} index={index} value={stop} initialQuery={stopQueries[index] ?? ""} onSelect={(value) => updateStop(index, value)} canRemove={stops.length > 2} onRemove={() => { setStops((current) => current.filter((_, i) => i !== index)); setStopQueries((current) => current.filter((_, i) => i !== index)); }} />
          ))}
          <Button type="button" variant="outline" size="sm" disabled={stops.length >= 10} onClick={() => { setStops((current) => [...current, null]); setStopQueries((current) => [...current, ""]); }}><PlusIcon className="mr-1 size-4" />Add stop</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="charter-vehicle" className="text-sm font-medium">Vehicle class</label>
            <select id="charter-vehicle" name="vehicleClassId" value={vehicleClassId} onChange={(event) => setVehicleClassId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {vehicles.map((vehicle) => {
                const fallbackAvailable = /suv|4x4/i.test(vehicle.name);
                const selectable = vehicle.hasProfile || fallbackAvailable;
                return <option key={vehicle.id} value={vehicle.id} disabled={!selectable}>{vehicle.name}{selectable && !vehicle.hasProfile ? " — temporary costing fallback" : vehicle.hasProfile ? "" : " — cost profile required"}</option>;
              })}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="positioningKm" className="text-sm font-medium">Empty positioning distance (km)</label>
            <Input id="positioningKm" name="positioningKm" type="number" min="0" step="1" value={positioningKm} onChange={(event) => setPositioningKm(event.target.value)} />
            <p className="text-xs text-muted-foreground">Include empty depot → pickup and post-drop return/repositioning. Do not duplicate any passenger-route kilometres.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="localKm" className="text-sm font-medium">Local excursions / driving (km)</label>
            <Input id="localKm" name="localKm" type="number" min="0" step="1" value={localKm} onChange={(event) => setLocalKm(event.target.value)} />
            <p className="text-xs text-muted-foreground">Passenger route + positioning + local kilometres all incur fuel. Confirm positioning with the actual depot/pickup/drop-off plan.</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Vehicle utilisation and additional trip costs</h3>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">SUV utilisation defaults to N$3,500 per service day. Fuel and a separate per-kilometre wear/maintenance allowance are calculated independently; set the per-km rate only for costs not already covered by the vehicle rate.</p>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><label htmlFor="vehicleDays" className="text-xs font-medium">Vehicle utilisation days</label><Input id="vehicleDays" name="vehicleDays" type="number" min="1" max="365" step="1" value={vehicleDays} onChange={(event) => setVehicleDays(event.target.value)} /></div>
            <div className="space-y-1"><label htmlFor="vehicleDailyRate" className="text-xs font-medium">SUV / 4x4 utilisation per day (N$)</label><Input id="vehicleDailyRate" name="vehicleDailyRate" type="number" min="0" step="1" value={vehicleDailyRate} onChange={(event) => setVehicleDailyRate(event.target.value)} /></div>
          </div>
          <h3 className="text-sm font-semibold">Driver, accommodation and destination costs</h3>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">Enter the total days/nights and rate. Fuel and non-fuel vehicle running costs are calculated separately.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><label htmlFor="driverDays" className="text-xs font-medium">Driver days</label><Input id="driverDays" name="driverDays" type="number" min="1" step="1" value={driverDays} onChange={(event) => setDriverDays(event.target.value)} /></div>
            <div className="space-y-1"><label htmlFor="driverDailyRate" className="text-xs font-medium">Driver / guide cost per day (N$)</label><Input id="driverDailyRate" name="driverDailyRate" type="number" min="0" step="1" defaultValue="950" /></div>
            <div className="space-y-1"><label htmlFor="accommodationNights" className="text-xs font-medium">Driver accommodation nights</label><Input id="accommodationNights" name="accommodationNights" type="number" min="0" step="1" defaultValue="9" /></div>
            <div className="space-y-1"><label htmlFor="accommodationRate" className="text-xs font-medium">Driver accommodation per night (N$)</label><Input id="accommodationRate" name="accommodationRate" type="number" min="0" step="1" defaultValue="900" /><p className="text-xs text-muted-foreground">Provisional allowance only; replace with staff-rate/lodge supplier confirmation.</p></div>
            <div className="space-y-1"><label htmlFor="driverPerDiemDays" className="text-xs font-medium">Driver meals / per diem days</label><Input id="driverPerDiemDays" name="driverPerDiemDays" type="number" min="0" step="1" defaultValue="10" /></div>
            <div className="space-y-1"><label htmlFor="driverPerDiemRate" className="text-xs font-medium">Driver meals / per diem per day (N$)</label><Input id="driverPerDiemRate" name="driverPerDiemRate" type="number" min="0" step="1" defaultValue="250" /></div>
            <div className="space-y-1"><label htmlFor="parkFees" className="text-xs font-medium">Confirmed national park / conservation fees (N$ total)</label><Input id="parkFees" name="parkFees" type="number" min="0" step="1" defaultValue="0" /><p className="text-xs text-muted-foreground">Only add fees payable by this charter; do not duplicate lodge-included guest activities or fees.</p></div>
            <div className="space-y-1"><label htmlFor="activityFees" className="text-xs font-medium">Non-included activities (N$ total)</label><Input id="activityFees" name="activityFees" type="number" min="0" step="1" defaultValue="0" /></div>
            <div className="space-y-1"><label htmlFor="permitsAndTolls" className="text-xs font-medium">Permits, tolls and access fees (N$ total)</label><Input id="permitsAndTolls" name="permitsAndTolls" type="number" min="0" step="1" defaultValue="0" /></div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">Named supplier line items</h4><Button type="button" variant="outline" size="sm" disabled={supplierItems.length >= 10} onClick={() => setSupplierItems((items) => [...items, { label: "", quantity: "1", unitCost: "0", unit: "trip" }])}><PlusIcon className="mr-1 size-4" />Add line</Button></div>
            <p className="text-xs text-muted-foreground">Name each real supplier charge (for example, a confirmed guide fee or access transfer). Blank rows are excluded. No catch-all supplier amount.</p>
            {supplierItems.map((item, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto]">
              <Input aria-label={`Supplier item ${index + 1} name`} placeholder="Supplier / service name" value={item.label} onChange={(event) => setSupplierItems((items) => items.map((row, i) => i === index ? { ...row, label: event.target.value } : row))} maxLength={100} />
              <Input aria-label={`Supplier item ${index + 1} quantity`} type="number" min="0" step="0.1" value={item.quantity} onChange={(event) => setSupplierItems((items) => items.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))} />
              <Input aria-label={`Supplier item ${index + 1} rate`} type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => setSupplierItems((items) => items.map((row, i) => i === index ? { ...row, unitCost: event.target.value } : row))} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove supplier item ${index + 1}`} disabled={supplierItems.length === 1} onClick={() => setSupplierItems((items) => items.filter((_, i) => i !== index))}><TrashIcon className="size-4" /></Button>
            </div>)}
          </div>
        </div>
        <Button type="submit" disabled={pending || stops.some((stop) => !stop) || !vehicles.some((vehicle) => vehicle.id === vehicleClassId && (vehicle.hasProfile || /suv|4x4/i.test(vehicle.name)))}>{pending ? "Calculating verified route…" : "Calculate charter cost and price"}</Button>
      </form>

      {state && !state.ok && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{state.message}</p>}
      {state?.ok && (
        <div className="space-y-4 rounded-lg border p-4">
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Suggested customer price · {state.vehicleName}</p><p className="text-3xl font-semibold">{formatNad(state.result.finalPrice.toFixed(2))}</p><p className="text-sm text-muted-foreground">{state.result.route.totalDistanceKm.toFixed(1)} passenger-route road km · {Math.round(state.result.route.totalDurationMinutes / 60 * 10) / 10} driving hours · {state.result.route.legCount} legs</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Expected operating cost</p><p className="text-lg font-semibold">{formatNad(state.result.costs.expectedCost.toFixed(2))}</p></div>
            <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Contribution after payment fee</p><p className="text-lg font-semibold">{formatNad(state.result.actual.contribution.toFixed(2))}</p><p className="text-xs text-muted-foreground">{(state.result.actual.contributionMargin * 100).toFixed(1)}% contribution margin</p></div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><span>Fuel ({state.result.costs.fuelLitres.toFixed(2)} L at {state.fuelAssumptions.litresPer100Km.toFixed(1)} L/100 km × N${state.fuelAssumptions.pricePerLitre.toFixed(2)}/L {state.fuelAssumptions.fuelType})</span><span>{formatNad(state.result.costs.fuelCost.toFixed(2))}</span></div>
            <div className="flex justify-between gap-3"><span>Non-fuel vehicle running cost</span><span>{formatNad(state.result.costs.nonFuelRunningCost.toFixed(2))}</span></div>
            {state.result.costs.itemisedCosts.map((item) => <div key={item.id} className="flex justify-between gap-3"><span>{item.label}</span><span>{formatNad(item.amount.toFixed(2))}</span></div>)}
            <div className="flex justify-between gap-3 border-t pt-2"><span>Estimated payment fee</span><span>{formatNad(state.result.suggested.paymentFee.toFixed(2))}</span></div>
            <div className="flex justify-between gap-3 font-medium"><span>Contribution margin target met</span><span>{state.result.belowTargetMargin ? "No — review required" : "Yes"}</span></div>
          </div>
          {state.result.belowTargetMargin && <p className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900">This price is below the configured target margin. Do not send it without reviewing the economics.</p>}
          <p className="text-xs text-muted-foreground">Routing source: Mapbox. Retrieved {new Date(state.result.route.retrievedAt).toLocaleString()}. Saving creates a private draft and immutable version-1 cost/price snapshot. It does not approve, issue, or send the quote.</p>
          <form action={saveAction} className="space-y-3 border-t pt-4">
            <input type="hidden" name="signedCalculation" value={state.signedCalculation} />
            <input type="hidden" name="aiBrief" value={aiBrief ? JSON.stringify(aiBrief) : ""} />
            <div>
              <h3 className="text-sm font-semibold">Save as a private draft</h3>
              <p className="mt-1 text-xs text-muted-foreground"> Saves the signed server-calculated route and price snapshot. Recalculate after changing itinerary or costs. Confirm vehicle days, positioning/local km, driver days, and supplier-cost inclusions before issuing a quote. Enter at least one customer contact method.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><label htmlFor="draft-customer-name" className="text-sm font-medium">Customer name / organisation</label><Input id="draft-customer-name" name="customerName" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required minLength={2} maxLength={160} placeholder="Customer name" /></div>
              <div className="space-y-1"><label htmlFor="draft-customer-email" className="text-sm font-medium">Email</label><Input id="draft-customer-email" name="customerEmail" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} maxLength={254} placeholder="name@example.com" /></div>
              <div className="space-y-1"><label htmlFor="draft-customer-whatsapp" className="text-sm font-medium">WhatsApp</label><Input id="draft-customer-whatsapp" name="customerWhatsapp" value={customerWhatsapp} onChange={(event) => setCustomerWhatsapp(event.target.value)} maxLength={40} placeholder="+264…" /></div>
              <div className="space-y-1"><label htmlFor="draft-change-reason" className="text-sm font-medium">Internal note / pricing rationale (optional)</label><Input id="draft-change-reason" name="changeReason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} maxLength={500} placeholder="e.g. initial quote draft" /></div>
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Saving private draft…" : "Save private quote draft"}</Button>
          </form>
          {savedDraft && !savedDraft.ok && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{savedDraft.message}</p>}
          {savedDraft?.ok && <div role="status" className="rounded-md border border-emerald-500/30 bg-emerald-50 p-3 text-sm text-emerald-950"><p className="font-semibold">Draft saved: {savedDraft.quoteNumber}</p><p className="mt-1">Version 1 is stored privately. It has not been approved or sent to the customer.</p><p className="mt-2 text-xs">Draft record: {savedDraft.id}</p></div>}
        </div>
      )}
    </section>
  );
}
