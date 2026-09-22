import "server-only";

import {
  CURRENCIES,
  EMPTY_RATES,
  type CurrencyCode,
  type Rates,
} from "@/lib/currency";

/**
 * Reading the operator's rates out of the environment.
 *
 * Kept apart from `lib/currency.ts` because that file is imported by client
 * components, and `process.env` there is not the environment — it is whatever
 * the bundler inlined. Rates are read once on the server and handed down, so
 * there is exactly one place they can come from.
 *
 * Not secret: a rate is printed on the page. It is server-read only so an
 * operator sets it in one place rather than needing a `NEXT_PUBLIC_` twin.
 */
export function getRates(): Rates {
  const nadPer: Partial<Record<CurrencyCode, number>> = {};

  for (const currency of CURRENCIES) {
    if (!currency.env || !currency.bounds) continue;

    const raw = process.env[currency.env]?.trim();
    if (!raw) continue;

    const value = Number(raw);
    const [min, max] = currency.bounds;

    if (!Number.isFinite(value) || value < min || value > max) {
      console.warn(
        `[currency] ${currency.env}=${raw} is not a plausible N$ per ${currency.code} ` +
          `rate (expected ${min}–${max}) — ignoring it. A misplaced decimal here ` +
          `would misprice every fare on the site by a factor of ten.`,
      );
      continue;
    }

    nadPer[currency.code] = value;
  }

  const raw =
    process.env.FX_RATE_AS_AT?.trim() ||
    // The single-currency variable this replaced. Kept so an existing
    // deployment does not silently lose its date on the next push.
    process.env.USD_RATE_AS_AT?.trim();

  const asAt = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;

  if (Object.keys(nadPer).length === 0) return EMPTY_RATES;
  return { nadPer, asAt };
}
