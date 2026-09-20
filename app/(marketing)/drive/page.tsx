import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { formatDuration } from "@/lib/format";
import { listRoutes } from "@/lib/maps";
import { modelJourney } from "@/lib/network/journey";
import { LEGS } from "@/lib/network/legs";
import { REGION_LABELS, REGION_ORDER, type Region } from "@/lib/network/nodes";
import { SITE } from "@/lib/site";

/**
 * The index for the leg pages.
 *
 * Without it the 160 leg pages are reachable only from a sitemap and from each
 * other, which is how a set of generated pages ends up crawled and never
 * ranked. Grouped by the region the drive starts in, because that is how
 * someone with a half-built itinerary looks for the next hop.
 */
export const metadata: Metadata = {
  title: "Driving distances and times across Namibia",
  description:
    "Honest driving times, surface splits and fixed transfer prices for every leg people actually drive in Namibia — computed from a road model, not a map app.",
  alternates: { canonical: `${SITE.url}/drive` },
};

export default async function DriveIndexPage() {
  const { routes } = await listRoutes({ activeOnly: true });

  const rows = LEGS.map((leg) => {
    const journey = modelJourney(leg.a.slug, leg.b.slug);
    return journey ? { leg, road: journey.road } : null;
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  const byRegion = REGION_ORDER.map((region: Region) => ({
    region,
    label: REGION_LABELS[region],
    rows: rows.filter((row) => row.leg.a.region === region),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
          <h1 className="text-2xl leading-tight sm:text-3xl">
            Driving distances and times across Namibia
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl leading-relaxed text-pretty">
            {rows.length} legs people actually drive, each with the roads by
            number, the tar-and-gravel split to the kilometre, a driving time at
            speeds a careful driver sustains, and a fixed price to hand the
            drive to someone else.{" "}
            <Link href="/journey" className="underline underline-offset-2">
              Any other pair
            </Link>{" "}
            is priced on request.
          </p>

          {byRegion.map((group) => (
            <section key={group.region} className="mt-10">
              <h2 className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.16em] uppercase">
                From {group.label}
              </h2>
              <ul className="mt-2 divide-y border-t border-b">
                {group.rows.map(({ leg, road }) => (
                  <li key={leg.slug}>
                    <Link
                      href={`/drive/${leg.slug}`}
                      className="hover:bg-card focus-ring -mx-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md px-3 py-3 transition-colors"
                    >
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        {leg.a.shortName ?? leg.a.name} to{" "}
                        {leg.b.shortName ?? leg.b.name}
                      </span>
                      <span className="tabular text-muted-foreground shrink-0 text-xs">
                        {road.km} km
                      </span>
                      <span className="tabular shrink-0 text-xs font-medium">
                        {formatDuration(road.minutes)}
                      </span>
                      <span className="text-muted-foreground w-20 shrink-0 text-right text-xs">
                        {road.gravelKm === 0
                          ? "tar"
                          : `${Math.round((road.gravelKm / road.km) * 100)}% gravel`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}
