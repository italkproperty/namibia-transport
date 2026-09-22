import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Fare } from "@/components/currency/fare";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { formatDuration } from "@/lib/format";
import { DESTINATIONS, bestValueArrival } from "@/lib/network/destinations";
import { nodeLabel, REGION_LABELS, type Region } from "@/lib/network/nodes";
import { SITE } from "@/lib/site";

/**
 * The hub the destination pages hang off.
 *
 * Grouped by region rather than listed alphabetically, because that is how an
 * itinerary is actually built: nobody plans a trip that alternates between the
 * Kaokoveld and the far south, and a flat A–Z hides which places sit near
 * enough to combine.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Every destination we price",
  description:
    "What it costs to reach anywhere in Namibia people actually go — the " +
    "roads, the surface, an honest driving time and a fixed price for the " +
    "whole vehicle, computed from the road network rather than a price list.",
  alternates: { canonical: `${SITE.url}/destinations` },
};

export default function DestinationsPage() {
  const byRegion = new Map<Region, typeof DESTINATIONS>();
  for (const destination of DESTINATIONS) {
    const list = byRegion.get(destination.node.region) ?? [];
    list.push(destination);
    byRegion.set(destination.node.region, list);
  }

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-pretty sm:text-4xl">
            Every destination we price.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed text-pretty">
            {DESTINATIONS.length} places people build a Namibian itinerary
            around, each with the roads in, the surface underneath, an honest
            driving time and a fixed price for the whole vehicle — computed
            from the road network, not read off a list.
          </p>

          {[...byRegion.entries()].map(([region, list]) => (
            <section key={region} aria-labelledby={region} className="mt-10">
              <h2
                id={region}
                className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.16em] uppercase"
              >
                {REGION_LABELS[region] ?? region}
              </h2>

              <ul className="mt-2 divide-y border-t border-b">
                {list.map((destination) => {
                  const best = bestValueArrival(destination);
                  return (
                    <li key={destination.slug}>
                      <Link
                        href={`/destinations/${destination.slug}`}
                        className="hover:bg-card focus-ring group -mx-3 flex items-baseline gap-x-5 gap-y-1 rounded-md px-3 py-4 transition-colors max-sm:flex-col sm:items-center"
                      >
                        <span className="text-base font-medium sm:w-56 sm:shrink-0">
                          {nodeLabel(destination.node)}
                        </span>
                        <span className="text-muted-foreground min-w-0 flex-1 text-sm leading-snug">
                          from {nodeLabel(best.from)} ·{" "}
                          {formatDuration(best.journey.road.minutes)}
                          {best.journey.hasGravel ? " · some gravel" : ""}
                        </span>
                        <span className="tabular text-brand shrink-0 text-sm font-semibold">
                          <Fare nad={best.journey.route.fixedPrice} bare />
                        </span>
                        <ArrowRightIcon
                          className="text-muted-foreground group-hover:text-brand size-4 shrink-0 transition-transform group-hover:translate-x-0.5 max-sm:hidden"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <p className="text-muted-foreground mt-12 max-w-2xl text-sm leading-relaxed text-pretty">
            Going somewhere not listed? The model prices any two of 49 places
            on the network —{" "}
            <Link
              href="/journey"
              className="focus-ring rounded-sm underline underline-offset-4"
            >
              price any journey in Namibia
            </Link>{" "}
            — and a lodge off the network is priced through the nearest town we
            do model, once you tell us which lodge.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
