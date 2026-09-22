"use client";

import { useCurrency } from "@/components/currency/currency-provider";
import { convertFromNad, isIndicative, rateNote } from "@/lib/currency";
import { formatNad } from "@/lib/money";

/**
 * A price, in Namibian dollars, with the reader's own currency beside it.
 *
 * Every surface that shows a fare renders through this, so a conversion can
 * never exist on one page and not another — which is exactly how it ended up
 * on the two confirmation pages and nowhere a traveller was still deciding.
 *
 * The NAD figure is always present and always first. It is the amount owed,
 * and the converted figure is never allowed to replace it, only to sit next
 * to it.
 */
export function Fare({
  nad,
  showCents,
  className,
  /** Render the conversion on its own line rather than inline. */
  block = false,
  /** Suppress the conversion where there is genuinely no room for it. */
  bare = false,
}: {
  nad: string | number;
  showCents?: boolean;
  className?: string;
  block?: boolean;
  bare?: boolean;
}) {
  const currency = useCurrency();
  const primary = formatNad(nad, showCents === undefined ? undefined : { showCents });

  if (bare || !currency?.ready || currency.code === "NAD") {
    return <span className={className}>{primary}</span>;
  }

  const converted = convertFromNad(nad, currency.code, currency.rates);
  if (!converted) return <span className={className}>{primary}</span>;

  const approx = isIndicative(currency.code);

  return (
    <span className={className}>
      {primary}
      <span
        className={
          block
            ? "text-muted-foreground mt-0.5 block text-sm font-normal"
            : "text-muted-foreground ml-2 text-[0.85em] font-normal"
        }
      >
        {approx ? "≈ " : "= "}
        {converted}
      </span>
    </span>
  );
}

/**
 * The working, for the one place on a page that should carry it — a booking
 * total, not every row of a table. Renders nothing in NAD, and nothing while
 * the reader's stored choice has yet to be applied.
 */
export function FareNote({ className }: { className?: string }) {
  const currency = useCurrency();
  if (!currency?.ready || currency.code === "NAD") return null;

  const note = rateNote(currency.code, currency.rates);
  if (!note) return null;

  return (
    <span className={className}>
      {isIndicative(currency.code)
        ? `Approximate, ${note}. You are charged in Namibian dollars; your bank converts on the day.`
        : `Shown in rand — ${note}.`}
    </span>
  );
}
