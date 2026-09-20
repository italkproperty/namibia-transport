import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { RouteMap } from "@/components/marketing/route-map";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { formatDuration } from "@/lib/format";
import { listRoutes } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { modelJourney, type Journey } from "@/lib/network/journey";
import { findLeg, LEGS, type Leg } from "@/lib/network/legs";
import { describeRoads, describeVia } from "@/lib/network/roads";
import { GATE_RULES } from "@/lib/parks/gates";
import { SITE } from "@/lib/site";

/**
 * One page per leg people actually drive.
 *
 * The question behind this page — "how far is Sossusvlei from Swakopmund, and
 * how long does it really take" — is typed thousands of times and answered
 * badly everywhere. Map apps give a time nobody achieves on that gravel. Tour
 * operators give a paragraph. We can give the roads by number, the surface
 * split to the kilometre, a driving time at speeds a careful driver sustains,
 * the passes that close when it rains, the park gate deadline at the far end,
 * and a fixed price for handing the whole thing to a driver — all computed,
 * none of it typed, and none of it copyable by someone without the model.
 *
 * `lib/network/legs.ts` decides which legs get a page and why. The short
 * version: both ends must be places people plan around, the drive must fit in
 * a day, and it must not already have a curated transfer page to compete with.
 */

type PageProps = { params: Promise<{ leg: string }> };

export function generateStaticParams() {
  return LEGS.map((leg) => ({ leg: leg.slug }));
}

/** Both directions of one leg. They are not the same price — see below. */
function bothWays(leg: Leg): { out: Journey; back: Journey } | null {
  const out = modelJourney(leg.a.slug, leg.b.slug);
  const back = modelJourney(leg.b.slug, leg.a.slug);
  return out && back ? { out, back } : null;
}

function name(node: { name: string; shortName?: string }): string {
  return node.shortName ?? node.name;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { leg: slug } = await params;
  const leg = findLeg(slug);
  const ways = leg ? bothWays(leg) : null;
  if (!leg || !ways) {
    return { title: "Leg not found", robots: { index: false } };
  }

  const { road } = ways.out;
  const a = name(leg.a);
  const b = name(leg.b);
  const surface =
    road.gravelKm === 0
      ? "tar the whole way"
      : `${Math.round((road.gravelKm / road.km) * 100)}% gravel`;

  return {
    title: `${a} to ${b}: distance, driving time and transfer price`,
    description:
      `${road.km} km and about ${formatDuration(road.minutes)} — ${surface}, on the ${road.roads.join(", ")}. Honest driving time, what closes in the rains, and a fixed price to be driven it.`.slice(
        0,
        160,
      ),
    alternates: { canonical: `${SITE.url}/drive/${leg.slug}` },
    openGraph: {
      title: `Driving ${a} to ${b}`,
      url: `${SITE.url}/drive/${leg.slug}`,
      type: "article",
    },
  };
}

