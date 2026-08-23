/** Brand-level constants. Kept in one place so rebranding is a single edit. */
export const SITE = {
  name: "Namibia Transport",
  description:
    "Private airport transfers in Namibia. Fixed prices, meet & greet, and licensed local drivers — booked online in under a minute.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
} as const;
