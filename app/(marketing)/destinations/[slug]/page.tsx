import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, SunsetIcon } from "lucide-react";

import { Fare } from "@/components/currency/fare";
import { RouteMap } from "@/components/marketing/route-map";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { getCompanyInfo, whatsappLink } from "@/lib/company";
import { formatDuration } from "@/lib/format";
import {
  DESTINATIONS,
  findDestination,
  type Arrival,
  type Destination,
} from "@/lib/network/destinations";
import { LEGS } from "@/lib/network/legs";
import { nodeLabel } from "@/lib/network/nodes";
import { describeRoads, describeVia } from "@/lib/network/roads";
import { SITE } from "@/lib/site";

/**
 * One page per place people are going, as opposed to one per pair of places.
 *
 * "Swakopmund to Sossusvlei" is the right page for somebody who already knows
 * where they are leaving from. It is the wrong shape for the question typed
 * far more often — *I am going to Sossusvlei, how do I get there and what
 * does it cost* — and that reader currently gets a contact form from every
 * operator in the country.
 *
 * Everything on this page is computed from the road model: the roads by
 * number, the surface split, a driving time at speeds a careful driver
 * sustains, the gate that shuts at dusk, and a fixed price from each gateway
 * in both directions. None of it is typed, so none of it can drift, and none
 * of it is available to a competitor pricing off a list.
 *
 * What the page deliberately does not do is describe anybody's lodge. We are
 * a transport company; we can state what it takes to reach a place and what
 * that costs, and we cannot state whether the rooms are nice. Inventing that
 * would trade the one thing this site has for the one thing every other site
 * already has too much of.
 */

