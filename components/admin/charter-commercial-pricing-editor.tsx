"use client";

import * as React from "react";
import { formatNad } from "@/lib/money";
import { saveCharterCommercialPricingAction, type SaveCharterCommercialPricingState } from "@/lib/admin/charter-quote-actions";
import { Button } from "@/components/ui/button";

type Leg = { from: string; to: string; price: number };
type Extra = { id: string; label: string; quantity: number; unit: string; unitPrice: number };

function allocate(total: number, weights: number[]): number[] {
  const cents = Math.max(0, Math.round(total * 100));
  const safeWeights = weights.map((value) => Number.isFinite(value) && value > 0 ? value : 0);
  const sum = safeWeights.reduce((a, b) => a + b, 0);
  const effective = sum > 0 ? safeWeights : safeWeights.map(() => 1);
  const denominator = effective.reduce((a, b) => a + b, 0);
  let allocated = 0;
  return effective.map((weight, index) => {
    const value = index === effective.length - 1 ? cents - allocated : Math.round(cents * weight / denominator);
    allocated += value;
    return value / 100;
  });
}

export function CharterCommercialPricingEditor({
  quoteId, status, total, routeLegs, stopLabels, savedPricing,
}: {
  quoteId: string;
  status: string;
  total: number;
  routeLegs: { distanceKm?: number }[];
  stopLabels: string[];
  savedPricing?: { legs?: Leg[]; extras?: Extra[] } | null;
}) {
  const initialLegs = React.useMemo<Leg[]>(() => {
    if (savedPricing?.legs?.length === routeLegs.length && savedPricing.legs.length > 0) return savedPricing.legs;
    const prices = allocate(total, routeLegs.map((leg) => Number(leg.distanceKm)));
    return routeLegs.map((leg, index) => ({
      from: stopLabels[index] || `Stop ${index + 1}`,
      to: stopLabels[index + 1] || `Stop ${index + 2}`,
      price: prices[index] ?? 0,
    }));
  }, [savedPricing, routeLegs, stopLabels, total]);
  const [legs, setLegs] = React.useState<Leg[]>(initialLegs);
  const [extras, setExtras] = React.useState<Extra[]>(savedPricing?.extras ?? []);
  const [reason, setReason] = React.useState("");
  const [state, action, pending] = React.useActionState<SaveCharterCommercialPricingState, FormData>(saveCharterCommercialPricingAction, null);
  const [hasEdited, setHasEdited] = React.useState(false);
  const [newExtraLabel, setNewExtraLabel] = React.useState("");
  const [newExtraQuantity, setNewExtraQuantity] = React.useState("1");
  const [newExtraUnit, setNewExtraUnit] = React.useState("item");

  const legTotal = legs.reduce((sum, line) => sum + Math.round((Number(line.price) || 0) * 100), 0) / 100;
  const extraTotal = extras.reduce((sum, line) => sum + Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) * 100), 0) / 100;
  const computedTotal = Math.round((legTotal + extraTotal) * 100) / 100;
  const editable = status === "draft" || status === "approved";

  const updateLeg = (index: number, price: string) => {
    setHasEdited(true);
    setLegs((current) => current.map((line, i) => i === index ? { ...line, price: price === "" ? 0 : Number(price) } : line));
  };
  const updateExtra = (index: number, key: keyof Extra, value: string) => {
    setHasEdited(true);
    setExtras((current) => current.map((line, i) => {
      if (i !== index) return line;
      if (key === "label" || key === "unit") return { ...line, [key]: value };
      return { ...line, [key]: value === "" ? 0 : Number(value) };
    }));
  };
  const addExtra = () => {
    const label = newExtraLabel.trim();
    const quantity = Number(newExtraQuantity);
    if (!label || !Number.isFinite(quantity) || quantity < 0) return;
    setHasEdited(true);
    setExtras((current) => [...current, { id: `extra-${Date.now()}-${current.length}`, label, quantity, unit: newExtraUnit.trim() || "item", unitPrice: 0 }]);
    setNewExtraLabel("");
    setNewExtraQuantity("1");
    setNewExtraUnit("item");
  };

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Editable customer pricing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Set the actual selling price for each route leg and add separately itemised customer charges. Existing quotes start with a distance-based allocation only as an editable starting point; these values are not represented as independently calculated prices until you review and save them.</p>
      </div>
      {!editable && <p className="rounded-md border p-3 text-sm">This quote is {status}. Its issued terms are locked; create a new draft revision to change the commercial prices.</p>}
      <form action={action} className="space-y-4">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="commercialPricing" value={JSON.stringify({ legs, extras })} />
        <div className="space-y-3">
          {legs.map((leg, index) => (
            <div key={index} className="rounded-lg border p-3 space-y-2">
              <div className="text-sm font-medium">{index + 1}. {leg.from} → {leg.to}</div>
              <div className="flex items-center gap-3">
                <label className="flex-1 text-xs text-muted-foreground" htmlFor={`leg-price-${index}`}>Customer selling price (N$)</label>
                <input id={`leg-price-${index}`} aria-label={`Selling price for leg ${index + 1}`} type="number" min="0" max="100000000" step="0.01" value={leg.price} disabled={!editable || pending} onChange={(e) => updateLeg(index, e.target.value)} className="w-40 rounded-md border bg-background px-3 py-2 text-right text-sm tabular-nums" />
              </div>
              {routeLegs[index]?.distanceKm != null && <p className="text-xs text-muted-foreground">Verified route distance: {Number(routeLegs[index].distanceKm).toFixed(1)} km. Distance is reference data; it does not lock the selling price.</p>}
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="text-sm font-semibold">Additional customer line items</h3>
            <p className="mt-1 text-xs text-muted-foreground">Use these for a separately charged driver accommodation, meal allowance, park fee or other agreed item. Do not add an amount here if it is already included in the route-leg prices.</p>
          </div>
          {extras.map((line, index) => (
            <div key={line.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12">
              <div className="sm:col-span-5"><label className="text-xs text-muted-foreground" htmlFor={`extra-label-${index}`}>Description</label><input id={`extra-label-${index}`} value={line.label} disabled={!editable || pending} onChange={(e) => updateExtra(index, "label", e.target.value)} maxLength={160} className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" /></div>
              <div className="sm:col-span-2"><label className="text-xs text-muted-foreground" htmlFor={`extra-qty-${index}`}>Quantity</label><input id={`extra-qty-${index}`} type="number" min="0" step="0.01" value={line.quantity} disabled={!editable || pending} onChange={(e) => updateExtra(index, "quantity", e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" /></div>
              <div className="sm:col-span-2"><label className="text-xs text-muted-foreground" htmlFor={`extra-unit-${index}`}>Unit</label><input id={`extra-unit-${index}`} value={line.unit} disabled={!editable || pending} onChange={(e) => updateExtra(index, "unit", e.target.value)} maxLength={40} className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" /></div>
              <div className="sm:col-span-2"><label className="text-xs text-muted-foreground" htmlFor={`extra-rate-${index}`}>Rate (N$)</label><input id={`extra-rate-${index}`} type="number" min="0" step="0.01" value={line.unitPrice} disabled={!editable || pending} onChange={(e) => updateExtra(index, "unitPrice", e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" /></div>
              <div className="sm:col-span-1 flex items-end"><Button type="button" variant="outline" disabled={!editable || pending} onClick={() => { setHasEdited(true); setExtras((current) => current.filter((_, i) => i !== index)); }}>Remove</Button></div>
              <p className="sm:col-span-12 text-right text-sm font-medium">{formatNad(line.quantity * line.unitPrice)}</p>
            </div>
          ))}
          {editable && <div className="grid gap-2 sm:grid-cols-12">
            <div className="sm:col-span-6"><label className="text-xs text-muted-foreground" htmlFor="new-extra-label">Add a line item</label><input id="new-extra-label" value={newExtraLabel} onChange={(e) => setNewExtraLabel(e.target.value)} placeholder="e.g. Driver meal allowance" maxLength={160} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" /></div>
            <div className="sm:col-span-2"><label className="text-xs text-muted-foreground" htmlFor="new-extra-quantity">Quantity</label><input id="new-extra-quantity" type="number" min="0" step="0.01" value={newExtraQuantity} onChange={(e) => setNewExtraQuantity(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" /></div>
            <div className="sm:col-span-2"><label className="text-xs text-muted-foreground" htmlFor="new-extra-unit">Unit</label><input id="new-extra-unit" value={newExtraUnit} onChange={(e) => setNewExtraUnit(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" /></div>
            <div className="sm:col-span-2 flex items-end"><Button type="button" variant="outline" disabled={!newExtraLabel.trim()} onClick={addExtra}>Add item</Button></div>
          </div>}
        </div>
        <div className="rounded-lg bg-muted/60 p-4 space-y-2">
          <div className="flex justify-between gap-3 text-sm"><span>Route-leg subtotal</span><span className="tabular-nums">{formatNad(legTotal)}</span></div>
          <div className="flex justify-between gap-3 text-sm"><span>Additional line items</span><span className="tabular-nums">{formatNad(extraTotal)}</span></div>
          <div className="flex justify-between gap-3 border-t pt-2 font-semibold"><span>Revised customer total</span><span className="tabular-nums">{formatNad(computedTotal)}</span></div>
        </div>
        <div><label htmlFor="commercial-change-reason" className="text-xs text-muted-foreground">Reason for price changes (recommended)</label><input id="commercial-change-reason" name="changeReason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. driver accommodation priced separately" disabled={!editable || pending} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" /></div>
        <Button type="submit" disabled={!editable || pending || legs.length === 0}>{pending ? "Saving audited pricing version…" : "Save commercial pricing"}</Button>
      </form>
      {state && !state.ok && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{state.message}</p>}
      {state?.ok && <div role="status" className="rounded-md border p-3 text-sm space-y-1"><p className="font-semibold">Pricing saved as version {state.version}. Total: {formatNad(state.total)}.</p>{state.belowTargetMargin && <p className="text-amber-800">This price is below the target contribution margin. Review the economics before issuing the quote.</p>}</div>}
      {hasEdited && <p className="text-xs text-muted-foreground">Unsaved edits are in this form only. Save the pricing before leaving the page.</p>}
    </section>
  );
}
