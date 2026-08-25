/**
 * Real company identity, read from the environment so nothing fabricated is
 * ever hard-coded. Every consumer must handle a channel being absent — the
 * site degrades to honest silence rather than inventing a number.
 */

export type CompanyInfo = {
  /** E.164, e.g. +264811234567. The primary support channel. */
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  /** Short one-liner, e.g. "Windhoek, Namibia". */
  location: string | null;
  registration: string | null;
  /** True once at least one real channel is published. */
  hasContactChannel: boolean;
};

/**
 * The support promise, stated precisely.
 *
 * We deliberately do NOT claim "24/7". Office-hours coordination plus
 * travel-day cover is what the operation can actually deliver today, and a
 * promise a traveller can verify is worth more than a bigger one they cannot.
 * Widen this only when an overnight desk genuinely exists.
 */
export const SUPPORT = {
  officeHours: "06:00–22:00 CAT, daily",
  travelDay: "Reachable throughout your journey, whatever the hour",
  officeHoursShort: "06:00–22:00 CAT",
} as const;

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getCompanyInfo(): CompanyInfo {
  const whatsapp = env("NEXT_PUBLIC_SUPPORT_WHATSAPP");
  const phone = env("NEXT_PUBLIC_SUPPORT_PHONE");
  const email = env("NEXT_PUBLIC_SUPPORT_EMAIL");

  return {
    whatsapp,
    phone,
    email,
    location: env("NEXT_PUBLIC_COMPANY_LOCATION") ?? "Windhoek, Namibia",
    registration: env("NEXT_PUBLIC_COMPANY_REGISTRATION"),
    hasContactChannel: Boolean(whatsapp || phone || email),
  };
}

/** wa.me deep link with an optional prefilled message. */
export function whatsappLink(number: string, text?: string): string {
  const digits = number.replace(/[^\d]/g, "");
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}

/**
 * VAT is applied only once the business is registered — set QUOTE_VAT_RATE to
 * "0.15" in the environment at that point and every new quotation picks it up.
 * Existing quotes keep the rate they were issued at.
 */
export function getVatRate(): number {
  const raw = process.env.QUOTE_VAT_RATE;
  const rate = raw ? Number(raw) : 0;
  return Number.isFinite(rate) && rate > 0 && rate < 1 ? rate : 0;
}
