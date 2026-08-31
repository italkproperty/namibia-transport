import type { Metadata } from "next";
import Link from "next/link";

import { JourneyPlanner } from "@/components/booking/journey-planner";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { TRIP_KEYS } from "@/lib/booking/trip-params";
import { listRoutes, listVehicleClasses } from "@/lib/maps";
import { parseJourneySlug } from "@/lib/network/journey";
import { findNode } from "@/lib/network/nodes";
import { SITE } from "@/lib/site";

/**
 * Anywhere to anywhere.
 *
 * The route pages sell the eight drives we have priced by hand, and every one
 * of them starts at the airport or in Windhoek. Namibian itineraries are
 * loops: dunes, coast, Damaraland, Etosha, home. This page prices the legs in
 * the middle — the ones that never touch the capital and that we could not
 * previously quote at all.
 *
 * One page, not fifteen hundred. Forty places make more than fifteen hundred
 * pairs, and generating a page per pair is how a site earns a thin-content
 * penalty rather than traffic — so the pairs live in the URL's query string
 * and there is a single indexable page, which is a tool rather than an
 * article. The curated routes keep their own pages and their own copy.
 */
export const metadata: Metadata = {
  title: "Price any journey in Namibia",
  description: `Distance, driving time and a fixed price for a private transfer between any two places in Namibia, from ${SITE.name}.`,
  // Query strings carry the pair, so there is one page to index rather than a
  // pair-shaped page per pair. Canonical to the bare path for the same reason.
  alternates: { canonical: "/journey" },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function JourneyPage({ searchParams }: PageProps) {
  const [{ routes }, vehicleClasses, params] = await Promise.all([
    listRoutes({ activeOnly: true }),
    listVehicleClasses(),
    searchParams,
  ]);

  // Accepts either an explicit pair or the route slug the booking page hands
  // back, so "Change" from a half-finished booking lands on the same journey.
  const fromParam = one(params.from);
  const toParam = one(params.to);
  const fromSlug = one(params[TRIP_KEYS.route]);
  const parsed = fromSlug ? parseJourneySlug(fromSlug) : null;

  const from =
    (fromParam && findNode(fromParam)?.slug) ?? parsed?.origin.slug ?? "windhoek";
  const to =
    (toParam && findNode(toParam)?.slug) ??
    parsed?.destination.slug ??
    (from === "sossusvlei" ? "swakopmund" : "sossusvlei");

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
          <h1 className="text-2xl sm:text-3xl">Price any journey in Namibia</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Not just to and from the airport. Pick where you are and where you
            are going, and you get the distance, the roads, how long the drive
            actually takes and a price that is fixed when you book.
          </p>

          <div className="mt-6">
            <JourneyPlanner
              routes={routes}
              vehicleClasses={vehicleClasses}
              initialFrom={from}
              initialTo={to}
            />
          </div>

          <div className="text-muted-foreground mt-8 space-y-3 text-xs">
            <p>
              Prices are computed from the road itself — its length, its
              surface, and how far the driver has to come back. Where a journey
              is one of our published routes you get the published fare
              instead.
            </p>
            <p>
              Somewhere not on the list?{" "}
              <Link
                href="/contact"
                className="text-foreground underline underline-offset-4"
              >
                Tell us where
              </Link>{" "}
              and we will quote it. The list covers the towns, gates and lodges
              transfers actually run to; it is not everywhere in Namibia.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}