export const revalidate = 3600;

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return DESTINATIONS.map((destination) => ({ slug: destination.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const destination = findDestination(slug);
  if (!destination) return {};

  const name = nodeLabel(destination.node);
  const nearest = destination.arrivals[0];
  const hours = formatDuration(nearest.journey.road.minutes);

  return {
    title: `Getting to ${name}`,
    description:
      `How to reach ${name}, and what it costs. ${hours} from ` +
      `${nodeLabel(nearest.from)} on ${describeRoads(nearest.journey.road)}, ` +
      `at a fixed price for the whole vehicle.`,
    alternates: { canonical: `${SITE.url}/destinations/${slug}` },
  };
}

export default async function DestinationPage({ params }: PageProps) {
  const { slug } = await params;
  const destination = findDestination(slug);
  if (!destination) notFound();

  const name = nodeLabel(destination.node);
  const nearest = destination.arrivals[0];
  const company = getCompanyInfo();

  // Legs already published that touch this place, so a reader planning a
  // circuit can carry on rather than starting again from the homepage.
  const onward = LEGS.filter(
    (leg) => leg.a.slug === slug || leg.b.slug === slug,
  ).slice(0, 12);

  const gravel = destination.arrivals.some((a) => a.journey.hasGravel);

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-6">
            <Link
              href="/destinations"
              className="text-muted-foreground hover:text-foreground focus-ring rounded-sm text-sm underline-offset-4 hover:underline"
            >
              ← Every destination we price
            </Link>
          </nav>

          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-pretty sm:text-4xl">
            Getting to {name}
          </h1>

          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed text-pretty">
            {formatDuration(nearest.journey.road.minutes)} from{" "}
            {nodeLabel(nearest.from)} on {describeRoads(nearest.journey.road)},{" "}
            {Math.round(nearest.journey.road.km)} km
            {nearest.journey.hasGravel
              ? `, of which ${Math.round(nearest.journey.road.gravelKm)} km is gravel`
              : ", all of it tarred"}
            . Every price below buys the whole vehicle rather than a seat, and
            is fixed before you book — the return is priced beside it, because
            the two directions are rarely the same number.
          </p>

          {/* ------------------------------------------------- the gate */}
          {destination.gate && (
            <div className="border-warning/40 bg-warning/10 mt-6 flex gap-3 rounded-xl border p-4">
              <SunsetIcon
                className="text-warning mt-0.5 size-5 shrink-0"
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-pretty">
                <span className="font-medium">
                  {destination.gate.gate} shuts at sunset
                </span>{" "}
                — and sunset here moves by more than an hour across the year.
                A drive that is comfortable in December is a locked gate in
                June, which is why we work the departure back from the gate
                rather than from the clock.{" "}
                <Link
                  href="/methodology"
                  className="focus-ring rounded-sm underline underline-offset-4"
                >
                  How we compute it
                </Link>
                .
              </p>
            </div>
          )}

          {/* --------------------------------------------- the approaches */}
          <section aria-labelledby="arrivals" className="mt-10">
            <h2 id="arrivals" className="text-xl font-semibold tracking-tight">
              What it costs to get here
            </h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Priced from each place a trip realistically starts. Nearest
              first.
            </p>

            <ul className="mt-5 grid gap-3">
              {destination.arrivals.map((arrival) => (
                <ArrivalCard
                  key={arrival.from.slug}
                  arrival={arrival}
                  destination={destination}
                />
              ))}
            </ul>
          </section>

          {/* ------------------------------------------------- the map */}
          <div className="mt-8">
            <RouteMap route={nearest.journey.route} />
          </div>

          {/* ------------------------------------------------- the lodge */}
          <section
            aria-labelledby="lodge"
            className="border-brand bg-card mt-10 border-l-2 py-1 pl-5"
          >
            <h2 id="lodge" className="text-lg font-semibold tracking-tight">
              Staying at a lodge near {name}?
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed text-pretty">
              Most people are going to a property rather than to the town, and
              the last stretch is often gravel that no map app times properly.
              The prices above are to {name} itself. Send us the lodge and we
              price the door, not the nearest signpost — we would rather ask
              than publish a guess at somebody else&rsquo;s driveway.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {company.whatsapp && (
                <Button asChild className="press h-11">
                  <a
                    href={whatsappLink(
                      company.whatsapp,
                      `Hi — I am staying near ${name} and would like a transfer priced. The lodge is `,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Send us the lodge on WhatsApp
                    <ArrowRightIcon className="size-4" aria-hidden />
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" className="press h-11">
                <Link href={`/journey?to=${destination.slug}`}>
                  Price it from anywhere else
                </Link>
              </Button>
            </div>
          </section>

          {/* ------------------------------------------------ onward legs */}
          {onward.length > 0 && (
            <section aria-labelledby="onward" className="mt-12">
              <h2 id="onward" className="text-xl font-semibold tracking-tight">
                Where people go next
              </h2>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Each of these is a drive we have measured, with the roads, the
                surface and the time on it.
              </p>

              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {onward.map((leg) => {
                  const other = leg.a.slug === slug ? leg.b : leg.a;
                  return (
                    <li key={leg.slug}>
                      <Link
                        href={`/drive/${leg.slug}`}
                        className="press bg-card hover:border-foreground/25 focus-ring flex items-center gap-3 rounded-xl border p-3.5 transition-colors"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {name} → {nodeLabel(other)}
                        </span>
                        <ArrowRightIcon
                          className="text-muted-foreground size-4 shrink-0"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {gravel && (
            <p className="text-muted-foreground mt-10 max-w-2xl text-sm leading-relaxed text-pretty">
              There is gravel on the way in.{" "}
              <Link
                href="/self-drive"
                className="focus-ring rounded-sm underline underline-offset-4"
              >
                Whether to drive it yourself
              </Link>{" "}
              is a real question here, and the honest answer depends on the
              excess on your hire agreement rather than on the road.
            </p>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function ArrivalCard({
  arrival,
  destination,
}: {
  arrival: Arrival;
  destination: Destination;
}) {
  const { from, journey, outbound } = arrival;
  const road = journey.road;
  const via = describeVia(road);

  // The two directions are rarely the same fare: a car ending its day where
  // there is onward work is cheaper than one that drives home empty, and that
  // asymmetry is real rather than a rounding artefact.
  const back = outbound?.route.fixedPrice;
  const asymmetric = back !== undefined && back !== journey.route.fixedPrice;

  return (
    <li className="bg-card rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="font-medium">
            From {nodeLabel(from)} to {nodeLabel(destination.node)}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {Math.round(road.km)} km · {formatDuration(road.minutes)} ·{" "}
            {road.gravelKm > 0
              ? `${Math.round(road.gravelKm)} km gravel`
              : "tar all the way"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {describeRoads(road)}
            {via ? `, ${via}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="tabular text-brand text-2xl leading-none font-semibold">
            <Fare nad={journey.route.fixedPrice} block />
          </p>
          <p className="text-muted-foreground mt-1 text-xs">per vehicle</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" className="press">
          <Link href={`/journey?from=${from.slug}&to=${destination.slug}`}>
            Price this trip
          </Link>
        </Button>
        {asymmetric && (
          <p className="text-muted-foreground text-xs">
            Coming back is <Fare nad={back} bare /> — a car returning to{" "}
            {nodeLabel(from)} usually finds another fare, and one sent out here
            usually drives home empty.
          </p>
        )}
      </div>
    </li>
  );
}
