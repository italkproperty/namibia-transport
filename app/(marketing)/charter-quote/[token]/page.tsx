import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { charterQuotes, charterQuoteVersions } from "@/db/schema";
import { formatNad } from "@/lib/money";
import { buildPublicCharterLegs } from "@/lib/charter/public-quote";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your charter proposal", robots: { index: false, follow: false } };

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function dateText(value: unknown): string {
  if (typeof value !== "string" || !value) return "To be confirmed";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "To be confirmed" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Windhoek" }).format(date);
}

export default async function PublicCharterQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(token) || !isDatabaseConfigured()) notFound();
  const db = getDb();
  const [quote] = await db.select().from(charterQuotes).where(eq(charterQuotes.publicToken, token)).limit(1);
  if (!quote || quote.status !== "sent" || !quote.validUntil || quote.validUntil.getTime() < Date.now()) notFound();
  const [version] = await db.select().from(charterQuoteVersions)
    .where(eq(charterQuoteVersions.quoteId, quote.id))
    .orderBy(charterQuoteVersions.version).limit(1);
  if (!version) notFound();
  const snapshot = obj(version.snapshot);
  const customer = obj(snapshot.customer);
  const route = obj(snapshot.route);
  const vehicle = obj(snapshot.vehicle);
  const brief = obj(snapshot.customerBrief);
  const legs = buildPublicCharterLegs(snapshot, version.total);
  const startDate = dateText(brief.requestedStartDate ?? brief.itineraryStartDate);
  const endDate = dateText(brief.requestedEndDate);
  const totalDistance = Number(route.totalDistanceKm);
  const totalMinutes = Number(route.totalDurationMinutes);
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Private charter proposal</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-2xl font-semibold sm:text-3xl">Your Namibia journey</h1><p className="mt-2 text-sm text-muted-foreground">Proposal {quote.quoteNumber} · Prepared for {String(customer.name ?? quote.customerName)}</p></div>
          <span className="rounded-full border px-3 py-1 text-xs">Valid until {dateText(quote.validUntil.toISOString())}</span>
        </div>
        <section className="mt-7 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Trip overview</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Travel dates</p><p className="mt-1 text-sm font-medium">{startDate}{endDate !== "To be confirmed" ? ` – ${endDate}` : ""}</p></div>
            <div><p className="text-xs text-muted-foreground">Vehicle</p><p className="mt-1 text-sm font-medium">{String(vehicle.name ?? "Charter vehicle")}</p></div>
            <div><p className="text-xs text-muted-foreground">Route distance</p><p className="mt-1 text-sm font-medium">{Number.isFinite(totalDistance) ? `${totalDistance.toLocaleString("en-NA")} km` : "Confirmed itinerary"}</p></div>
            <div><p className="text-xs text-muted-foreground">Estimated driving time</p><p className="mt-1 text-sm font-medium">{Number.isFinite(totalMinutes) ? `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m` : "Depends on itinerary"}</p></div>
          </div>
        </section>
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Itemised itinerary and pricing</h2>
          <p className="mt-1 text-sm text-muted-foreground">Each leg is priced as part of the complete charter. Amounts below are an allocation of the agreed trip total, not separate bookings.</p>
          <ol className="mt-4 space-y-3">
            {legs.map((leg, index) => <li key={index} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="break-words font-medium leading-snug">{leg.from}</p>
                    <p className="mt-1 break-words text-sm leading-snug text-muted-foreground">to {leg.to}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{leg.distanceKm.toLocaleString("en-NA")} km · approx. {Math.floor(leg.durationMinutes / 60)}h {Math.round(leg.durationMinutes % 60)}m driving</p>
                  </div>
                </div>
                <p className="min-w-[7.5rem] text-right font-semibold tabular-nums whitespace-nowrap">{formatNad(leg.price)}</p>
              </div>
            </li>)}
          </ol>
          <div className="mt-5 rounded-xl bg-muted/50 p-5">
            <div className="flex items-center justify-between gap-4"><p className="font-medium">Total charter price</p><p className="text-2xl font-semibold tabular-nums">{formatNad(quote.total)}</p></div>
            <p className="mt-2 text-xs text-muted-foreground">NAD · One complete charter proposal for the itinerary above.</p>
          </div>
        </section>
        {Array.isArray(brief.inclusionsRequested) && brief.inclusionsRequested.length > 0 && <section className="mt-6 rounded-xl border p-4"><h2 className="font-semibold">Requested inclusions</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{(brief.inclusionsRequested as unknown[]).filter((x): x is string => typeof x === "string").map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
        <section className="mt-6 rounded-xl border p-4">
          <h2 className="font-semibold">Next step: payment and confirmation</h2>
          <p className="mt-2 text-sm text-muted-foreground">Please contact Namibia Transport to confirm the proposal and receive a secure payment link. Your trip is not booked until payment is successfully verified and a booking confirmation is issued.</p>
          <a className="mt-4 inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background" href={`https://wa.me/264817278410?text=${encodeURIComponent(`Hello Namibia Transport, I am reviewing charter proposal ${quote.quoteNumber} for ${formatNad(quote.total)}. Please advise the secure card payment and confirmation steps.`)}`} target="_blank" rel="noopener noreferrer">Request secure payment link on WhatsApp</a>
        </section>
        <p className="mt-6 text-xs text-muted-foreground">This link is private and expires on {dateText(quote.validUntil.toISOString())}. Internal operating costs and margin are not shown.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
