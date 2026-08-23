/** Brand-level constants. Kept in one place so rebranding is a single edit. */
export const SITE = {
  name: "Namibia Transport",
  tagline: "Private transfers across Namibia",
  description:
    "Fixed-price private transfers across Namibia — airport pickups, coastal runs and intercity drives, with licensed local drivers and no meter.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
} as const;

/** What every transfer includes, quoted on the home page and route pages. */
export const INCLUSIONS = [
  {
    title: "One fixed price",
    body: "Quoted per vehicle before you book. No meter, no surge, no airport surcharge.",
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
    title: "Licensed local drivers",
    body: "Vetted Namibian partner drivers with valid permits and insured vehicles.",
  },
  {
    title: "Reachable around the clock",
    body: "A real person on WhatsApp before, during and after the trip.",
  },
] as const;
