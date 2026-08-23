import Link from "next/link";
import { ArrowRightIcon, BuildingIcon } from "lucide-react";

import { HomeQuote } from "@/components/booking/home-quote";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { parseTripParams } from "@/lib/booking/trip-params";
import { listRoutes, listVehicleClasses } from "@/lib/maps";

const TRUST = [
  "Fixed prices",
  "Meet & greet",
  "Flight monitoring",
  "Professional drivers",
  "24/7 support",
];

const STEPS = [
  {
    title: "Quote and book",
    body: "Pick route, date and vehicle. The price you see is the price you pay.",
  },
  {
    title: "We assign a driver",
    body: "A vetted Namibian partner driver, confirmed to you on WhatsApp.",
  },
  {
    title: "They meet you",
    body: "Name board in arrivals, or at your door. Straight to your destination.",
  },
];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const [{ routes }, vehicleClasses, params] = await Promise.all([
    listRoutes({ activeOnly: true }),
    listVehicleClasses(),
    searchParams,
  ]);

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
        <section className="mx-auto max-w-5xl px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
          <h1 className="text-2xl leading-tight sm:text-3xl">
            Fixed-price private transfers across Namibia
          </h1>

          <ul className="text-muted-foreground mt-2 mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
            {TRUST.map((item, index) => (
              <li key={item} className="flex items-center gap-3">
                {/* Hidden once the list wraps, so no line ever starts on a dot. */}
                {index > 0 && (
                  <span className="text-border hidden sm:inline" aria-hidden>
                    ·
                  </span>
                )}
                {item}
              </li>
            ))}
          </ul>

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
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section
          aria-labelledby="how-heading"
          className="mx-auto max-w-5xl px-4 py-8 sm:px-6"
        >
          <h2 id="how-heading" className="sr-only">
            How it works
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  className="bg-brand-subtle text-brand tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------------- corporate */}
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
                  Corporate &amp; group transport
                </h2>
                <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
                  Airport transfers for visiting teams, conferences, site and
                  employee transport — billed monthly.
                </p>
              </div>
            </div>

            <Button asChild variant="outline" className="press shrink-0">
              <Link href="/corporate">
                Request a quotation
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}
