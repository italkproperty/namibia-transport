import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { CircuitCompare } from "@/components/marketing/circuit-compare";
import { JourneyTable } from "@/components/marketing/journey-table";
import { RouteMap } from "@/components/marketing/route-map";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { formatDuration, shortPlace } from "@/lib/format";
import { GUIDES, GUIDES_BY_SLUG } from "@/lib/guides";
import { getRouteBySlug, listRoutes } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { modelJourneyBySlug, type Journey } from "@/lib/network/journey";
import { pricingUnitLabel } from "@/lib/pricing";
import { SITE } from "@/lib/site";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = GUIDES_BY_SLUG.get(slug);
  if (!guide) return { title: "Guide not found", robots: { index: false } };

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates: { canonical: `${SITE.url}/guides/${guide.slug}` },
    openGraph: {
      title: guide.metaTitle,
      description: guide.metaDescription,
      url: `${SITE.url}/guides/${guide.slug}`,
      type: "article",
    },
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = GUIDES_BY_SLUG.get(slug);
  if (!guide) notFound();

  const routes = (
    await Promise.all(guide.routes.map((s) => getRouteBySlug(s)))
  ).filter((route) => route !== null && route.isActive);

  // Journey links are priced from the model, not the database, so a decision
  // guide still quotes correctly when the database is unreachable.
  const journeys = (guide.journeys ?? [])
    .map((slug) => ({ slug, journey: modelJourneyBySlug(slug) }))
    .filter(
      (row): row is { slug: string; journey: Journey } => row.journey !== null,
    );

  const { routes: allRoutes } = await listRoutes({ activeOnly: true });

  // The question and its short answer, so a snippet can quote it directly.
  const faqSchema = {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: guide.title,
        acceptedAnswer: { "@type": "Answer", text: guide.answer },
      },
      ...guide.sections.map((section) => ({
        "@type": "Question",
        name: section.heading,
        acceptedAnswer: {
          "@type": "Answer",
          text: section.body.join(" "),
        },
      })),
    ],
  };

  // Decision guides are articles with a date and a publisher, not just Q&A —
  // the model-derived figures are the claim to authority, and the schema
  // should say who stands behind them and when they were last checked.
  const schema =
    guide.kind === "decision"
      ? {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              headline: guide.title,
              description: guide.metaDescription,
              dateModified: guide.updated,
              author: { "@type": "Organization", name: SITE.name },
              publisher: { "@type": "Organization", name: SITE.name },
              mainEntityOfPage: `${SITE.url}/guides/${guide.slug}`,
            },
            faqSchema,
          ],
        }
      : { "@context": "https://schema.org", ...faqSchema };

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
          <p className="text-muted-foreground text-xs font-medium">
            {guide.kind === "decision" ? (
              <>
                <Link
                  href="/self-drive"
                  className="underline underline-offset-2"
                >
                  Self-drive?
                </Link>
                {" · Deciding how to travel"}
              </>
            ) : (
              <>
                <Link
                  href="/transfers"
                  className="underline underline-offset-2"
                >
                  Transfers
                </Link>
                {" · Planning your arrival"}
              </>
            )}
          </p>

          <h1 className="mt-3 text-2xl leading-tight sm:text-3xl">
            {guide.title}
          </h1>

          {/* The short answer first — most readers need nothing else. */}
          <p className="border-brand mt-5 border-l-2 pl-4 text-base leading-relaxed text-pretty">
            {guide.answer}
          </p>

          {routes[0] && (
            <div className="mt-6">
              <RouteMap route={routes[0]} />
            </div>
          )}

          {guide.sections.map((section) => (
            <section key={section.heading} className="mt-8">
              <h2 className="text-lg font-semibold">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-3 leading-relaxed text-pretty"
                >
                  {paragraph}
                </p>
              ))}
              {section.routeTable && <JourneyTable spec={section.routeTable} />}
              {section.circuitCompare && (
                <CircuitCompare presetId={section.circuitCompare.presetId} />
              )}
            </section>
          ))}

          {guide.decision && (
            <section aria-labelledby="decision-heading" className="mt-10">
              <h2 id="decision-heading" className="text-lg font-semibold">
                So: self-drive, or be driven?
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="bg-card rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">
                    Self-driving is right for you if
                  </h3>
                  <ul className="mt-2 grid gap-2">
                    {guide.decision.selfDriveIf.map((item) => (
                      <li
                        key={item.slice(0, 40)}
                        className="text-muted-foreground text-sm leading-relaxed text-pretty"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-card border-brand/40 rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">
                    Consider being driven if
                  </h3>
                  <ul className="mt-2 grid gap-2">
                    {guide.decision.drivenIf.map((item) => (
                      <li
                        key={item.slice(0, 40)}
                        className="text-muted-foreground text-sm leading-relaxed text-pretty"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm">
                    <Link
                      href="/self-drive"
                      className="text-brand font-medium underline underline-offset-2"
                    >
                      Compare the real costs side by side
                    </Link>
                  </p>
                </div>
              </div>
            </section>
          )}

          {routes.length > 0 && (
            <section aria-labelledby="book-heading" className="mt-10">
              <h2 id="book-heading" className="text-base font-semibold">
                Book this journey
              </h2>
              <ul className="mt-3 grid gap-2">
                {routes.map((route) => (
                  <li key={route!.slug}>
                    <Link
                      href={`/transfers/${route!.slug}`}
                      className="press bg-card hover:border-foreground/25 group flex items-center justify-between gap-4 rounded-xl border p-4"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {shortPlace(route!.originLabel)} →{" "}
                          {route!.destinationLabel}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-xs">
                          {formatDuration(route!.durationMin)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular text-brand text-lg font-semibold">
                          {formatNad(route!.fixedPrice)}
                          <span className="text-muted-foreground text-xs font-normal">
                            {" "}
                            {pricingUnitLabel(route!)}
                          </span>
                        </span>
                        <ArrowRightIcon className="size-4" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {journeys.length > 0 && (
            <section aria-labelledby="journeys-heading" className="mt-10">
              <h2 id="journeys-heading" className="text-base font-semibold">
                Have these legs driven for you
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Fixed prices for the whole vehicle, computed from the same road
                model as the table above.
              </p>
              <ul className="mt-3 grid gap-2">
                {journeys.map(({ journey }) => {
                  const road = journey.road;
                  return (
                    <li key={journey.route.slug}>
                      <Link
                        href={`/journey?from=${road.origin.slug}&to=${road.destination.slug}`}
                        className="press bg-card hover:border-foreground/25 group flex items-center justify-between gap-4 rounded-xl border p-4"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {road.origin.shortName ?? road.origin.name} →{" "}
                            {road.destination.shortName ?? road.destination.name}
                          </span>
                          <span className="text-muted-foreground mt-0.5 block text-xs">
                            {road.km} km · {formatDuration(road.minutes)}
                            {journey.hasGravel ? " · part gravel" : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="tabular text-brand text-lg font-semibold">
                            {formatNad(journey.route.fixedPrice)}
                            <span className="text-muted-foreground text-xs font-normal">
                              {" "}
                              {pricingUnitLabel(journey.route)}
                            </span>
                          </span>
                          <ArrowRightIcon className="size-4" aria-hidden />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {guide.sources && guide.sources.length > 0 && (
            <section aria-labelledby="sources-heading" className="mt-10">
              <h2
                id="sources-heading"
                className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
              >
                Sources for external figures
              </h2>
              <ul className="mt-2 grid gap-1.5">
                {guide.sources.map((source) => (
                  <li
                    key={source.label}
                    className="text-muted-foreground text-xs leading-relaxed"
                  >
                    <span className="text-foreground font-medium">
                      {source.label}.
                    </span>{" "}
                    {source.detail}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-muted-foreground mt-8 text-xs">
            Last reviewed {guide.updated}. Written by the {SITE.name} team.
            {guide.kind === "decision" && (
              <>
                {" "}
                Every route figure above is computed from our road network
                model —{" "}
                <Link
                  href="/methodology"
                  className="underline underline-offset-2"
                >
                  how we compute our numbers
                </Link>
                .
              </>
            )}
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
