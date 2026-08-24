import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SupportStrip } from "@/components/marketing/trust";
import { Button } from "@/components/ui/button";
import { getCompanyInfo } from "@/lib/company";
import { listRoutes } from "@/lib/maps";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About us",
  description: `Who is behind ${SITE.name}: a Namibian booking and dispatch operation working with vetted independent partner drivers.`,
  alternates: { canonical: `${SITE.url}/about` },
};

/**
 * Honest by design: this page explains the model as it actually works —
 * a booking and operations layer over vetted independent drivers — and makes
 * no claims about history, fleet size or staff that do not exist yet.
 */
export default async function AboutPage() {
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
            A booking platform with an operations team, not a taxi rank.
          </h1>

          <div className="mt-6 space-y-5 leading-relaxed text-pretty">
            <p>
              {SITE.name} exists because arriving in Namibia should not begin
              with negotiating at a kerb. We are a Namibian booking and
              dispatch operation based in {company.location}: you book online
              at a fixed price, and we take responsibility for everything that
              has to happen before a car door opens — confirming the trip,
              watching the flight, assigning the right driver and vehicle, and
              staying reachable until you are where you are going.
            </p>
            <p>
              The driving itself is done by vetted independent Namibian
              partner drivers. We select them, brief them on our standard —
              name-board meet &amp; greet, no meter, no detours, help with
              luggage — and we stand behind every trip they take for us. If a
              driver has an emergency, re-assigning the trip is our problem,
              never yours.
            </p>
            <p>
              We are deliberately transparent about being a young company. We
              would rather show you exactly how a booking works, quote a price
              that cannot move, and be reachable on WhatsApp at every step,
              than borrow credibility we have not earned yet. Our standards
              are simple: a confirmed booking is a kept booking, a quoted
              price is the final price, and a message to us gets answered by
              a person.
            </p>
          </div>

          <h2 className="mt-10 text-lg font-semibold">What we operate today</h2>
          <ul className="text-muted-foreground mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            <li>
              Fixed-price airport transfers from Hosea Kutako International
              Airport, priced per person.
            </li>
            <li>
              Long-distance private transfers between Windhoek and the coast,
              priced per vehicle.
            </li>
            <li>
              Corporate and group transport on account — quoted online,
              invoiced monthly.
            </li>
          </ul>

          <div className="mt-8 flex flex-wrap gap-2">
            <Button asChild className="press bg-brand text-brand-foreground hover:bg-brand-hover">
              <Link href="/book">Book a transfer</Link>
            </Button>
            <Button asChild variant="outline" className="press">
              <Link href="/corporate">Corporate quotation</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <SupportStrip />
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}
