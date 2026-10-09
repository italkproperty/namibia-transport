import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Namibia Transfers for South African Travellers",
  description:
    "Planning a Namibia trip from South Africa? Arrange private, fixed-price transfers between Windhoek, the coast, lodges and destinations across Namibia.",
  alternates: { canonical: `${SITE.url}/south-african-travellers` },
  openGraph: {
    type: "website",
    url: `${SITE.url}/south-african-travellers`,
    title: "Namibia Transfers for South African Travellers",
    description:
      "Plan the transport part of your Namibia trip with private, fixed-price transfers and route-specific quotes.",
    siteName: SITE.name,
  },
};

const popularJourneys = [
  {
    from: "windhoek",
    to: "swakopmund",
    label: "Windhoek to Swakopmund",
    detail: "Travel from the capital to Namibia's Atlantic coast.",
  },
  {
    from: "windhoek",
    to: "walvis-bay",
    label: "Windhoek to Walvis Bay",
    detail: "Arrange a private transfer to the coast and onward connections.",
  },
  {
    from: "spitzkoppe",
    to: "swakopmund",
    label: "Spitzkoppe to Swakopmund",
    detail: "Connect a stop in the Erongo region with the coast.",
  },
];

export default function SouthAfricanTravellersPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="bg-foreground text-background">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <p className="text-background/60 font-mono text-xs tracking-[0.16em] uppercase">
              Planning a Namibia trip
            </p>
            <h1 className="mt-4 max-w-3xl text-3xl leading-tight font-semibold tracking-tight text-pretty sm:text-5xl">
              Private transfers in Namibia for South African travellers
            </h1>
            <p className="text-background/75 mt-5 max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
              Visiting Namibia from South Africa? Plan how you will get between
              the airport, towns, the coast and the destinations on your
              itinerary. Namibia Transport helps you arrange private transfers
              with a fixed fare for the whole vehicle before you book.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/journey"
                className="press bg-background text-foreground inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
              >
                Get a transfer quote
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
              <Link
                href="/destinations"
                className="border-background/30 text-background inline-flex min-h-11 items-center justify-center rounded-lg border px-5 py-2.5 text-sm font-semibold"
              >
                Explore destinations
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <section aria-labelledby="how-it-works">
            <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight">
              Plan the journeys between your stops
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed text-pretty">
              An itinerary can include long distances and gravel roads. Choose
              the places you need to connect and request a quote before you
              finalise the transport part of your trip. Quotes are for the
              vehicle, not a per-person seat price.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                "Fixed fare shown before you commit",
                "Private journeys for your own travel party",
                "Route options across Namibia's road network",
              ].map((item) => (
                <li key={item} className="bg-card flex gap-2 rounded-xl border p-4 text-sm leading-relaxed">
                  <CheckCircle2Icon className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="journeys" className="mt-12">
            <h2 id="journeys" className="text-2xl font-semibold tracking-tight">
              Start with a popular journey
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Select a route to open the quote flow with your journey prefilled.
            </p>
            <ul className="mt-4 divide-y border-y">
              {popularJourneys.map((journey) => (
                <li key={journey.label}>
                  <Link
                    href={`/journey?from=${journey.from}&to=${journey.to}`}
                    className="group hover:bg-card focus-ring -mx-3 flex items-center justify-between gap-4 rounded-md px-3 py-4 transition-colors"
                  >
                    <span>
                      <span className="block font-medium">{journey.label}</span>
                      <span className="text-muted-foreground mt-1 block text-sm">{journey.detail}</span>
                    </span>
                    <ArrowRightIcon className="text-muted-foreground group-hover:text-brand size-4 shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="before-you-book" className="mt-12">
            <h2 id="before-you-book" className="text-2xl font-semibold tracking-tight">
              Before you book
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold">Have your itinerary ready</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Share your pickup point, destination, travel date, passenger
                  count and luggage needs so the right vehicle and fare can be
                  confirmed.
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Check each leg separately</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  A multi-stop holiday may need several transfers. Use the
                  journey quote flow for each leg, or contact us if you need
                  help planning the sequence.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-card mt-12 rounded-xl border p-5 sm:p-7">
            <h2 className="text-xl font-semibold">Ready to plan your Namibia transfers?</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              Start with your route and travel details. You can review the
              journey before committing to a booking.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/journey" className="press bg-brand text-brand-foreground inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold">
                Price your journey <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
              <Link href="/transfers" className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm font-semibold">
                View transfer routes
              </Link>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
