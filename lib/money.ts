/**
 * NAD amounts move through the app as `numeric(10, 2)` strings so they stay
 * exact. Convert only at the edges: parse for arithmetic, format for display.
 */

const NAD_FORMATTER = new Intl.NumberFormat("en-NA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "650.00" -> 650. Throws on anything that isn't a finite number. */
export function parseMoney(value: string | number): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error(`Not a valid money value: ${String(value)}`);
  }
  return amount;
}

/** 650 -> "650.00", the shape Postgres numeric columns expect. */
export function toMoneyString(amount: number): string {
  return parseMoney(amount).toFixed(2);
}

/** "650.00" -> "N$650.00". Whole amounts drop the cents: "N$650". */
export function formatNad(
  value: string | number,
  options?: { showCents?: boolean }
): string {
  const amount = parseMoney(value);
  const showCents = options?.showCents ?? !Number.isInteger(amount);
  const formatted = showCents
    ? NAD_FORMATTER.format(amount)
    : new Intl.NumberFormat("en-NA", { maximumFractionDigits: 0 }).format(
        amount
      );
  return `N$${formatted}`;
}
