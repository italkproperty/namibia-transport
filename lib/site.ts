/** Brand-level constants. Kept in one place so rebranding is a single edit. */
export const SITE = {
  name: "Namibia Transport",
  tagline: "Ground transport across Namibia",
  description:
    "Fixed-price ground transport across Namibia — airport transfers, intercity journeys and corporate mobility, with professional local drivers and no meter.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
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
