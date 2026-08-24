import type { Metadata } from "next";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getCompanyInfo } from "@/lib/company";
import { listRoutes } from "@/lib/maps";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Booking terms & cancellation policy",
  description: `The booking, cancellation and refund terms for ${SITE.name} transfers, in plain language.`,
  alternates: { canonical: `${SITE.url}/terms` },
};

/**
 * Plain-language terms a traveller can actually read before booking a
 * transfer from another country. Legal review before launch is expected —
 * the substance (24h free cancellation, delay handling, our re-assignment
 * duty) is the operating standard the founder confirms, not boilerplate.
 */
export default async function TermsPage() {
  const [{ routes }, company] = await Promise.all([
    listRoutes({ activeOnly: true }),
    Promise.resolve(getCompanyInfo()),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
          <h1 className="text-2xl sm:text-3xl">
            Booking terms &amp; cancellation policy
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Written to be read, not buried. If anything here is unclear,
            message us before you book.
          </p>

          <div className="mt-8 space-y-8">
            <Section title="Your price">
              <p>
                The price shown when you book is the full and final price for
                the trip described in your confirmation. Airport transfers are
                priced per person; long-distance transfers are priced per
                vehicle — the unit is always shown next to the price. There is
                no meter, no surge pricing, no airport surcharge and no
                night-time supplement.
              </p>
            </Section>

            <Section title="Payment">
              <p>
                Nothing is charged when you book. We confirm your booking and
                send payment instructions on WhatsApp before your travel date.
                Your fare is locked at the quoted amount from the moment you
                receive your booking reference, whether you have paid yet or
                not.
              </p>
            </Section>

            <Section title="Cancellation and refunds">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>More than 24 hours before pickup:</strong> free
                  cancellation. Anything already paid is refunded in full.
                </li>
                <li>
                  <strong>Within 24 hours of pickup:</strong> 50% of the fare
                  is payable, reflecting the driver time reserved for you.
                </li>
                <li>
                  <strong>No-show at pickup:</strong> the full fare is payable.
                </li>
                <li>
                  <strong>Flight cancelled by the airline:</strong> free
                  cancellation or free re-booking, whichever you prefer — that
                  is not your fault.
                </li>
              </ul>
            </Section>

            <Section title="If your flight is delayed">
              <p>
                Give us your flight number and we track the flight. Your
                pickup moves with your actual landing time at no extra charge
                — a delayed flight never becomes a missed transfer or a
                waiting fee.
              </p>
            </Section>

            <Section title="If a driver cannot make it">
              <p>
                Re-assignment is our responsibility, not yours. If your
                assigned driver has an emergency, our operations team places
                another vetted driver on your trip and tells you on WhatsApp —
                same price, same standard. If we ever fail to provide the
                transfer at all, you pay nothing and anything paid is refunded
                in full.
              </p>
            </Section>

            <Section title="Waiting time">
              <p>
                Airport pickups include one hour of waiting after your flight
                lands. Other pickups include 15 minutes after the agreed time.
                If you are delayed beyond that, message us — where the driver
                can wait, additional waiting is agreed with you before any
                charge applies.
              </p>
            </Section>

            <Section title="Luggage and passengers">
              <p>
                Vehicle capacities shown at booking are what we can actually
                carry. Tell us about oversized luggage — surfboards, camera
                rigs, mobility equipment — in the booking notes so we assign a
                vehicle that fits it.
              </p>
            </Section>

            <Section title="Who provides the transport">
              <p>
                Trips are fulfilled by vetted independent Namibian partner
                drivers operating under our booking, standards and support.
                Your contract for the booking, and every question about it, is
                with {SITE.name}
                {company.registration ? ` (${company.registration})` : ""} —
                one point of responsibility, reachable on WhatsApp.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="text-muted-foreground mt-2 space-y-2 text-sm leading-relaxed text-pretty">
        {children}
      </div>
    </section>
  );
}
