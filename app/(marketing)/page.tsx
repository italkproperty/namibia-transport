import Link from "next/link";
import { ArrowRightIcon, BuildingIcon } from "lucide-react";

import { HomeQuote } from "@/components/booking/home-quote";
import { DuneScene } from "@/components/marketing/dune-scene";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import {
  ReviewBadge,
  ReviewsSection,
  SupportStrip,
} from "@/components/marketing/trust";
import { Button } from "@/components/ui/button";
import { parseTripParams } from "@/lib/booking/trip-params";
import {
  listRoutes,
  listVehicleClasses,
  withRouteGeometries,
} from "@/lib/maps";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const [{ routes: bareRoutes }, vehicleClasses, params] = await Promise.all([
    listRoutes({ activeOnly: true }),
    listVehicleClasses(),
    searchParams,
  ]);

  // The widget can switch to any of these, and the map follows the selection —
  // so every one needs its road geometry before the routes reach the client.
  // Fetched once per route ever, then read from the database.
  const routes = await withRouteGeometries(bareRoutes);

  // Lets "Change trip" on /book come back to the widget already filled in.
  const initialTrip =
    routes.length > 0 && vehicleClasses.length > 0
      ? parseTripParams(params, routes, vehicleClasses)
      : undefined;

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        {/* ------------------------------------------- headline + the widget */}
        <section className="relative overflow-hidden">
          <DuneScene className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28 w-full sm:h-40" />

          <div className="mx-auto max-w-5xl px-4 pt-8 pb-10 sm:px-6 sm:pt-12 sm:pb-16">
            {/* The old headline named the category — which the visitor already
                knew, having searched for it — and spent the most valuable line
                on the site saying nothing. This names the thing they are
                actually anxious about, and the line under it carries the two
                concrete promises that the deleted sections used to make
                eleven times between them. */}
            <h1 className="max-w-2xl text-2xl leading-tight sm:text-4xl">
              Know who is meeting you before you land.
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm text-pretty sm:text-base">
              Fixed prices across Namibia. Your driver waits inside arrivals
              with your name on a board, and we watch your flight — so a delay
              costs you nothing.
            </p>

            {/* Renders only once real published reviews exist. */}
            <ReviewBadge />

            <div className="mt-6">
              {routes.length > 0 && vehicleClasses.length > 0 ? (
                <HomeQuote
                  routes={routes}
                  vehicleClasses={vehicleClasses}
                  initialTrip={initialTrip}
                />
              ) : (
                <div className="bg-card rounded-xl border p-6 text-center">
                  <p className="font-medium">Bookings are not open yet</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    No routes are published. Please check back shortly.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- reviews */}
        <ReviewsWrapper />

        {/* ----------------------------------------------------- where next */}
        <section
          aria-labelledby="elsewhere-heading"
          className="mx-auto max-w-5xl px-4 pb-10 sm:px-6"
        >
          <h2
            id="elsewhere-heading"
            className="text-muted-foreground mb-2 text-xs font-medium"
          >
            Not an airport transfer?
          </h2>
          <ul className="grid gap-2 sm:grid-cols-3">
            {[
              {
                href: "/journey",
                title: "Any two places in Namibia",
                blurb: "Coast to dunes, park to park — priced from the road.",
              },
              {
                href: "/self-drive",
                title: "Should you drive it yourself?",
                blurb: "The real cost of a hire car against a driven trip.",
              },
              {
                href: "/vehicles",
                title: "The vehicles",
                blurb: "What each class seats, and which routes it suits.",
              },
            ].map((card) => (
              <li key={card.href}>
                <Link
                  href={card.href}
                  className="bg-card hover:border-brand/40 press block h-full rounded-xl border p-4 transition"
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {card.title}
                    <ArrowRightIcon className="size-3.5 shrink-0" aria-hidden />
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs leading-snug">
                    {card.blurb}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ----------------------------------------------------- corporate */}
        <section
          aria-labelledby="corporate-heading"
          className="mx-auto max-w-5xl px-4 pb-10 sm:px-6"
        >
          <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
            <div className="flex min-w-0 items-start gap-3">
              <BuildingIcon
                className="text-brand mt-0.5 size-5 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              <div className="min-w-0">
                <h2 id="corporate-heading" className="text-base font-semibold">
                  Corporate transport
                </h2>
                <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
                  One account, one quotation, one monthly invoice — itemised in
                  about a minute.
                </p>
              </div>
            </div>

            <Button asChild variant="outline" className="press shrink-0">
              <Link href="/corporate">
                Get an instant quotation
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>

        {/* --------------------------------------------------------- support */}
        <div className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <SupportStrip />
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}

/** Renders nothing until real, published reviews exist. */
async function ReviewsWrapper() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 [&:has(section)]:pb-12">
      <ReviewsSection />
    </div>
  );
}
