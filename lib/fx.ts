import { parseMoney } from "@/lib/money";

/**
 * Showing a fare in dollars, without pretending we charge in them.
 *
 * We bank in Namibian dollars at FNB. A traveller paying from abroad sends a
 * SWIFT transfer and their bank converts it at whatever rate applies that day —
 * which means the amount owed is, and can only be, the NAD figure. Printing
 * "US$330" as the price would be a number we cannot honour: the rate moves
 * between the quote and the transfer, and the difference would land on someone.
 *
 * So this is a conversion shown beside the fare, never instead of it, and it
 * carries the date it was set. An American looking at "N$6,000" has no idea
 * whether that is fifty dollars or five hundred, and that is a real reason to
 * lose a booking — but an undated approximation that drifts for months is how
 * a site ends up quoting last year's rate as though it were today's.
 *
 * The rate is operator-set rather than fetched. A live FX API is one more
 * dependency that can be down at the moment somebody is deciding to pay, for
 * precision that an indicative figure does not need.
 */

export type FxRate = {
  /** Namibian dollars per one US dollar. */
  nadPerUsd: number;
  /** yyyy-mm-dd the operator last set it. */
  asAt: string | null;
};

/**
 * Null unless a plausible rate is configured. The bounds are deliberately
 * wide but finite: the NAD has traded between roughly 10 and 25 to the dollar
 * for a decade, and a misplaced decimal point — 1.82, or 182 — would quote a
 * price out by a factor of ten to every foreign traveller on the site.
 */
export function getFxRate(): FxRate | null {
  const raw = process.env.USD_RATE?.trim();
  if (!raw) return null;

  const nadPerUsd = Number(raw);
  if (!Number.isFinite(nadPerUsd) || nadPerUsd < 5 || nadPerUsd > 40) {
    console.warn(
      `[fx] USD_RATE=${raw} is not a plausible N$ per US$ rate — ignoring it.`,
    );
    return null;
  }

  const asAt = process.env.USD_RATE_AS_AT?.trim();
  return {
    nadPerUsd,
    asAt: asAt && /^\d{4}-\d{2}-\d{2}$/.test(asAt) ? asAt : null,
  };
}

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

/**
 * The fare in dollars, rounded to whole dollars on purpose.
 *
 * Cents on a converted figure imply a precision the conversion does not have.
 * "About US$330" is honest; "US$329.67" invites someone to transfer exactly
 * that and be short when their bank applies a different rate.
 */
export function indicativeUsd(
  nad: string | number,
  rate: FxRate | null = getFxRate(),
): string | null {
  if (!rate) return null;

  const amount = parseMoney(nad);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return `US$${USD_FORMATTER.format(Math.round(amount / rate.nadPerUsd))}`;
}

/** "at N$18.20 to the US dollar, 21 September 2026" — the working, shown. */
export function fxNote(rate: FxRate | null = getFxRate()): string | null {
  if (!rate) return null;

  const at = `at N$${rate.nadPerUsd.toFixed(2)} to the US dollar`;
  if (!rate.asAt) return at;

  const date = new Date(`${rate.asAt}T12:00:00+02:00`);
  if (Number.isNaN(date.getTime())) return at;

  return `${at}, ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Windhoek",
  }).format(date)}`;
}
