import { parseMoney } from "@/lib/money";

/**
 * Showing a fare in the reader's own currency, without pretending we charge
 * in it.
 *
 * We bank in Namibian dollars. Someone paying from abroad sends a transfer and
 * their bank converts at whatever rate applies that day, which means the amount
 * owed is, and can only be, the NAD figure. So every other currency here is a
 * conversion shown *beside* the fare, never instead of it — and the NAD figure
 * stays in the rendered HTML, which also keeps the static pages static and the
 * price visible without JavaScript.
 *
 * The reason this matters is not politeness. A traveller looking at "N$6,000"
 * with no idea whether that is fifty dollars or five hundred is a lost booking,
 * and for a long time the conversion only appeared on the confirmation page —
 * after the decision it was supposed to help with.
 *
 * ## The rand is not a conversion
 *
 * The Namibian dollar is pegged at par to the South African rand under the
 * Common Monetary Area, and rand is legal tender here. N$650 *is* R650 — not
 * approximately, exactly — so that figure carries no rate, no date and no
 * hedging language. South Africa is also the largest source of visitors by
 * volume, which makes it the one conversion we can state with total confidence
 * and the one we were not showing at all.
 *
 * ## Everything else is dated
 *
 * Rates are operator-set rather than fetched. A live FX API is one more
 * dependency that can be down at the moment somebody is deciding to pay, for
 * precision an indicative figure does not need. The cost of that choice is
 * staleness, so the rate carries the date it was set and the page says it.
 */

export type CurrencyCode = "NAD" | "ZAR" | "USD" | "EUR" | "GBP";

export type Currency = {
  code: CurrencyCode;
  /** What precedes the number: "N$650", "US$36". */
  symbol: string;
  /** For the picker. */
  label: string;
  /**
   * Exact currencies need no rate and no caveat. Only the rand qualifies, and
   * only because of the peg — if that ever goes, this flag comes off and it
   * joins the dated ones.
   */
  exact?: true;
  /**
   * Plausible range of Namibian dollars per one unit. Deliberately wide but
   * finite: a misplaced decimal — 1.82 where 18.2 was meant — would quote a
   * price out by a factor of ten to every foreign traveller on the site, and
   * nothing downstream would notice.
   */
  bounds?: readonly [number, number];
  /** Environment variable holding NAD per one unit. */
  env?: string;
};

export const CURRENCIES: readonly Currency[] = [
  { code: "NAD", symbol: "N$", label: "Namibian dollar" },
  { code: "ZAR", symbol: "R", label: "South African rand", exact: true },
  { code: "USD", symbol: "US$", label: "US dollar", bounds: [5, 40], env: "USD_RATE" },
  { code: "EUR", symbol: "€", label: "Euro", bounds: [6, 45], env: "EUR_RATE" },
  { code: "GBP", symbol: "£", label: "Pound sterling", bounds: [7, 55], env: "GBP_RATE" },
] as const;

export const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && CURRENCY_BY_CODE.has(value as CurrencyCode);
}

/** Namibian dollars per one unit, for the currencies that need a rate. */
export type Rates = {
  /** Only the codes an operator has actually configured. */
  nadPer: Partial<Record<CurrencyCode, number>>;
  /** yyyy-mm-dd the operator last set them, if given. */
  asAt: string | null;
};

export const EMPTY_RATES: Rates = { nadPer: {}, asAt: null };

/** Which currencies this deployment can actually show. */
export function availableCurrencies(rates: Rates): Currency[] {
  return CURRENCIES.filter(
    (c) => !c.env || rates.nadPer[c.code] !== undefined,
  );
}

const WHOLE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * The fare in `code`, or null when we cannot state it honestly.
 *
 * Rounded to whole units on purpose for the dated currencies: cents on a
 * converted figure imply a precision the conversion does not have, and
 * "US$329.67" invites someone to transfer exactly that and arrive short when
 * their bank applies a different rate. The rand keeps its cents, because at
 * par it is not a conversion at all.
 */
export function convertFromNad(
  nad: string | number,
  code: CurrencyCode,
  rates: Rates,
): string | null {
  if (code === "NAD") return null;

  const currency = CURRENCY_BY_CODE.get(code);
  if (!currency) return null;

  let amount: number;
  try {
    amount = parseMoney(nad);
  } catch {
    return null;
  }
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (currency.exact) {
    const formatted = Number.isInteger(amount)
      ? WHOLE.format(amount)
      : amount.toFixed(2);
    return `${currency.symbol}${formatted}`;
  }

  const rate = rates.nadPer[code];
  if (rate === undefined) return null;

  return `${currency.symbol}${WHOLE.format(Math.round(amount / rate))}`;
}

/**
 * The sentence under a converted fare. Exact currencies get the reason they
 * are exact; dated ones get the rate and the day it was set, because an
 * undated approximation quietly becomes last year's rate.
 */
export function rateNote(code: CurrencyCode, rates: Rates): string | null {
  const currency = CURRENCY_BY_CODE.get(code);
  if (!currency || code === "NAD") return null;

  if (currency.exact) {
    return "the Namibian dollar is pegged at par to the rand, so this is exact";
  }

  const rate = rates.nadPer[code];
  if (rate === undefined) return null;

  const at = `at N$${rate.toFixed(2)} to the ${currency.label.toLowerCase()}`;
  if (!rates.asAt) return at;

  const on = new Date(`${rates.asAt}T12:00:00+02:00`);
  if (Number.isNaN(on.getTime())) return at;

  return `${at}, ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Windhoek",
  }).format(on)}`;
}

/** True when the figure is a conversion we cannot promise. */
export function isIndicative(code: CurrencyCode): boolean {
  const currency = CURRENCY_BY_CODE.get(code);
  return Boolean(currency && code !== "NAD" && !currency.exact);
}

/**
 * A first guess from the browser's own locale, used only until the reader
 * picks for themselves. Guessing wrong costs nothing — the NAD figure is
 * still the one on screen — while guessing right saves the visitor who does
 * not know a Namibian dollar from a rand.
 */
const REGION_CURRENCY: Record<string, CurrencyCode> = {
  NA: "NAD",
  ZA: "ZAR",
  US: "USD",
  GB: "GBP",
  IE: "EUR",
  DE: "EUR",
  AT: "EUR",
  CH: "EUR",
  NL: "EUR",
  BE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  PT: "EUR",
  LU: "EUR",
  FI: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  GR: "EUR",
  CY: "EUR",
  MT: "EUR",
  HR: "EUR",
};

export function guessCurrency(
  locales: readonly string[],
  available: readonly Currency[],
): CurrencyCode | null {
  const offered = new Set(available.map((c) => c.code));

  for (const locale of locales) {
    // "de-DE" -> DE. Also handles "de-Latn-DE" and a bare "de" (no region).
    const region = locale.split("-").find((part) => /^[A-Z]{2}$/.test(part));
    const code = region ? REGION_CURRENCY[region] : undefined;
    if (code && offered.has(code)) return code;
  }

  return null;
}
