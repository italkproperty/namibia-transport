import { getCompanyInfo } from "@/lib/company";
import { SITE } from "@/lib/site";

/**
 * Organization data for the whole site — what ties these pages to the same
 * business as the Google Business Profile, and what search engines read for a
 * knowledge panel.
 *
 * Deliberately Organization rather than LocalBusiness: LocalBusiness expects a
 * postal address and opening hours, and we have neither a walk-in address nor
 * round-the-clock cover. Claiming them in markup would be the same fabrication
 * we refuse in visible copy, and structured data is exactly where an unearned
 * claim gets taken literally.
 */
export function SiteSchema() {
  const company = getCompanyInfo();

  const contactPoint = [
    company.whatsapp && {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: company.whatsapp,
      areaServed: "NA",
      availableLanguage: ["en"],
    },
    company.email && {
      "@type": "ContactPoint",
      contactType: "reservations",
      email: company.email,
      areaServed: "NA",
    },
  ].filter(Boolean);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    areaServed: { "@type": "Country", name: "Namibia" },
    knowsLanguage: ["en"],
    ...(contactPoint.length > 0 ? { contactPoint } : {}),
    ...(company.registration
      ? { identifier: company.registration }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
