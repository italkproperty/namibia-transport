import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2Icon, ClockIcon } from "lucide-react";

import { BankTransfer } from "@/components/booking/bank-transfer";
import { TripDetailsForm } from "@/components/booking/trip-details-form";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getQuoteGroup } from "@/lib/booking/group-queries";
import { isAirportLeg } from "@/lib/booking/details";
import { groupValidity } from "@/lib/booking/validity";
import { getCompanyInfo, SUPPORT, whatsappLink } from "@/lib/company";
import { fxNote, indicativeUsd } from "@/lib/fx";
import { formatDateTime, formatDuration } from "@/lib/format";
import { listRoutes } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import {
  bankTransferLines,
  getBankDetails,
  proofOfPaymentLink,
  TRANSFER_NOTE,
} from "@/lib/payments/bank";
import { getTransferState } from "@/lib/payments/transfer";

export const metadata: Metadata = {
  title: "Your quote",
  robots: { index: false, follow: false },
};

/** A quote reference is personal — never let a search engine hold one. */
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ group: string }> };

export default async function QuoteGroupPage({ params }: PageProps) {
  const { group } = await params;
  const quote = await getQuoteGroup(decodeURIComponent(group));
  if (!quote) notFound();

  const { routes } = await listRoutes({ activeOnly: true });
  const usd = indicativeUsd(quote.total);
  const rateNote = fxNote();
  const company = getCompanyInfo();

  // A quote at a public URL is a live price. One sent in September and opened
  // in December would otherwise still be payable at September's fare, and the
  // first we would know is a transfer arriving for a trip that now costs more
  // to run than it earns. So an expired quote keeps its page — the traveller
  // can still see what they were quoted — but loses the way to pay it.
  const validity = groupValidity(quote.legs);
  const bank =
    quote.isCancelled || validity.expired ? null : getBankDetails();

  // One trip, one transfer: payment is tracked against the first leg, and its
  // reference is what the traveller puts in the bank's reference field.
  const firstLeg = quote.legs[0];
  const transfer = await getTransferState(firstLeg.id);

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
          <p className="text-muted-foreground text-xs font-medium">
            Your quote
          </p>
          <h1 className="tabular mt-2 font-mono text-2xl sm:text-3xl">
            {quote.groupRef}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            For {quote.customerName} · {quote.legs.length} legs. Quote this any
            time you message us.
          </p>

          {quote.isPaid && (
            <p className="text-success mt-5 flex items-center gap-2 font-medium">
              <CheckCircle2Icon className="size-5" aria-hidden />
              Paid and confirmed.
            </p>
          )}

          {validity.expired && !quote.isCancelled && (
            <div className="border-warning/40 bg-warning/10 mt-5 flex gap-3 rounded-xl border p-4">
              <ClockIcon
                className="text-warning mt-0.5 size-5 shrink-0"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="font-medium">
                  {validity.reason === "travelled"
                    ? "These dates have passed"
                    : "This fare is out of date"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                  {validity.message}
                </p>
                {company.whatsapp && (
                  <a
                    href={whatsappLink(
                      company.whatsapp,
                      `Hi — quote ${quote.groupRef}. Could you re-price it?`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline underline-offset-4"
                  >
                    Ask us to re-price it on WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------ the itinerary */}
          <section aria-labelledby="legs-heading" className="mt-8">
            <h2 id="legs-heading" className="text-base font-semibold">
              Your itinerary
            </h2>
            <ol className="mt-3 grid gap-2">
              {quote.legs.map((leg, index) => (
                <li key={leg.ref} className="bg-card rounded-xl border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="min-w-0 font-medium">
                      <span className="text-muted-foreground tabular mr-2 text-xs">
                        {index + 1}
                      </span>
                      {leg.pickupLabel} → {leg.dropoffLabel}
                    </p>
                    <p className="tabular text-sm font-semibold">
                      {formatNad(leg.price)}
                    </p>
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-sm">
                    {formatDateTime(leg.scheduledAt)}
                    {leg.durationMin
                      ? ` · about ${formatDuration(leg.durationMin)}`
                      : ""}
                    {leg.distanceKm
                      ? ` · ${Math.round(Number(leg.distanceKm))} km`
                      : ""}
                  </p>
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    {leg.ref}
                  </p>

                  <TripDetailsForm
                    bookingRef={leg.ref}
                    legLabel={`${leg.pickupLabel} → ${leg.dropoffLabel}`}
                    dateLabel={formatDateTime(leg.scheduledAt)}
                    isAirportLeg={isAirportLeg(
                      leg.journeySlug,
                      leg.pickupLabel,
                      leg.dropoffLabel,
                    )}
                    pickupTime={namibianTime(leg.scheduledAt)}
                    pickupDetail={leg.pickupDetail}
                    travellerNotes={leg.travellerNotes}
                    flightNumber={leg.flightNumber}
                    savedAt={leg.detailsUpdatedAt?.toISOString() ?? null}
                  />
                </li>
              ))}
            </ol>
          </section>

          {quote.notes && (
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed text-pretty">
              {quote.notes}
            </p>
          )}

          {/* ---------------------------------------------------- the total */}
          <section className="mt-6 border-t pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  Total for the trip, all in
                </p>
                <p className="tabular text-brand mt-1 text-3xl leading-none font-semibold">
                  {formatNad(quote.total)}
                </p>
                {usd && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    about {usd}
                    {rateNote ? ` — ${rateNote}` : ""}. We are paid in Namibian
                    dollars; your bank converts at its own rate on the day.
                  </p>
                )}
              </div>
            </div>
            <p className="text-muted-foreground mt-2 text-sm leading-snug text-pretty">
              A fixed price for the whole vehicle on every leg — the same
              whether one of you travels or the car is full. Your driver, fuel
              and their nights away are all in it.
            </p>
          </section>

          {!quote.isPaid && bank && (
            <div className="mt-6">
              <BankTransfer
                bookingRef={firstLeg.ref}
                lines={bankTransferLines(bank, firstLeg.ref)}
                note={TRANSFER_NOTE}
                declaredAt={transfer.declaredAt}
                confirmed={transfer.status === "confirmed"}
                proofEmail={company.email}
                proofHref={
                  company.email
                    ? proofOfPaymentLink(
                        company.email,
                        firstLeg.ref,
                        formatNad(quote.total),
                      )
                    : null
                }
              />
            </div>
          )}

          {company.whatsapp && (
            <p className="text-muted-foreground mt-8 border-t pt-5 text-sm leading-relaxed">
              Anything to change?{" "}
              <a
                href={whatsappLink(
                  company.whatsapp,
                  `Hi — about quote ${quote.groupRef}.`,
                )}
                className="text-foreground underline underline-offset-4"
              >
                Message us on WhatsApp
              </a>
              . Coordination {SUPPORT.officeHoursShort}.
            </p>
          )}
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}

/** "09:00" in Namibian terms, for the time input's default. */
function namibianTime(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Windhoek",
  }).format(at);
}
