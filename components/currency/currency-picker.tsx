"use client";

import { ChevronDownIcon } from "lucide-react";

import { useCurrency } from "@/components/currency/currency-provider";
import { isCurrencyCode } from "@/lib/currency";

/**
 * Switching the currency beside every fare.
 *
 * A native `<select>` rather than a styled menu. Five options do not earn a
 * dropdown library: the native control is already keyboard-navigable and
 * screen-reader labelled, it becomes a proper wheel on a phone, and it costs
 * nothing to send. The chevron is decorative and the real control sits
 * transparently over it, so the browser still owns the behaviour.
 *
 * Renders nothing when a deployment has configured no rates — better no
 * control than one that offers a single option — and nothing until the stored
 * preference has been read, so the label cannot change under the cursor.
 */
export function CurrencyPicker({ className }: { className?: string }) {
  const currency = useCurrency();
  if (!currency?.ready || currency.options.length < 2) return null;

  return (
    <div className={`relative inline-flex items-center ${className ?? ""}`}>
      <label htmlFor="currency-picker" className="sr-only">
        Show fares in
      </label>

      <select
        id="currency-picker"
        value={currency.code}
        onChange={(event) => {
          if (isCurrencyCode(event.target.value)) {
            currency.setCode(event.target.value);
          }
        }}
        className="focus-ring text-muted-foreground hover:text-foreground h-9 cursor-pointer appearance-none rounded-md bg-transparent py-0 pr-6 pl-2 text-sm font-medium transition-colors"
      >
        {currency.options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.code}
          </option>
        ))}
      </select>

      <ChevronDownIcon
        className="text-muted-foreground pointer-events-none absolute right-1.5 size-3.5"
        aria-hidden
      />
    </div>
  );
}
