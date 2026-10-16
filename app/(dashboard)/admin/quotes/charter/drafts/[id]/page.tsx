import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { AdminShell } from "@/components/admin/shell";
import { getDb, isDatabaseConfigured } from "@/db";
import { charterQuoteVersions, charterQuotes } from "@/db/schema";
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";
import { formatDate } from "@/lib/format";
import { formatNad } from "@/lib/money";

export const metadata: Metadata = {
  title: "Charter quote detail",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type StopSnapshot = { label?: string; coordinates?: { lat?: number; lng?: number } };
type QuoteSnapshot = {
  schemaVersion?: number;
  request?: {
    positioningKm?: number;
    localKm?: number;
    driverDays?: number;
    driverDailyRate?: number;
    accommodationNights?: number;
    accommodationRate?: number;
    parkFees?: number;
    otherCosts?: number;
  };
  route?: { totalDistanceKm?: number; totalDurationMinutes?: number; legs?: { distanceKm?: number; durationMinutes?: number }[] };
  vehicle?: { name?: string };
  settings?: { targetContributionMargin?: number; paymentFeeRate?: number };
  result?: {
    finalPrice?: number;
    belowTargetMargin?: boolean;
    costs?: {
      fuelCost?: number;
      nonFuelRunningCost?: number;
      expectedCost?: number;
      itemisedCosts?: { id?: string; label?: string; amount?: number; unit?: string }[];
      excludedIncludedElsewhere?: { id?: string; label?: string }[];
    };
    suggested?: { suggestedPrice?: number; contribution?: number; contributionMargin?: number };
    actual?: { contribution?: number; contributionMargin?: number };
  };
  requiresMarginReview?: boolean;
  customer?: { name?: string; email?: string | null; whatsapp?: string | null };
  changeReason?: string | null;
  customerBrief?: {
    summary?: string;
    requestedStartDate?: string | null;
    requestedEndDate?: string | null;
    itineraryStartDate?: string | null;
    passengers?: number | null;
    customerBudget?: string | null;
    priceAgreed?: string | null;
    itinerary?: { dayOrDate?: string | null; from?: string | null; to?: string | null; details?: string | null; nights?: number | null }[];
    inclusionsRequested?: string[];
    preferences?: string[];
    unresolvedQuestions?: string[];
    dateConflicts?: string[];
  } | null;
  calculatedAt?: string;
};

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function amount(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? formatNad(number) : "—";
}

function minutes(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return "—";
  const hours = Math.floor(number / 60);
  const mins = Math.round(number % 60);
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

export default async function CharterQuoteDraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  if (!isDatabaseConfigured()) {
    return <AdminShell active="/admin/quotes"><p className="rounded-lg border p-4 text-sm">The database is not configured on this deployment.</p></AdminShell>;
  }

  let quote: typeof charterQuotes.$inferSelect | undefined;
  let versions: (typeof charterQuoteVersions.$inferSelect)[] = [];
  try {
    const db = getDb();
    [quote] = await withDeadline("charter quote detail", READ_DEADLINE_MS, () =>
      db.select().from(charterQuotes).where(eq(charterQuotes.id, id)).limit(1),
    );
    if (quote) {
      versions = await withDeadline("charter quote versions", READ_DEADLINE_MS, () =>
        db.select().from(charterQuoteVersions)
          .where(eq(charterQuoteVersions.quoteId, id))
          .orderBy(desc(charterQuoteVersions.version)),
      );
    }
  } catch (error) {
    console.error("[charter-quotes] detail unavailable", error);
    return (
      <AdminShell active="/admin/quotes">
        <div role="alert" className="rounded-lg border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-950">
          Quote details could not be loaded. Confirm the charter quote tables have been created in Supabase, then reload this page.
        </div>
      </AdminShell>
    );
  }

  if (!quote) notFound();

  const itinerary = readObject(quote.itinerarySnapshot);
  const stops = Array.isArray(itinerary.stops) ? itinerary.stops as StopSnapshot[] : [];
  const costSnapshot = readObject(quote.costSnapshot);
  const pricingSnapshot = readObject(quote.pricingSnapshot);
  const snapshot = versions[0]?.snapshot as QuoteSnapshot | undefined;
  const route = snapshot?.route ?? readObject(itinerary.route) as QuoteSnapshot["route"];
  const costBreakdown = readObject(snapshot?.result?.costs ?? costSnapshot.costs);
  const itemisedCosts = Array.isArray(costBreakdown.itemisedCosts)
    ? costBreakdown.itemisedCosts as { id?: string; label?: string; amount?: number; unit?: string }[]
    : [];
  const profile = readObject(costSnapshot.vehicleCostProfile);
  const settings = readObject(pricingSnapshot.settings);
  const suggested = readObject(pricingSnapshot.suggested);
  const actual = readObject(pricingSnapshot.actual);
  const rawCustomerBrief = snapshot?.customerBrief ?? itinerary.customerBrief;
  const customerBrief = rawCustomerBrief && typeof rawCustomerBrief === "object" && !Array.isArray(rawCustomerBrief)
    ? rawCustomerBrief as NonNullable<QuoteSnapshot["customerBrief"]>
    : null;
  const briefList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

  return (
    <AdminShell active="/admin/quotes">
      <div className="space-y-6">
        <div>
          <Link href="/admin/quotes/charter/drafts" className="text-xs text-muted-foreground hover:underline">← All charter drafts</Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{quote.quoteNumber}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Created {formatDate(quote.createdAt)} · Version {quote.currentVersion}</p>
            </div>
            <span className="rounded-full border px-3 py-1 text-sm capitalize">{quote.status}</span>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Customer</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-muted-foreground">Name / organisation</dt><dd>{quote.customerName}</dd></div>
              <div><dt className="text-muted-foreground">Email</dt><dd>{quote.customerEmail || "—"}</dd></div>
              <div><dt className="text-muted-foreground">WhatsApp</dt><dd>{quote.customerWhatsapp || "—"}</dd></div>
            </dl>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Quote summary</h2>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatNad(quote.total)}</p>
            <p className="text-xs text-muted-foreground">{quote.currency} · Version {quote.currentVersion}</p>
            {snapshot?.requiresMarginReview && <p className="mt-3 rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-950">Below target contribution margin — review required before any future approval or issue.</p>}
            <p className="mt-3 text-xs text-muted-foreground">This is a private saved draft. It has not been approved, issued, or sent.</p>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Customer itinerary</h2>
          {stops.length ? (
            <ol className="mt-4 space-y-3">
              {stops.map((stop, index) => (
                <li key={`${index}-${stop.label ?? "stop"}`} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs">{index + 1}</span>
                  <div><p className="text-sm font-medium">{stop.label || "Unnamed stop"}</p>
                    {stop.coordinates && <p className="text-xs text-muted-foreground">{stop.coordinates.lat}, {stop.coordinates.lng}</p>}
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-sm text-muted-foreground">No stop labels were found in the saved snapshot.</p>}
          <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
            <Metric label="Road distance" value={Number.isFinite(Number(route?.totalDistanceKm)) ? `${Number(route?.totalDistanceKm).toFixed(1)} km` : "—"} />
            <Metric label="Estimated driving time" value={minutes(route?.totalDurationMinutes)} />
            <Metric label="Vehicle class" value={snapshot?.vehicle?.name || String(profile.vehicleClassName ?? "Saved vehicle profile")} />
          </div>
        </section>

        {customerBrief && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">AI-extracted customer brief</h2>
            <p className="mt-1 text-sm text-muted-foreground">Saved with this draft for reference. This is extracted context, not independently verified customer terms.</p>
            {customerBrief.summary && <p className="mt-3 text-sm">{customerBrief.summary}</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Requested dates" value={[customerBrief.requestedStartDate, customerBrief.requestedEndDate].filter(Boolean).join(" to ") || "Not stated"} />
              <Metric label="Itinerary start date" value={customerBrief.itineraryStartDate || "Not stated"} />
              <Metric label="Passengers" value={customerBrief.passengers == null ? "Not stated" : String(customerBrief.passengers)} />
              <Metric label="Customer budget" value={customerBrief.customerBudget || "Not stated"} />
              <Metric label="Agreed price in conversation" value={customerBrief.priceAgreed || "Not confirmed"} />
            </div>
            {Array.isArray(customerBrief.itinerary) && customerBrief.itinerary.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">Extracted route context</h3><ol className="mt-2 space-y-2">{customerBrief.itinerary.map((leg, index) => <li key={index} className="rounded-md border p-3 text-sm"><p className="font-medium">{leg.dayOrDate || `Leg ${index + 1}`}: {leg.from || "Origin not stated"} → {leg.to || "Destination not stated"}</p>{leg.details && <p className="mt-1 text-muted-foreground">{leg.details}</p>}{leg.nights != null && <p className="mt-1 text-xs text-muted-foreground">Nights: {leg.nights}</p>}</li>)}</ol></div>}
            {(["inclusionsRequested", "preferences", "dateConflicts", "unresolvedQuestions"] as const).map((key) => {
              const items = briefList(customerBrief?.[key]);
              if (!items.length) return null;
              const title = ({ inclusionsRequested: "Requested inclusions", preferences: "Preferences", dateConflicts: "Date conflicts to resolve", unresolvedQuestions: "Open questions" } as const)[key];
              return <div key={key} className="mt-4"><h3 className="text-sm font-semibold">{title}</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>;
            })}
          </section>
        )}

        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Cost and pricing snapshot</h2>
          <p className="mt-1 text-sm text-muted-foreground">These are the assumptions captured when the draft was saved; changing current pricing settings does not rewrite this record.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Target contribution margin" value={Number.isFinite(Number(settings.targetContributionMargin ?? snapshot?.settings?.targetContributionMargin)) ? `${(Number(settings.targetContributionMargin ?? snapshot?.settings?.targetContributionMargin) * 100).toFixed(1)}%` : "—"} />
            <Metric label="Payment fee" value={Number.isFinite(Number(settings.paymentFeeRate ?? snapshot?.settings?.paymentFeeRate)) ? `${(Number(settings.paymentFeeRate ?? snapshot?.settings?.paymentFeeRate) * 100).toFixed(2)}%` : "—"} />
            <Metric label="Suggested price" value={amount(suggested.suggestedPrice ?? snapshot?.result?.suggested?.suggestedPrice)} />
            <Metric label="Final price" value={formatNad(quote.total)} />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Cost item</th><th className="py-2 text-right">Amount</th></tr></thead>
              <tbody>
                <tr className="border-b"><td className="py-2 pr-3">Fuel</td><td className="py-2 text-right tabular-nums">{amount(costBreakdown.fuelCost)}</td></tr>
                <tr className="border-b"><td className="py-2 pr-3">Non-fuel running cost</td><td className="py-2 text-right tabular-nums">{amount(costBreakdown.nonFuelRunningCost)}</td></tr>
                {itemisedCosts.map((cost, index) => (
                  <tr key={`${index}-${cost.label ?? "cost"}`} className="border-b last:border-0">
                    <td className="py-2 pr-3">{cost.label || `Cost item ${index + 1}`}</td>
                    <td className="py-2 text-right tabular-nums">{amount(cost.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold"><td className="py-2 pr-3">Total expected operating cost</td><td className="py-2 text-right tabular-nums">{amount(costBreakdown.expectedCost)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Fuel type" value={String(profile.fuelType ?? "—")} />
            <Metric label="Fuel consumption" value={Number.isFinite(Number(profile.litresPer100Km)) ? `${profile.litresPer100Km} L/100 km` : "—"} />
            <Metric label="Fuel price" value={amount(profile.fuelPricePerLitre)} />
            <Metric label="Non-fuel running cost" value={amount(profile.nonFuelRunningCostPerKm)} />
          </div>
          {snapshot?.changeReason && <p className="mt-4 text-sm"><span className="text-muted-foreground">Internal note:</span> {snapshot.changeReason}</p>}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Version history</h2>
          <p className="mt-1 text-sm text-muted-foreground">Each entry records the snapshot saved for that version. Versions are not editable here.</p>
          {versions.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No version records found.</p> : (
            <div className="mt-4 space-y-3">
              {versions.map((version) => {
                const versionSnapshot = readObject(version.snapshot);
                return (
                  <div key={version.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-medium">Version {version.version}</p><p className="text-xs text-muted-foreground">{formatDate(version.createdAt)} · {version.actor}</p></div>
                      <div className="text-right"><p className="font-semibold tabular-nums">{formatNad(version.total)}</p><p className="text-xs capitalize text-muted-foreground">{version.status}</p></div>
                    </div>
                    {version.changeReason && <p className="mt-2 text-sm">{version.changeReason}</p>}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-muted-foreground">Inspect saved snapshot data</summary>
                      <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-words">{JSON.stringify(versionSnapshot, null, 2)}</pre>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}
