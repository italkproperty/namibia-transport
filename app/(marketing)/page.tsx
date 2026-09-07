import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { HomeQuote } from "@/components/booking/home-quote";
import { RoadNetwork } from "@/components/brand/road-network";
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
import { PLACE_NODES } from "@/lib/network/nodes";
import { ROAD_EDGES } from "@/lib/network/roads";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Counted from the model rather than typed, so the hero cannot claim a network
 * larger than the one that actually prices the trips.
 */
const PROOF = [
  { figure: PLACE_NODES.length.toString(), label: "places on the network" },
  { figure: ROAD_EDGES.length.toString(), label: "road segments measured" },
  {
    figure: (PLACE_NODES.length * (PLACE_NODES.length - 1)).toLocaleString(
      "en-US",
    ),
    label: "journeys we can price",
  },
];

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

  const canQuote = routes.length > 0 && vehicleClasses.length > 0;

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        {/*
          The page used to open with a small headline on cream over an
          illustrated dune, which is a picture of the category rather than of
          us. This opens on tar, with the actual road network behind it, and
          states the claim, the proof and the action in that order — then hands
          the visitor the pricing panel, which is the only thing on the page
          they came to use.
        */}
        <section className="bg-foreground text-background relative isolate overflow-hidden">
          {/* Framed rather than bled: cropped to the edge it read as random
              static, and the whole point is that it is recognisably Namibia.
              Hidden on phones, where there is no column free of text and it
              becomes hatching across the headline rather than a map. */}
          <RoadNetwork
            tone="light"
            className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden h-full w-[min(56%,30rem)] opacity-55 sm:block lg:right-6"
          />

          <div className="mx-auto max-w-5xl px-4 pt-12 pb-28 sm:px-6 sm:pt-20 sm:pb-32">
            <p className="text-background/55 font-mono text-[0.7rem] tracking-[0.16em] uppercase">
              Airport transfers · Intercity · Corporate
            </p>

            <h1 className="mt-4 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Know who is meeting you before you land.
            </h1>

            <p className="text-background/70 mt-5 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
              Fixed prices across Namibia. Your driver waits inside arrivals
              with your name on a board, and a late landing never becomes a
              waiting fee.
            </p>

            {/* Renders only once real published reviews exist. */}
            <ReviewBadge />

            {/* The one claim a competitor cannot copy, in the one form that
                cannot be exaggerated: counted off the model, linked to the
                page that shows the working. */}
            <div className="mt-10 max-w-2xl border-t border-white/15 pt-6">
              <dl className="grid grid-cols-3 gap-4 sm:gap-8">
                {PROOF.map((item) => (
                  <div key={item.label}>
                    <dt className="sr-only">{item.label}</dt>
                    <dd>
                      {/* Not mono: Plex sets a comma in a full-width cell, so
                          "2,352" reads as "2 , 352" at display size. */}
                      <span className="tabular block text-2xl leading-none font-semibold tracking-tight sm:text-3xl">
                        {item.figure}
                      </span>
                      <span className="text-background/55 mt-1.5 block text-xs leading-snug">
                        {item.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
              <Link
                href="/methodology"
                className="text-background/70 hover:text-background focus-ring mt-5 inline-flex items-center gap-1.5 rounded-sm text-sm underline-offset-4 transition-colors hover:underline"
              >
                How we compute every figure on this site
                <ArrowRightIcon className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ the panel */}
        {/* Overlaps the hero so the price is the first thing on the light
            ground — the visitor should not have to scroll past a manifesto to
            reach the control. */}
        <div className="relative z-10 mx-auto -mt-20 max-w-5xl px-4 sm:px-6">
          {canQuote ? (
            <HomeQuote
              routes={routes}
              vehicleClasses={vehicleClasses}
              initialTrip={initialTrip}
            />
          ) : (
            <div className="bg-card shadow-raised rounded-xl border p-6 text-center">
              <p className="font-medium">Bookings are not open yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                No routes are published. Please check back shortly.
              </p>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------- reviews */}
        <ReviewsWrapper />

        {/* ----------------------------------------------------- where next */}
        {/* Three rounded cards became a ruled list. They are navigation, not
            product tiles, and giving each one a border and a shadow said they
            were three separate objects of equal weight to the panel above. */}
        <section
          aria-labelledby="elsewhere-heading"
          className="mx-auto mt-14 max-w-5xl px-4 sm:mt-20 sm:px-6"
        >
          <h2
            id="elsewhere-heading"
            className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.16em] uppercase"
          >
            Not an airport transfer
          </h2>
          <ul className="mt-1 divide-y border-t border-b">
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
                  className="hover:bg-card focus-ring group -mx-3 flex items-baseline gap-x-5 gap-y-1 rounded-md px-3 py-4 transition-colors max-sm:flex-col sm:items-center"
                >
                  <span className="text-base font-medium sm:w-64 sm:shrink-0">
                    {card.title}
                  </span>
                  <span className="text-muted-foreground min-w-0 flex-1 text-sm leading-snug">
                    {card.blurb}
                  </span>
                  <ArrowRightIcon
                    className="text-muted-foreground group-hover:text-brand size-4 shrink-0 transition-transform group-hover:translate-x-0.5 max-sm:hidden"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ----------------------------------------------------- corporate */}
        <section
          aria-labelledby="corporate-heading"
          className="mx-auto mt-14 max-w-5xl px-4 sm:mt-20 sm:px-6"
        >
          <div className="border-brand bg-card flex flex-wrap items-center justify-between gap-5 border-l-2 py-1 pl-5">
            <div className="min-w-0">
              <h2
                id="corporate-heading"
                className="text-lg font-semibold tracking-tight"
              >
                Corporate transport
              </h2>
              <p className="text-muted-foreground mt-1 max-w-lg text-sm leading-snug text-pretty">
                One account, one quotation, one monthly invoice — itemised in
                about a minute.
              </p>
            </div>

            <Button asChild variant="outline" className="press h-11 shrink-0">
              <Link href="/corporate">
                Get an instant quotation
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>

        {/* --------------------------------------------------------- support */}
        {/* SupportStrip renders nothing until a real channel is configured, and
            an empty wrapper still spent its margins — which is why a
            deployment without contact details showed 180px of blank page
            above the footer. */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 [&:has(section)]:mt-14 [&:has(section)]:pb-16 sm:[&:has(section)]:mt-20">
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
    <div className="mx-auto max-w-5xl px-4 sm:px-6 [&:has(section)]:mt-14 sm:[&:has(section)]:mt-20">
      <ReviewsSection />
    </div>
  );
}
