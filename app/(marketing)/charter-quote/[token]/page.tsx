import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { charterQuotes, charterQuoteVersions, charterQuotePayments } from "@/db/schema";
import { formatNad } from "@/lib/money";
import { buildPublicCharterLegs } from "@/lib/charter/public-quote";
import { SiteFooter } from "@/components/marketing/site-footer";
import { startCharterPaymentAction } from "@/lib/charter/payment-actions";
import { isLiveGatewayConfigured } from "@/lib/payments";
import { CharterBankTransfer } from "@/components/booking/charter-bank-transfer";
import { bankTransferLines, getBankDetails } from "@/lib/payments/bank";
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

export default async function PublicCharterQuotePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { token } = await params;
  const { payment } = await searchParams;
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(token) || !isDatabaseConfigured()) notFound();
  const db = getDb();
  const [quote] = await db.select().from(charterQuotes).where(eq(charterQuotes.publicToken, token)).limit(1);
  if (!quote || (quote.status !== "sent" && quote.status !== "paid") ||
      (quote.status === "sent" && (!quote.validUntil || quote.validUntil.getTime() < Date.now()))) notFound();
  const [version] = await db.select().from(charterQuoteVersions)
    .where(eq(charterQuoteVersions.quoteId, quote.id))
    .orderBy(desc(charterQuoteVersions.version)).limit(1);
  if (!version) notFound();
  let latestPayment: { status: string } | undefined;
  let paymentLedgerAvailable = true;
  try {
    [latestPayment] = await db.select({ status: charterQuotePayments.status })
      .from(charterQuotePayments).where(eq(charterQuotePayments.quoteId, quote.id))
      .orderBy(desc(charterQuotePayments.createdAt)).limit(1);
  } catch (error) {
    paymentLedgerAvailable = false;
    console.error("[charter-payment] payment ledger unavailable; bank transfer remains available", error);
  }
  const paymentStatus = payment ?? (quote.status === "paid" || latestPayment?.status === "paid" ? "received" : undefined);
  const liveCheckoutAvailable = isLiveGatewayConfigured();
  const bank = getBankDetails();
  const transferLines = bank ? bankTransferLines(bank, quote.quoteNumber) : null;
  const snapshot = obj(version.snapshot);
  const customer = obj(snapshot.customer);
  const route = obj(snapshot.route);
  const vehicle = obj(snapshot.vehicle);
  const brief = obj(snapshot.customerBrief);
  const commercialPricing = obj(snapshot.commercialPricing);
  const hasSavedCommercialPricing = Array.isArray(commercialPricing.legs) && commercialPricing.legs.length > 0;
  const savedLegs = hasSavedCommercialPricing ? commercialPricing.legs as { from?: unknown; to?: unknown; price?: unknown }[] : [];
  const routeLegs = Array.isArray(route.legs) ? route.legs as { distanceKm?: unknown; durationMinutes?: unknown }[] : [];
  const stopList = Array.isArray(obj(snapshot.request).stops) ? obj(snapshot.request).stops as { label?: unknown }[] : [];
  const legs = hasSavedCommercialPricing
    ? savedLegs.map((leg, index) => ({
        from: typeof leg.from === "string" ? leg.from : String(stopList[index]?.label ?? `Stop ${index + 1}`),
        to: typeof leg.to === "string" ? leg.to : String(stopList[index + 1]?.label ?? `Stop ${index + 2}`),
        distanceKm: Number.isFinite(Number(routeLegs[index]?.distanceKm)) ? Number(routeLegs[index].distanceKm) : 0,
        durationMinutes: Number.isFinite(Number(routeLegs[index]?.durationMinutes)) ? Number(routeLegs[index].durationMinutes) : 0,
        price: Number.isFinite(Number(leg.price)) && Number(leg.price) >= 0 ? Number(leg.price) : 0,
      }))
    : buildPublicCharterLegs(snapshot, version.total);
  const customerExtras = Array.isArray(commercialPricing.extras)
    ? (commercialPricing.extras as { id?: unknown; label?: unknown; quantity?: unknown; unit?: unknown; unitPrice?: unknown; amount?: unknown }[])
        .map((line) => ({ id: String(line.id ?? ""), label: String(line.label ?? "Additional service"), quantity: Number(line.quantity), unit: String(line.unit ?? "item"), unitPrice: Number(line.unitPrice), amount: Number(line.amount ?? Number(line.quantity) * Number(line.unitPrice)) }))
        .filter((line) => line.label && Number.isFinite(line.amount) && line.amount > 0)
    : [];
  const displayedTotal = Number(version.total);
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
          <p className="mt-1 text-sm text-muted-foreground">{hasSavedCommercialPricing ? "The route legs below have individual selling prices and form one complete charter proposal." : "The displayed leg amounts are an allocation of the agreed trip total. They are not independently priced or separate bookings."}</p>
          <ol className="mt-4 space-y-3">
            {legs.map((leg, index) => <li key={index} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium leading-snug">{leg.from}</p>
                      <p className="mt-1 break-words text-sm leading-snug text-muted-foreground">to {leg.to}</p>
                    </div>
                    <p className="w-32 shrink-0 text-right font-semibold tabular-nums whitespace-nowrap">{formatNad(leg.price)}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{leg.distanceKm.toLocaleString("en-NA")} km · approx. {Math.floor(leg.durationMinutes / 60)}h {Math.round(leg.durationMinutes % 60)}m driving</p>
                </div>
              </div>
            </li>)}
          </ol>
          {customerExtras.length > 0 && <div className="mt-4 rounded-xl border p-4">
            <h3 className="font-semibold">Additional services and charges</h3>
            <div className="mt-3 space-y-2">{customerExtras.map((line) => <div key={line.id} className="flex items-start justify-between gap-4 text-sm"><span>{line.label} ({line.quantity} {line.unit}{line.quantity === 1 ? "" : "s"})</span><span className="shrink-0 font-medium tabular-nums">{formatNad(line.amount)}</span></div>)}</div>
          </div>}
          <div className="mt-5 rounded-xl bg-muted/50 p-5">
            <div className="flex items-center justify-between gap-4"><p className="font-medium">Total charter price</p><p className="text-2xl font-semibold tabular-nums">{formatNad(displayedTotal)}</p></div>
            <p className="mt-2 text-xs text-muted-foreground">NAD · One complete charter proposal for the itinerary above.</p>
          </div>
        </section>
        {Array.isArray(brief.inclusionsRequested) && brief.inclusionsRequested.length > 0 && <section className="mt-6 rounded-xl border p-4"><h2 className="font-semibold">Requested inclusions</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{(brief.inclusionsRequested as unknown[]).filter((x): x is string => typeof x === "string").map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
        <section className="mt-6 rounded-xl border p-4">
          <h2 className="font-semibold">Payment and confirmation</h2>
          {paymentStatus === "received" ? (
            <p className="mt-2 text-sm" role="status">PayToday reports that your payment was received. Namibia Transport will verify the transaction and issue your operational booking confirmation separately. This proposal page is not itself a booking confirmation.</p>
          ) : payment === "pending" ? (
            <p className="mt-2 text-sm" role="status">We have not yet received a final payment confirmation from PayToday. Please allow a moment and contact us if the status does not update. Do not pay a second time while this is being checked.</p>
          ) : payment === "failed" || payment === "cancelled" ? (
            <p className="mt-2 text-sm" role="status">The payment was not completed. You can try again or contact our team for assistance.</p>
          ) : payment === "mobile" ? (
            <p className="mt-2 text-sm" role="alert">We need a valid mobile number for the card-payment request. Please contact Namibia Transport so we can update your quote details.</p>
          ) : payment === "email" ? (
            <p className="mt-2 text-sm" role="alert">We need an email address for the card-payment request. Please contact Namibia Transport so we can update your quote details.</p>
          ) : payment === "ledger" || payment === "database" ? (
            <p className="mt-2 text-sm" role="alert">Our payment system is temporarily unavailable. You can use the bank-transfer details below or contact our team; please do not retry card payment repeatedly.</p>
          ) : payment === "gateway" || payment === "gateway_response" || payment === "gateway_error" || payment === "unavailable" || payment === "contact" ? (
            <p className="mt-2 text-sm" role="alert">PayToday did not open a checkout for this proposal. You can pay by bank transfer using the details below or contact our team. We are checking the card-payment connection.</p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">Your trip is not booked until payment is verified and a booking confirmation is issued.</p>
          {paymentStatus !== "received" && liveCheckoutAvailable && paymentLedgerAvailable && (
            <form action={startCharterPaymentAction} className="mt-4 space-y-3">
              <input type="hidden" name="token" value={token} />
              <div>
                <label htmlFor="charter-payment-mobile" className="mb-1 block text-sm font-medium">Mobile number for card payment</label>
                <input
                  id="charter-payment-mobile"
                  name="whatsapp"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  minLength={7}
                  maxLength={25}
                  defaultValue={quote.customerWhatsapp ?? ""}
                  placeholder="+264 81 234 5678"
                  className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
                  aria-describedby="charter-payment-mobile-help"
                />
                <p id="charter-payment-mobile-help" className="mt-1 text-xs text-muted-foreground">Include your country code, for example +264 for Namibia.</p>
              </div>
              <button className="inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50" type="submit">Pay securely by card</button>
            </form>
          )}
          {(!liveCheckoutAvailable || !paymentLedgerAvailable) && paymentStatus !== "received" && (
            <p className="mt-3 text-sm text-muted-foreground">Card checkout is temporarily unavailable. You can pay by bank transfer using the copyable account details below.</p>
          )}
          {paymentStatus !== "received" && transferLines && (
            <CharterBankTransfer lines={transferLines} />
          )}
          {paymentStatus !== "received" && !bank && (
            <p className="mt-3 text-sm text-muted-foreground">Bank-transfer details are temporarily unavailable. Please contact Namibia Transport before making a payment.</p>
          )}
          <a className="mt-3 inline-flex rounded-md border px-4 py-2 text-sm font-medium" href={"https://wa.me/264817278410?text=" + encodeURIComponent("Hello Namibia Transport, I am reviewing charter proposal " + quote.quoteNumber + " for " + formatNad(quote.total) + ". Please assist with payment and booking confirmation.")} target="_blank" rel="noopener noreferrer">Contact us on WhatsApp</a>
        </section>
        <p className="mt-6 text-xs text-muted-foreground">This link is private and expires on {dateText(quote.validUntil.toISOString())}. Internal operating costs and margin are not shown.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