export default async function LegPage({ params }: PageProps) {
  const { leg: slug } = await params;
  const leg = findLeg(slug);
  if (!leg) notFound();

  const ways = bothWays(leg);
  if (!ways) notFound();

  const { out, back } = ways;
  const road = out.road;
  const a = name(leg.a);
  const b = name(leg.b);

  const { routes: allRoutes } = await listRoutes({ activeOnly: true });

  const gravelShare = Math.round((road.gravelKm / road.km) * 100);
  const via = describeVia(road, 3);

  // A gate at either end makes the far end of this drive a deadline rather
  // than an address.
  const gate = GATE_RULES[leg.b.slug] ?? GATE_RULES[leg.a.slug] ?? null;
  const gateEnd = GATE_RULES[leg.b.slug] ? b : a;

  // The price gap between directions is not a rounding artefact. A car ending
  // its day at a hub can be sold cheaply; one sent out to a remote place has
  // to come home empty, and that is in the fare.
  const outPrice = Number(out.route.fixedPrice);
  const backPrice = Number(back.route.fixedPrice);
  const cheaper = outPrice <= backPrice ? out : back;
  const dearer = outPrice <= backPrice ? back : out;
  const gap = Math.abs(outPrice - backPrice);
  const asymmetric = gap >= 200;

  const vehicle =
    road.gravelKm === 0
      ? "Any car does this leg."
      : road.gravelKm <= 120
        ? "High clearance is wise on the gravel section, though a careful driver in a normal car manages it in the dry."
        : "High clearance is essential here — this is most of a day on gravel, and it is where hire cars get damaged.";

  // Legs sharing an end, so the page is a junction in a network rather than a
  // dead end. This is what turns 160 pages into something a reader moves
  // through instead of bouncing off.
  const neighbours = LEGS.filter(
    (other) =>
      other.slug !== leg.slug &&
      (other.a.slug === leg.a.slug ||
        other.b.slug === leg.a.slug ||
        other.a.slug === leg.b.slug ||
        other.b.slug === leg.b.slug),
  ).slice(0, 8);

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How far is ${a} to ${b}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${road.km} km by road, on ${describeRoads(road)}${via ? `, ${via}` : ""}.`,
        },
      },
      {
        "@type": "Question",
        name: `How long does it take to drive from ${a} to ${b}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `About ${formatDuration(road.minutes)}, computed at 100 km/h on tar and 65 km/h on gravel with a rest stop included. ${road.gravelKm === 0 ? "The whole route is tar." : `${road.gravelKm} km of it is gravel.`}`,
        },
      },
      {
        "@type": "Question",
        name: `What does a private transfer from ${a} to ${b} cost?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${formatNad(out.route.fixedPrice)} for the whole vehicle, fixed before you book.`,
        },
      },
    ],
  };

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
          <p className="text-muted-foreground text-xs font-medium">
            <Link href="/journey" className="underline underline-offset-2">
              Any journey
            </Link>
            {" · Driving Namibia"}
          </p>

          <h1 className="mt-3 text-2xl leading-tight sm:text-3xl">
            Driving {a} to {b}
          </h1>

          <p className="border-brand mt-5 border-l-2 pl-4 text-base leading-relaxed text-pretty">
            {road.km} km and about {formatDuration(road.minutes)} on the{" "}
            {describeRoads(road).replace(/^the /, "")}
            {via ? `, ${via}` : ""}.{" "}
            {road.gravelKm === 0
              ? "It is tar the whole way."
              : `${road.gravelKm} km of that is gravel — ${gravelShare}% of the drive — which is why it takes longer than the distance suggests.`}
          </p>

          <div className="mt-6">
            <RouteMap route={out.route} />
          </div>

          {/* ------------------------------------------------- the road */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold">What the road is like</h2>
            <dl className="bg-card mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border p-4 sm:grid-cols-4">
              {[
                { term: "Distance", value: `${road.km} km` },
                { term: "Driving time", value: formatDuration(road.minutes) },
                {
                  term: "On gravel",
                  value: road.gravelKm === 0 ? "None" : `${road.gravelKm} km`,
                },
                { term: "Roads", value: road.roads.join(" · ") },
              ].map((item) => (
                <div key={item.term}>
                  <dt className="text-muted-foreground text-xs">{item.term}</dt>
                  <dd className="tabular mt-0.5 font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 leading-relaxed text-pretty">{vehicle}</p>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
              The time above is not a map-app estimate. It is computed at 100
              km/h on tar and 65 km/h on gravel with a rest stop included — the
              speeds a careful driver actually sustains over a whole leg,{" "}
              <Link
                href="/methodology"
                className="underline underline-offset-2"
              >
                tested against published driving times
              </Link>
              .
            </p>
          </section>

          {/* --------------------------------------------- the gate deadline */}
          {gate && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">
                This drive ends at a gate that closes
              </h2>
              <p className="mt-3 leading-relaxed text-pretty">
                {gateEnd} is reached through {gate.gate}, and Namibian park
                gates close at sunset rather than on a clock — arrive after it
                and you stay outside. With {formatDuration(road.minutes)} of
                driving, that puts a hard deadline on when you can set off, and
                in midwinter it is earlier than most people expect.
              </p>
              <p className="mt-3 text-sm">
                <Link
                  href="/guides/namibia-park-gate-times-and-sunset"
                  className="text-brand font-medium underline underline-offset-2"
                >
                  The departure deadline for every park gate, by season
                </Link>
              </p>
            </section>
          )}

          {/* ------------------------------------------------ rain closures */}
          {road.rainNotes.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">
                What the rains can close on this route
              </h2>
              <ul className="mt-3 grid gap-2">
                {road.rainNotes.map((note) => (
                  <li
                    key={note}
                    className="border-brand border-l-2 pl-4 leading-relaxed text-pretty"
                  >
                    {note.charAt(0).toUpperCase() + note.slice(1)}.
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
                These are on the specific segments this route crosses, not a
                general warning about the country. They matter between about
                January and April, and a crossing reached in the morning is
                rarely the problem the same crossing is at five in the
                afternoon.{" "}
                <Link
                  href="/guides/driving-namibia-in-the-rainy-season"
                  className="underline underline-offset-2"
                >
                  How to plan around them
                </Link>
                .
              </p>
            </section>
          )}

          {/* -------------------------------------------------- the price */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold">
              What it costs to be driven
            </h2>
            <p className="mt-3 leading-relaxed text-pretty">
              A fixed price for the whole vehicle — the same whether one of you
              travels or the car is full — agreed before you commit.
            </p>

            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {[out, back].map((journey) => (
                <li key={journey.route.slug}>
                  <Link
                    href={`/journey?from=${journey.road.origin.slug}&to=${journey.road.destination.slug}`}
                    className="press bg-card hover:border-foreground/25 block h-full rounded-xl border p-4"
                  >
                    <span className="block text-sm leading-snug font-medium">
                      {name(journey.road.origin)} →{" "}
                      {name(journey.road.destination)}
                    </span>
                    <span className="tabular text-brand mt-1 block text-xl font-semibold">
                      {formatNad(journey.route.fixedPrice)}
                      <span className="text-muted-foreground text-xs font-normal">
                        {" "}
                        per vehicle
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {asymmetric && (
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
                The two directions are not the same price, and the{" "}
                {formatNad(gap.toFixed(2))} between them is real rather than a
                rounding artefact. A car finishing its day at{" "}
                {name(cheaper.road.destination)} can pick up another fare; one
                sent out to {name(dearer.road.destination)} usually drives home
                empty, and that empty return is in the fare. If your itinerary
                can run this leg in the {name(cheaper.road.origin)}-to-
                {name(cheaper.road.destination)} direction, it is the cheaper
                way round.
              </p>
            )}
          </section>

          {/* ------------------------------------------ drive it or not */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Worth driving yourself?</h2>
            <p className="mt-3 leading-relaxed text-pretty">
              {road.gravelKm === 0
                ? `Honestly, yes — this one is tar the whole way and ${formatDuration(road.minutes)} is a comfortable morning. Hire a car and enjoy it.`
                : road.minutes >= 5 * 60
                  ? `This is a long one: ${formatDuration(road.minutes)} with ${road.gravelKm} km of gravel in it, which is most of a day and all of your concentration. It is the kind of leg people hand over — not because they cannot drive it, but because arriving with the afternoon still intact is worth more than the saving.`
                  : `It is a manageable drive if you are comfortable on gravel — ${formatDuration(road.minutes)}, with ${road.gravelKm} km unsealed. The question is whether you would rather be looking at it than managing it.`}
            </p>
            <p className="mt-3 text-sm">
              <Link
                href="/self-drive"
                className="text-brand font-medium underline underline-offset-2"
              >
                Compare the real cost of hiring a car against being driven
              </Link>
            </p>
          </section>

          {/* ------------------------------------------------- neighbours */}
          {neighbours.length > 0 && (
            <section aria-labelledby="near-heading" className="mt-10">
              <h2 id="near-heading" className="text-base font-semibold">
                Legs that join this one
              </h2>
              <ul className="mt-3 divide-y border-t border-b">
                {neighbours.map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={`/drive/${other.slug}`}
                      className="hover:bg-card focus-ring group -mx-3 flex items-center justify-between gap-4 rounded-md px-3 py-3 transition-colors"
                    >
                      <span className="text-sm font-medium">
                        {name(other.a)} to {name(other.b)}
                      </span>
                      <ArrowRightIcon
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-muted-foreground mt-10 border-t pt-6 text-xs leading-relaxed text-pretty">
            Every figure on this page is computed from our road network model —
            the length and surface of each segment this route crosses — rather
            than copied from a map app.{" "}
            <Link href="/methodology" className="underline underline-offset-2">
              How we compute our numbers
            </Link>
            .
          </p>
        </article>
      </main>

      <SiteFooter routes={allRoutes} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </div>
  );
}
