import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon } from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistance, formatDuration } from "@/lib/format";
import { getRouteBySlug, listRoutes } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { routeFaqs, routeTitle } from "@/lib/route-content";
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
  const route = await getRouteBySlug(slug);

  if (!route || !route.isActive) {
    notFound();
  }

  const [{ routes: allRoutes }, faqs] = [
    await listRoutes({ activeOnly: true }),
    routeFaqs(route),
  ];

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
    provider: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
    },
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
        {/* ------------------------------------------------------------ hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="from-accent/50 pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b via-transparent to-transparent"
          />
          <div className="mx-auto max-w-6xl px-5 pt-14 pb-14 sm:px-8 sm:pt-20">
            <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
              <Link href="/" className="hover:text-foreground transition">
                Home
              </Link>
              <span aria-hidden> / </span>
              <span className="text-foreground">{title}</span>
            </nav>

            <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_20rem]">
              <div>
                <h1 className="font-display max-w-2xl text-[2.5rem] leading-[1.08] text-balance sm:text-5xl lg:text-6xl">
                  {title}
                </h1>

                <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  {distance && <span>{distance}</span>}
                  {distance && duration && <span aria-hidden>·</span>}
                  {duration && <span>about {duration}</span>}
                  <Badge variant="secondary">Private vehicle</Badge>
                </div>

                {route.seoBody && (
                  <p className="mt-8 max-w-2xl text-lg leading-relaxed text-pretty">
                    {route.seoBody}
                  </p>
                )}
              </div>

              {/* ------------------------------------------------ price card */}
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <div className="border-border/70 bg-card rounded-2xl border p-6 shadow-[0_2px_24px_-12px_oklch(0_0_0/0.18)]">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">
                    Fixed price
                  </p>
                  <p className="tabular mt-2 text-4xl font-semibold tracking-tight">
                    {formatNad(route.fixedPrice)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    per vehicle · up to 3 passengers
                  </p>

                  <Button asChild size="lg" className="mt-6 w-full">
                    <Link href={`/book?route=${route.slug}`}>
                      Book this transfer
                    </Link>
                  </Button>

                  <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
                    No payment taken now. We confirm on WhatsApp and send
                    payment details before your travel date.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- inclusions */}
        <section
          aria-labelledby="included-heading"
          className="border-border/60 border-t"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 id="included-heading" className="font-display text-3xl">
              What&rsquo;s included
            </h2>
            <ul className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {INCLUSIONS.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <CheckIcon
                    className="text-brand mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  <div>
                    <p className="font-medium tracking-tight">{item.title}</p>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------------------- faq */}
        <section
          aria-labelledby="faq-heading"
          className="border-border/60 border-t"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 id="faq-heading" className="font-display text-3xl">
              Frequently asked
            </h2>
            <dl className="divide-border/60 mt-8 max-w-3xl divide-y">
              {faqs.map((faq) => (
                <div key={faq.question} className="py-6">
                  <dt className="font-medium tracking-tight text-pretty">
                    {faq.question}
                  </dt>
                  <dd className="text-muted-foreground mt-2 leading-relaxed text-pretty">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ----------------------------------------------------- other routes */}
        {otherRoutes.length > 0 && (
          <section
            aria-labelledby="other-heading"
            className="border-border/60 border-t"
          >
            <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
              <h2 id="other-heading" className="font-display text-2xl">
                Other routes
              </h2>
              <ul className="mt-6 flex flex-wrap gap-3">
                {otherRoutes.map((other) => (
                  <li key={other.id}>
                    <Link
                      href={`/transfers/${other.slug}`}
                      className="border-border/70 hover:bg-accent focus-visible:ring-ring inline-flex rounded-full border px-4 py-2 text-sm transition focus-visible:ring-[3px] focus-visible:outline-none"
                    >
                      {routeTitle(other)} · {formatNad(other.fixedPrice)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>

      <SiteFooter routes={allRoutes} />
    </div>
  );
}
