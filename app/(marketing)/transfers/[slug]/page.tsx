import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon } from "lucide-react";

import { RouteQuote } from "@/components/booking/route-quote";
import { FleetSection } from "@/components/marketing/fleet";
import { RouteMap } from "@/components/marketing/route-map";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { formatDistance, formatDuration } from "@/lib/format";
import {
  getRouteBySlug,
  listRoutes,
  listVehicleClasses,
  withRouteGeometry,
} from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { routeFaqs, routeTitle } from "@/lib/route-content";
import { GUIDES } from "@/lib/guides";
import { INCLUSIONS, SITE } from "@/lib/site";

type PageProps = { params: Promise<{ slug: string }> };

/** Only active routes get a page; hidden ones 404 until they are switched on. */
export async function generateStaticParams() {
  const { routes } = await listRoutes({ activeOnly: true });
  return routes.map((route) => ({ slug: route.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = await getRouteBySlug(slug);

  if (!route || !route.isActive) {
    return { title: "Transfer not found", robots: { index: false } };
  }

  const title = route.seoTitle ?? `${routeTitle(route)} Transfer`;
  const description =
    route.seoDescription ??
    `Book a private, fixed-price transfer from ${route.originLabel} to ${route.destinationLabel}.`;
  const url = `${SITE.url}/transfers/${route.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: SITE.name,
      locale: "en_NA",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RoutePage({ params }: PageProps) {
  const { slug } = await params;
  const bare = await getRouteBySlug(slug);
  const route = bare ? await withRouteGeometry(bare) : null;

  if (!route || !route.isActive) {
    notFound();
  }

  const [{ routes: allRoutes }, vehicleClasses] = await Promise.all([
    listRoutes({ activeOnly: true }),
    listVehicleClasses(),
  ]);

  const faqs = routeFaqs(route);
  const duration = formatDuration(route.durationMin);
  const distance = formatDistance(route.distanceKm);
  const title = routeTitle(route);
  const otherRoutes = allRoutes.filter((r) => r.id !== route.id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${title} private transfer`,
    serviceType: "Airport and intercity ground transfer",
    description:
      route.seoDescription ??
      `Private fixed-price transfer from ${route.originLabel} to ${route.destinationLabel}.`,
    provider: { "@type": "Organization", name: SITE.name, url: SITE.url },
    areaServed: { "@type": "Country", name: "Namibia" },
    offers: {
      "@type": "Offer",
      price: Number(route.fixedPrice).toFixed(2),
      priceCurrency: route.currency,
      availability: "https://schema.org/InStock",
      url: `${SITE.url}/transfers/${route.slug}`,
    },
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="flex min-h-svh flex-col">
      <script
        type="application/ld+json"
        // Server-rendered from our own data — no user input reaches this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {/* Title and the booking control share the first screen. */}
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
            <div className="min-w-0">
              <nav
                aria-label="Breadcrumb"
                className="text-muted-foreground text-xs"
              >
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
                <span aria-hidden> / </span>
                <span className="text-foreground">{title}</span>
              </nav>

              <h1 className="mt-2 text-2xl sm:text-3xl">{title}</h1>

              <p className="text-muted-foreground mt-1.5 text-sm">
                {[distance, duration && `about ${duration}`, "private vehicle"]
                  .filter(Boolean)
                  .join(" · ")}
                {" · from "}
                <span className="text-brand font-semibold">
                  {formatNad(route.fixedPrice)}
                </span>
              </p>

              {route.seoBody && (
                <p className="mt-4 leading-relaxed text-pretty">
                  {route.seoBody}
                </p>
              )}

              <RelatedGuides slug={route.slug} />

              {/* Renders nothing without a Mapbox token or coordinates. */}
              <div className="mt-6 empty:mt-0">
                <RouteMap route={route} />
              </div>

              {/* -------------------------------------------- inclusions */}
              <section aria-labelledby="included-heading" className="mt-8">
                <h2 id="included-heading" className="text-base font-semibold">
                  What&rsquo;s included
                </h2>
                <ul className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {INCLUSIONS.map((item) => (
                    <li key={item.title} className="flex gap-2.5">
                      <CheckIcon
                        className="text-brand mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
                          {item.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* --------------------------------------------- the cars */}
              <div className="mt-8">
                <FleetSection
                  vehicleClasses={vehicleClasses}
                  headingId="route-fleet-heading"
                />
              </div>

              {/* --------------------------------------------------- faq */}
              <section aria-labelledby="faq-heading" className="mt-8">
                <h2 id="faq-heading" className="text-base font-semibold">
                  Frequently asked
                </h2>
                <dl className="mt-3 divide-y">
                  {faqs.map((faq) => (
                    <div key={faq.question} className="py-3">
                      <dt className="text-sm font-medium text-pretty">
                        {faq.question}
                      </dt>
                      <dd className="text-muted-foreground mt-1 text-sm leading-snug text-pretty">
                        {faq.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* ------------------------------------------ other routes */}
              {otherRoutes.length > 0 && (
                <section aria-labelledby="other-heading" className="mt-8">
                  <h2 id="other-heading" className="text-base font-semibold">
                    Other routes
                  </h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {otherRoutes.map((other) => (
                      <li key={other.id}>
                        <Link
                          href={`/transfers/${other.slug}`}
                          className="press bg-card hover:border-foreground/25 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                        >
                          {routeTitle(other)}
                          <span className="tabular text-brand font-semibold">
                            {formatNad(other.fixedPrice)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Order-first on mobile so price and CTA precede the copy. */}
            <div className="order-first lg:order-last">
              {vehicleClasses.length > 0 && (
                <RouteQuote route={route} vehicleClasses={vehicleClasses} />
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter routes={allRoutes} />
    </div>
  );
}

/** Sends a researching traveller to the planning page for this journey. */
function RelatedGuides({ slug }: { slug: string }) {
  const guides = GUIDES.filter((guide) => guide.routes.includes(slug));
  if (guides.length === 0) return null;

  return (
    <section aria-labelledby="guides-heading" className="mt-6">
      <h2 id="guides-heading" className="text-sm font-medium">
        Planning this trip
      </h2>
      <ul className="mt-2 grid gap-1.5">
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link
              href={`/guides/${guide.slug}`}
              className="text-sm underline underline-offset-2"
            >
              {guide.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
