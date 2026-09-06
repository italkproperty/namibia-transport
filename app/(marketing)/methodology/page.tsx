import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { listRoutes } from "@/lib/maps";
import { PRICE_STEP } from "@/lib/network/fare-model";
import { PLACE_NODES } from "@/lib/network/nodes";
import { FIXED_STOP_MIN, ROAD_EDGES, SPEED_KMH } from "@/lib/network/roads";
import { SITE } from "@/lib/site";

/**
 * The page that stands behind every number on the site.
 *
 * We have no decades-in-business badge and we do not invent one. What we do
 * have is a road model whose outputs are checked against published reality by
 * an automated test suite, and this page says exactly how it works — because
 * "here is how we compute it, check us" earns more trust than any claim we
 * could make about ourselves.
 */
export const metadata: Metadata = {
  title: "How We Compute Our Numbers",
  description:
    "Every distance, surface split, driving time and fare on this site comes from one road network model. What it knows, the speeds it assumes, and how we verify it against published figures.",
  alternates: { canonical: "/methodology" },
};

// Counted from the model, not typed, so this page cannot lag the network.
const placeCount = PLACE_NODES.length;
const segmentCount = ROAD_EDGES.length;
const pairCount = placeCount * (placeCount - 1);

export default async function MethodologyPage() {
  const { routes: allRoutes } = await listRoutes({ activeOnly: true });

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
          <p className="text-muted-foreground text-xs font-medium">
            About our numbers
          </p>

          <h1 className="mt-3 text-2xl leading-tight sm:text-3xl">
            How we compute our numbers
          </h1>

          <p className="border-brand mt-5 border-l-2 pl-4 text-base leading-relaxed text-pretty">
            Every distance, surface split, driving time and fare on this site
            comes from one road network model, checked by automated tests
            against published figures. Nothing is copied from a map app and
            nothing is guessed. This page says how it works, so you can judge
            the numbers rather than take our word for them.
          </p>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">The road network</h2>
            <p className="mt-3 leading-relaxed text-pretty">
              We model Namibia&apos;s roads as a network of {placeCount} places
              — towns, lodges areas, park gates and airports — joined by{" "}
              {segmentCount} road segments. Each segment carries its real
              length, its surface (tar or gravel) and the road that carries it,
              so the model can answer for any of the {pairCount.toLocaleString(
                "en-US",
              )}{" "}
              ordered pairs of places: how far, on what, and how long.
            </p>
            <p className="mt-3 leading-relaxed text-pretty">
              Routes are chosen to minimise driving <em>time</em>, not
              distance, because that is what a working driver actually chooses.
              Where a gravel shortcut is shorter but slower than the tar the
              long way round, the model takes the tar — and so do our drivers.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">
              The speeds behind every driving time
            </h2>
            <p className="mt-3 leading-relaxed text-pretty">
              We plan tar at {SPEED_KMH.tar} km/h and gravel at{" "}
              {SPEED_KMH.gravel} km/h, and add a {FIXED_STOP_MIN}-minute stop
              to every journey. These are deliberately not the speeds a map app
              assumes. They are the averages a careful driver sustains over a
              whole leg — including the slow passes, the corrugated stretches
              and the photo stop — and we tested faster gravel assumptions
              against published driving times before rejecting them: they
              predict arrivals nobody achieves.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Where fares come from</h2>
            <p className="mt-3 leading-relaxed text-pretty">
              A fare is computed from what the journey costs to drive, not
              from what we think the market will bear. The inputs: the
              vehicle&apos;s running cost per kilometre, which is higher on
              gravel than on tar; the driver&apos;s time, including nights
              away on long routes; and the likelihood of finding a paying fare
              for the return leg rather than driving home empty — which is why
              the same road can price differently in each direction. The
              result is rounded up to the next N${PRICE_STEP}, never down, so
              rounding can never push a fare below what the drive costs.
            </p>
            <p className="mt-3 leading-relaxed text-pretty">
              The fare you see when you price a journey is the fare you pay.
              Prices are computed on our servers and recorded on your booking,
              so a later price change never rewrites what you agreed to.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">How we check ourselves</h2>
            <p className="mt-3 leading-relaxed text-pretty">
              An automated test suite compares the model&apos;s output against
              independently published figures for our curated routes, on every
              change to the code: distances must agree within 8% and driving
              times within 10%, or the change is rejected. Where the model
              disagrees with a published figure inside those bounds, we leave
              the disagreement visible and investigate it rather than tuning
              it away. Last verified September 2026.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">What the model does not know</h2>
            <p className="mt-3 leading-relaxed text-pretty">
              It has no live feed of road conditions. Gravel varies with
              grading cycles and rain, and a leg that is comfortable in the
              dry season can be slow or impassable after a storm — our times
              assume dry-season conditions. The model does know which passes
              and river crossings the January-to-March rains can close, and a
              booking over one of them in those months carries a note saying
              so — but that is structural knowledge, not today&apos;s state of
              the road. Roadworks, border queues and the actual weather stay
              outside it. Where any of that matters to a specific booking, a
              person checks, and we say so rather than let a model answer a
              question it cannot.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-base font-semibold">See it work</h2>
            <p className="text-muted-foreground mt-1 text-sm text-pretty">
              Pick any two places and the model answers with the distance, the
              surface split, the honest driving time and a fixed fare.
            </p>
            <p className="mt-3">
              <Link
                href="/journey"
                className="text-brand font-medium underline underline-offset-2"
              >
                Price any journey in Namibia
              </Link>
            </p>
          </section>

          <p className="text-muted-foreground mt-8 text-xs">
            Questions about a figure on this site? Write to us and we will
            show our working —{" "}
            <Link href="/contact" className="underline underline-offset-2">
              contact {SITE.name}
            </Link>
            .
          </p>
        </article>
      </main>

      <SiteFooter routes={allRoutes} />
    </div>
  );
}
