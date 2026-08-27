import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { formatDuration, shortPlace } from "@/lib/format";
import { listRoutes } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { pricingUnitLabel } from "@/lib/pricing";
import { SITE } from "@/lib/site";

/**
 * The category page. Individual route pages target one journey each; nothing
 * targeted the category itself, and nothing linked every route from one place
 * — which left the deeper routes reachable only from the home page dropdown.
 */
export const metadata: Metadata = {
  title: "Transfers across Namibia — every route and fixed price",
  description:
    "Fixed-price private transfers across Namibia: Hosea Kutako airport to Windhoek, Swakopmund, Walvis Bay, Sossusvlei and Etosha, plus intercity routes. One price per route, quoted before you book.",
  alternates: { canonical: `${SITE.url}/transfers` },
};

export default async function TransfersIndexPage() {
  const { routes } = await listRoutes({ activeOnly: true });

  const airport = routes.filter((route) => route.category === "airport");
  const intercity = routes.filter((route) => route.category !== "airport");

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
          <h1 className="max-w-2xl text-2xl leading-tight sm:text-4xl">
            Every route we run, with the price on it.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm text-pretty sm:text-base">
            One fixed price per route, quoted in full before you book. Airport
            transfers are priced per person; long-distance routes are priced for
            the whole vehicle, so the fare is the same for one traveller or four.
          </p>

          <RouteGroup
            id="airport"
            heading="From Hosea Kutako International Airport"
            blurb="Your driver tracks the inbound flight and waits in arrivals with a name board, so a delayed landing costs you nothing."
            routes={airport}
          />

          <RouteGroup
            id="intercity"
            heading="Intercity"
            blurb="Collected from your hotel or guesthouse at a time you choose."
            routes={intercity}
          />

          <section
            aria-labelledby="corporate-heading"
            className="bg-card mt-10 rounded-xl border p-5"
          >
            <h2 id="corporate-heading" className="text-base font-semibold">
              Something not listed here?
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-snug">
              We quote routes beyond this list — lodge transfers, multi-day
              itineraries and standing corporate accounts.{" "}
              <Link
                href="/corporate"
                className="text-foreground underline underline-offset-2"
              >
                Get an itemised quotation
              </Link>
              , or message us and we will price it.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}

function RouteGroup({
  id,
  heading,
  blurb,
  routes,
}: {
  id: string;
  heading: string;
  blurb: string;
  routes: Awaited<ReturnType<typeof listRoutes>>["routes"];
}) {
  if (routes.length === 0) return null;

  return (
    <section aria-labelledby={`${id}-heading`} className="mt-10">
      <h2 id={`${id}-heading`} className="text-lg font-semibold">
        {heading}
      </h2>
      <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-snug">
        {blurb}
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {routes.map((route) => {
          const duration = formatDuration(route.durationMin);
          return (
            <li key={route.slug}>
              <Link
                href={`/transfers/${route.slug}`}
                className="press bg-card hover:border-foreground/25 focus-visible:ring-ring group flex h-full items-start justify-between gap-4 rounded-xl border p-4 focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="block text-sm leading-snug font-medium">
                    {shortPlace(route.originLabel)} → {route.destinationLabel}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {[
                      route.distanceKm &&
                        `${Math.round(Number(route.distanceKm))} km`,
                      duration && `about ${duration}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="tabular text-brand mt-2 block text-lg font-semibold">
                    {formatNad(route.fixedPrice)}
                    <span className="text-muted-foreground text-xs font-normal">
                      {" "}
                      {pricingUnitLabel(route)}
                    </span>
                  </span>
                </span>
                <ArrowRightIcon
                  className="text-muted-foreground group-hover:text-foreground mt-0.5 size-4 shrink-0 transition-colors"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
