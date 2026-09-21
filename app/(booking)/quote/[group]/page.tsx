import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";

import { BankTransfer } from "@/components/booking/bank-transfer";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getQuoteGroup } from "@/lib/booking/group-queries";
import { getCompanyInfo, SUPPORT, whatsappLink } from "@/lib/company";
import { formatDateTime, formatDuration } from "@/lib/format";
import { listRoutes } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import {
  bankTransferLines,
  getBankDetails,
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
  const company = getCompanyInfo();
  const bank = quote.isCancelled ? null : getBankDetails();

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
