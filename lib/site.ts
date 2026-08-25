/**
 * The canonical origin, used for metadata, the sitemap, and the URL PayToday
 * returns travellers to after checkout.
 *
 * NEXT_PUBLIC_SITE_URL wins when set, because a custom domain is a decision,
 * not something to infer. Failing that we take what Vercel already knows:
 * the project's production domain in production, and the deployment's own URL
 * on a preview — so a preview links to itself rather than to production, and
 * a forgotten variable degrades to the right host instead of to localhost.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelHost =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;

  return vercelHost ? `https://${vercelHost}` : "http://localhost:3000";
}

/** Brand-level constants. Kept in one place so rebranding is a single edit. */
export const SITE = {
  name: "Namibia Transport",
  tagline: "Ground transport across Namibia",
  description:
    "Fixed-price ground transport across Namibia — airport transfers, intercity journeys and corporate mobility, with professional local drivers and no meter.",
  url: resolveSiteUrl(),
  supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
} as const;

/** What every transfer includes, quoted on the home page and route pages. */
export const INCLUSIONS = [
  {
    title: "One fixed price",
    body: "Quoted in full before you book. No meter, no surge, no airport surcharge.",
  },
  {
    title: "Meet & greet",
    body: "Your driver waits inside arrivals with a name board and helps with luggage.",
  },
  {
    title: "Flight monitoring",
    body: "We track your inbound flight and adjust the pickup when it moves.",
  },
  {
    title: "Professional local drivers",
    body: "Vetted Namibian partner drivers who know the roads they drive.",
  },
  {
    title: "One number, start to finish",
    body: "Quote your reference and we can see your trip, your driver and your flight — one message settles it.",
  },
] as const;
