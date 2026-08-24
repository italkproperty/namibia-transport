/**
 * Real company identity, read from the environment so nothing fabricated is
 * ever hard-coded. Every consumer must handle a channel being absent — the
 * site renders honestly before the numbers exist and fills in as they are
 * published in Vercel.
 */

export type CompanyInfo = {
  /** E.164, e.g. +264811234567. The primary support channel. */
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  /** Short one-liner, e.g. "Windhoek, Namibia". */
  location: string | null;
  registration: string | null;
  hours: string;
};

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getCompanyInfo(): CompanyInfo {
  return {
    whatsapp: env("NEXT_PUBLIC_SUPPORT_WHATSAPP"),
    phone: env("NEXT_PUBLIC_SUPPORT_PHONE"),
    email: env("NEXT_PUBLIC_SUPPORT_EMAIL"),
    location: env("NEXT_PUBLIC_COMPANY_LOCATION") ?? "Windhoek, Namibia",
    registration: env("NEXT_PUBLIC_COMPANY_REGISTRATION"),
    hours: "Operations support 06:00–22:00 CAT · after-hours line for travel-day emergencies",
  };
}

/** wa.me deep link with an optional prefilled message. */
export function whatsappLink(number: string, text?: string): string {
  const digits = number.replace(/[^\d]/g, "");
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}

/**
 * VAT is applied only once the business is registered — flip
 * QUOTE_VAT_RATE to "0.15" in the environment at that point and every new
 * quotation picks it up. Existing quotes keep the rate they were issued at.
 */
export function getVatRate(): number {
  const raw = process.env.QUOTE_VAT_RATE;
  const rate = raw ? Number(raw) : 0;
  return Number.isFinite(rate) && rate > 0 && rate < 1 ? rate : 0;
}
