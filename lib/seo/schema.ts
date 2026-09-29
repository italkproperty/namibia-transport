import { SITE } from "@/lib/site";

/**
 * The structured data every page set shares, in one place.
 *
 * It was scattered: route pages emitted Service, Offer and FAQPage; guides
 * emitted Article and FAQPage; the 160 leg pages emitted FAQPage alone
 * despite each carrying a fixed, modelled fare; and the 24 destination pages
 * emitted nothing at all. So the two page sets that answer a traveller's
 * actual question were the two Google could read least about.
 *
 * No page had a BreadcrumbList. On a site of 215 URLs with a real hierarchy —
 * a pair page under /drive, a place page under /destinations — that is the
 * cheapest structural signal available and the one that changes how a result
 * renders: Google prints the trail instead of the raw URL.
 *
 * Written here rather than per page because a schema typed twice is a schema
 * that disagrees with itself, and the version Google happens to crawl is the
 * one that counts.
 */

export type Crumb = { name: string; path: string };

/**
 * The trail from the homepage down to this page.
 *
 * The page itself is the last crumb and carries its own URL: Google's
 * guidance is that the final item may be the current page, and omitting it
 * produces a trail that stops one level short of where the reader is.
 */
export function breadcrumbSchema(trail: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...trail].map(
      (crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: `${SITE.url}${crumb.path}`,
      }),
    ),
  };
}

/**
 * A priced transfer, as a service somebody can buy.
 *
 * `priceCurrency` is always NAD, because that is what is charged — a
 * conversion shown beside the fare is guidance and must never reach markup,
 * where it would be read as the amount due.
 *
 * `priceValidUntil` is deliberately absent. A fare is held for the life of
 * the quote it is struck on, not until a date printed on a public page, and
 * an expiry in markup that the booking flow does not enforce is a promise
 * nobody is keeping.
 */
export function transferServiceSchema({
  name,
  description,
  price,
  path,
  originName,
  destinationName,
}: {
  name: string;
  description: string;
  /** Decimal string, exactly as stored. Never a float. */
  price: string;
  path: string;
  originName: string;
  destinationName: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SITE.url}${path}#service`,
    name,
    description,
    serviceType: "Private ground transfer",
    provider: { "@id": `${SITE.url}/#organization` },
    areaServed: { "@type": "Country", name: "Namibia" },
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "NAD",
      url: `${SITE.url}${path}`,
      availability: "https://schema.org/InStock",
      // The fare buys the vehicle, not a seat. Stated here because a price
      // with no unit is read as per person, which is how this market is
      // normally quoted and exactly what we are not doing.
      description: `${name} — one fixed price for the whole vehicle, ${originName} to ${destinationName}.`,
    },
  };
}
