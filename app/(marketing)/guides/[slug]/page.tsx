import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { RouteMap } from "@/components/marketing/route-map";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { formatDuration, shortPlace } from "@/lib/format";
import { GUIDES, GUIDES_BY_SLUG } from "@/lib/guides";
import { getRouteBySlug, listRoutes } from "@/lib/maps";
import { formatNad } from "@/lib/money";
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

  const { routes: allRoutes } = await listRoutes({ activeOnly: true });

  // The question and its short answer, so a snippet can quote it directly.
  const schema = {
    "@context": "https://schema.org",
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

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
          <p className="text-muted-foreground text-xs font-medium">
            <Link href="/transfers" className="underline underline-offset-2">
              Transfers
            </Link>
            {" · Planning your arrival"}
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
            </section>
          ))}

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

          <p className="text-muted-foreground mt-8 text-xs">
            Last reviewed {guide.updated}.
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
